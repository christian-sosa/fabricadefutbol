import { NextResponse, type NextRequest } from "next/server";

import { ACTIVE_ORG_COOKIE, ACTIVE_ORG_COOKIE_MAX_AGE } from "@/lib/active-org";
import { getPublicAppUrl } from "@/lib/public-url";
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

function normalizeRequestHost(request: NextRequest) {
  return (request.headers.get("host") ?? request.nextUrl.host).toLowerCase().split(":")[0] ?? "";
}

function hostBelongsToMainApp(host: string) {
  if (!host) return true;
  if (["localhost", "127.0.0.1", "::1"].includes(host)) return true;
  if (host.endsWith(".localhost") || host.endsWith(".vercel.app")) return true;

  try {
    const appHost = new URL(getPublicAppUrl()).hostname.toLowerCase().replace(/^www\./, "");
    return host.replace(/^www\./, "") === appHost;
  } catch {
    return false;
  }
}

function mapCustomDomainPathToClubPath(pathname: string, slug: string) {
  if (pathname === "/") return `/clubs/${slug}`;
  if (pathname === "/catalogo" || pathname.startsWith("/catalogo/")) {
    return `/clubs/${slug}${pathname}`;
  }
  if (pathname === "/equipo" || pathname.startsWith("/equipo/")) {
    return `/clubs/${slug}${pathname}`;
  }
  return null;
}

async function resolveClubSiteRewrite(request: NextRequest, response: NextResponse) {
  const host = normalizeRequestHost(request);
  if (hostBelongsToMainApp(host)) return null;

  const targetPath = mapCustomDomainPathToClubPath(request.nextUrl.pathname, "__slug__");
  if (!targetPath) return null;

  const normalizedHost = host.replace(/^www\./, "");
  const domains = Array.from(new Set([host, normalizedHost, `www.${normalizedHost}`]));
  const supabase = createSupabaseMiddlewareClient(request, response);
  const { data: settings, error: settingsError } = await supabase
    .from("club_site_settings")
    .select("club_id")
    .in("domain", domains)
    .eq("enabled", true)
    .eq("published", true)
    .maybeSingle();

  if (settingsError || !settings?.club_id) return null;

  const { data: club, error: clubError } = await supabase
    .from("clubs")
    .select("slug, status")
    .eq("id", settings.club_id)
    .maybeSingle();

  if (clubError || !club || club.status !== "active") return null;

  const mappedPath = mapCustomDomainPathToClubPath(request.nextUrl.pathname, String(club.slug));
  if (!mappedPath) return null;

  const url = request.nextUrl.clone();
  url.pathname = mappedPath;
  return NextResponse.rewrite(url, { request });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminArea = pathname.startsWith("/admin");
  const response = NextResponse.next({ request });
  persistActiveOrgCookieIfPresent(request, response);

  if (!isAdminArea) {
    const clubSiteRewrite = await resolveClubSiteRewrite(request, response);
    if (clubSiteRewrite) return clubSiteRewrite;
    return response;
  }

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
    "/clubs/:path*",
    "/catalogo/:path*",
    "/equipo/:path*",
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
