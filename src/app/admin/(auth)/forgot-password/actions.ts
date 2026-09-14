"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getClientIpFromHeaders } from "@/lib/rate-limit";
import { checkSharedRateLimit } from "@/lib/shared-rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicAppUrl } from "@/lib/public-url";

export type RecoveryState = { error: string | null; success: string | null };
const genericSuccess = "Si existe una cuenta con ese email, vas a recibir un enlace para cambiar la contraseña. Revisá también spam.";

export async function requestPasswordRecovery(_: RecoveryState, formData: FormData): Promise<RecoveryState> {
  const parsed = z.string().trim().email("Ingresá un email válido.").max(254).safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Ingresá un email válido.", success: null };
  const appUrl = getPublicAppUrl();
  const limit = await checkSharedRateLimit({ key: `password-recovery:${getClientIpFromHeaders(await headers())}`, limit: 3, windowMs: 15 * 60_000 });
  if (!limit.allowed) return { error: "Esperá unos minutos antes de solicitar otro enlace.", success: null };
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo: new URL("/auth/recovery", appUrl).toString() });
    // The same response for existing and absent accounts prevents account enumeration.
    return { error: null, success: genericSuccess };
  } catch {
    return { error: "No se pudo solicitar el enlace. Intentá de nuevo en unos minutos.", success: null };
  }
}
