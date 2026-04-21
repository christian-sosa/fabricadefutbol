"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { resolveSafeNextPath } from "@/lib/auth/redirects";
import { toUserMessage } from "@/lib/errors";
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
  const nextPath = resolveSafeNextPath(
    typeof formData.get("next") === "string" ? String(formData.get("next")) : null,
    "/admin"
  );
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
          "Tu email aun no esta confirmado. Revisa tu casilla y la carpeta de spam para activar la cuenta antes de ingresar."
      };
    }
    if (normalizedMessage.includes("invalid login credentials")) {
      return {
        error: "Email o contrasena incorrectos."
      };
    }
    if (normalizedMessage.includes("too many requests") || normalizedMessage.includes("rate limit")) {
      return {
        error: "Demasiados intentos seguidos. Espera un momento y volve a probar."
      };
    }
    if (authError && typeof console !== "undefined") {
      console.error("[auth] signInWithPassword fallo", {
        code: "code" in authError ? authError.code : undefined,
        message: authError.message,
        status: "status" in authError ? authError.status : undefined
      });
    }
    return {
      error: toUserMessage(authError, "Credenciales incorrectas.")
    };
  }

  redirect(nextPath);
}

export async function registerAdminAction(_: RegisterState, formData: FormData): Promise<RegisterState> {
  const nextPath = resolveSafeNextPath(
    typeof formData.get("next") === "string" ? String(formData.get("next")) : null,
    "/admin"
  );
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
  const appUrl = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  const emailRedirectTo = appUrl
    ? new URL(
        `/auth/confirm-email?next=${encodeURIComponent(nextPath)}`,
        appUrl.replace(/\/+$/, "")
      ).toString()
    : undefined;

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      ...(emailRedirectTo ? { emailRedirectTo } : {}),
      data: {
        display_name: parsed.data.displayName
      }
    }
  });

  if (error) {
    console.error("[auth] No se pudo registrar o enviar el email de confirmacion", {
      code: "code" in error ? error.code : undefined,
      message: error.message,
      name: error.name,
      status: "status" in error ? error.status : undefined
    });

    const lower = error.message.toLowerCase();
    if (lower.includes("already registered") || lower.includes("user already")) {
      return {
        error: "Ya existe una cuenta con ese email. Proba iniciar sesion o recuperar tu contrasena.",
        success: null
      };
    }
    if (lower.includes("password")) {
      return {
        error: "La contrasena no cumple los requisitos minimos. Usa al menos 6 caracteres.",
        success: null
      };
    }

    return {
      error: toUserMessage(error, "No se pudo completar el registro. Intenta nuevamente."),
      success: null
    };
  }

  if (data.session) {
    redirect(nextPath);
  }

  return {
    error: null,
    success:
      "Te enviamos un email para activar tu cuenta. Revisa tu casilla y, si no aparece en unos minutos, busca tambien en spam."
  };
}
