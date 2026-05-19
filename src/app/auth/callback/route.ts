import { NextRequest, NextResponse } from "next/server";

import { SERVER_ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { recordAnalyticsEvent } from "@/lib/analytics/server";
import { resolveSafeNextPath } from "@/lib/auth/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

function buildSafeNextRedirectUrl(request: NextRequest, nextPath: string) {
  return new URL(nextPath, request.nextUrl.origin);
}

function buildFailureRedirect(request: NextRequest, nextPath: string, error: string) {
  const searchParams: Record<string, string> = { error };
  if (nextPath !== "/admin") searchParams.next = nextPath;
  return buildRedirectUrl(request, "/admin/login", searchParams);
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const nextPath = resolveSafeNextPath(requestUrl.searchParams.get("next"), "/admin");
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      buildFailureRedirect(request, nextPath, "No pudimos completar el ingreso con Google. Intenta nuevamente.")
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth] No se pudo intercambiar el codigo OAuth", {
      message: error.message,
      name: error.name,
      status: "status" in error ? error.status : undefined
    });
    return NextResponse.redirect(
      buildFailureRedirect(request, nextPath, "No pudimos completar el ingreso con Google. Intenta nuevamente.")
    );
  }

  if ("getUser" in supabase.auth && typeof supabase.auth.getUser === "function") {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (user?.id) {
      await recordAnalyticsEvent({
        eventName: SERVER_ANALYTICS_EVENTS.adminOauthLoginSucceeded,
        source: "auth_google",
        adminId: user.id,
        entityType: "admin",
        entityId: user.id,
        path: nextPath
      });
    }
  }

  return NextResponse.redirect(buildSafeNextRedirectUrl(request, nextPath));
}
