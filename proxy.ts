import { NextResponse, type NextRequest } from "next/server";

import { ACTIVE_ORG_COOKIE, ACTIVE_ORG_COOKIE_MAX_AGE } from "@/lib/active-org";
import { isTournamentsEnabled, TOURNAMENTS_DISABLED_ADMIN_MESSAGE } from "@/lib/features";
import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware";

function redirectToLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/admin/login";
  url.searchParams.set("from", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

function persistActiveOrgCookieIfPresent(request: NextRequest, response: NextResponse) {
  const orgQuery = request.nextUrl.searchParams.get("org");
  if (!orgQuery) return;
  const trimmed = orgQuery.trim();
  if (!trimmed || trimmed.length > 120) return;
  const currentCookie = request.cookies.get(ACTIVE_ORG_COOKIE)?.value ?? null;
  if (currentCookie === trimmed) return;
  response.cookies.set(ACTIVE_ORG_COOKIE, trimmed, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: ACTIVE_ORG_COOKIE_MAX_AGE
  });
}

function isTournamentAssetApiPath(pathname: string) {
  return (
    pathname.startsWith("/api/league-logo") ||
    pathname.startsWith("/api/league-photo") ||
    pathname.startsWith("/api/league-team-logo")
  );
}

function blockDisabledTournamentRoutes(request: NextRequest) {
  if (isTournamentsEnabled()) return null;

  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/tournaments") ||
    pathname.startsWith("/captain") ||
    pathname.startsWith("/admin/tournaments/invite") ||
    isTournamentAssetApiPath(pathname)
  ) {
    return new NextResponse(null, { status: 404 });
  }

  if (pathname.startsWith("/admin/tournaments")) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    url.searchParams.set("error", TOURNAMENTS_DISABLED_ADMIN_MESSAGE);
    return NextResponse.redirect(url);
  }

  return null;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const disabledTournamentResponse = blockDisabledTournamentRoutes(request);
  if (disabledTournamentResponse) return disabledTournamentResponse;

  const isAdminArea = pathname.startsWith("/admin");

  if (!isAdminArea) {
    const response = NextResponse.next();
    persistActiveOrgCookieIfPresent(request, response);
    return response;
  }

  const response = NextResponse.next({ request });
  persistActiveOrgCookieIfPresent(request, response);

  const supabase = createSupabaseMiddlewareClient(request, response);
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (pathname.startsWith("/admin/login")) {
    if (user) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }
    return response;
  }

  if (!user) {
    return redirectToLogin(request);
  }

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/",
    "/ranking/:path*",
    "/players/:path*",
    "/matches/:path*",
    "/upcoming/:path*",
    "/pricing/:path*",
    "/tournaments/:path*",
    "/captain/:path*",
    "/api/league-logo/:path*",
    "/api/league-photo/:path*",
    "/api/league-team-logo/:path*"
  ]
};
