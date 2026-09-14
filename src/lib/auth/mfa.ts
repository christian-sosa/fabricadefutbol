import type { User } from "@supabase/supabase-js";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requiresMfaVerification(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  user: User
) {
  // getUser() is verified by Auth; never trust user-editable metadata for MFA.
  if (!user.factors?.some((factor) => factor.status === "verified")) return false;
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) throw new Error("No se pudo verificar el segundo factor. Volvé a iniciar sesión.");
  return data.currentLevel !== "aal2";
}
