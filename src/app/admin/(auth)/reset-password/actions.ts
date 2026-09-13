"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function updateRecoveredPassword(_: { error: string | null }, formData: FormData): Promise<{ error: string | null }> {
  const parsed = z.object({ password: z.string().min(8).max(128), confirmPassword: z.string() })
    .refine((value) => value.password === value.confirmPassword)
    .safeParse({ password: formData.get("password"), confirmPassword: formData.get("confirmPassword") });
  if (!parsed.success) return { error: "Usá entre 8 y 128 caracteres y repetí la misma contraseña." };
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !user) return { error: "El enlace venció. Solicitá uno nuevo desde Recuperar contraseña." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "No se pudo actualizar. Usá una contraseña diferente y volvé a intentar." };
  await supabase.auth.signOut({ scope: "global" });
  redirect("/admin/login?reset=1");
}
