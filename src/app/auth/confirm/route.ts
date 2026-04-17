import type { EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

function resolveNextPath(next: string | null) {
  return next?.startsWith("/") ? next : "/admin/login";
}

function buildRedirectUrl(request: NextRequest, pathname: string, searchParams?: Record<string, string>) {
  const destination = request.nextUrl.clone();
  destination.pathname = pathname;
  destination.search = "";

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      destination.searchParams.set(key, value);
    }
  }

  return destination;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const nextPath = resolveNextPath(requestUrl.searchParams.get("next"));
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const code = requestUrl.searchParams.get("code");

  const successRedirect = buildRedirectUrl(request, nextPath, { confirmed: "1" });
  const failureRedirect = buildRedirectUrl(request, "/admin/login", {
    error: "No pudimos confirmar tu email. Intenta abrir de nuevo el enlace o vuelve a registrarte."
  });
  const legacyLinkRedirect = buildRedirectUrl(request, "/admin/login", {
    error:
      "Este enlace de confirmacion usa un formato anterior. Si tu cuenta ya quedo confirmada, intenta iniciar sesion. Si no, solicita un nuevo email."
  });

  const supabase = await createSupabaseServerClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type
    });

    if (!error) {
      return NextResponse.redirect(successRedirect);
    }

    console.error("[auth] No se pudo verificar el token del email", {
      message: error.message,
      name: error.name,
      status: "status" in error ? error.status : undefined,
      type
    });
    return NextResponse.redirect(failureRedirect);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(successRedirect);
    }

    console.error("[auth] No se pudo intercambiar el codigo de confirmacion", {
      message: error.message,
      name: error.name,
      status: "status" in error ? error.status : undefined
    });
    return NextResponse.redirect(failureRedirect);
  }

  return NextResponse.redirect(legacyLinkRedirect);
}
