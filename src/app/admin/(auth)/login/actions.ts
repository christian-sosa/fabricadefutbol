"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().email("Ingresá un email válido."),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres.")
});

export type LoginState = {
  error: string | null;
};

export async function loginAdminAction(_: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Datos inválidos."
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password
  });

  if (authError || !authData.user) {
    return {
      error: "Credenciales incorrectas."
    };
  }

  const { data: adminRow, error: adminCheckError } = await supabase
    .from("admins")
    .select("id")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (adminCheckError || !adminRow) {
    await supabase.auth.signOut();
    return {
      error: "Tu cuenta no está autorizada como admin."
    };
  }

  redirect("/admin");
}
