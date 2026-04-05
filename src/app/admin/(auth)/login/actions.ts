"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().email("Ingresa un email valido."),
  password: z.string().min(6, "La contrasena debe tener al menos 6 caracteres.")
});

const registerSchema = z
  .object({
    displayName: z.string().min(2, "Tu nombre debe tener al menos 2 caracteres.").max(80),
    email: z.string().email("Ingresa un email valido."),
    password: z.string().min(6, "La contrasena debe tener al menos 6 caracteres."),
    confirmPassword: z.string().min(6, "Confirma la contrasena.")
  })
  .refine((payload) => payload.password === payload.confirmPassword, {
    path: ["confirmPassword"],
    message: "Las contrasenas no coinciden."
  });

export type LoginState = {
  error: string | null;
};

export type RegisterState = {
  error: string | null;
  success: string | null;
};

export async function loginAdminAction(_: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Datos invalidos."
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password
  });

  if (authError || !authData.user) {
    const normalizedMessage = String(authError?.message ?? "").toLowerCase();
    if (normalizedMessage.includes("email not confirmed")) {
      return {
        error:
          "Tu email aun no esta confirmado. Si no llego el correo, revisa spam o confirma el usuario desde Supabase Auth."
      };
    }
    return {
      error: authError?.message ?? "Credenciales incorrectas."
    };
  }

  redirect("/admin");
}

export async function registerAdminAction(_: RegisterState, formData: FormData): Promise<RegisterState> {
  const parsed = registerSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword")
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Datos invalidos.",
      success: null
    };
  }

  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  if (adminClient) {
    const { error: createUserError } = await adminClient.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: {
        display_name: parsed.data.displayName
      }
    });

    const isInvalidAdminKey = String(createUserError?.message ?? "")
      .toLowerCase()
      .includes("invalid api key");

    if (createUserError && !isInvalidAdminKey) {
      return {
        error: createUserError.message,
        success: null
      };
    }

    if (!isInvalidAdminKey) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password
      });

      if (signInError || !signInData.user) {
        return {
          error: signInError?.message ?? "No se pudo iniciar sesion luego del registro.",
          success: null
        };
      }

      redirect("/admin");
    }
  }

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        display_name: parsed.data.displayName
      }
    }
  });

  if (error) {
    return {
      error: error.message,
      success: null
    };
  }

  if (data.session) {
    redirect("/admin");
  }

  return {
    error: null,
    success:
      "Revisa tu email para confirmar la cuenta. Si no llega, revisa spam o desactiva/ajusta confirmacion en Supabase Auth."
  };
}
