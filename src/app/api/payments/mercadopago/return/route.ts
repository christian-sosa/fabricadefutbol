import { headers } from "next/headers";
import { NextResponse } from "next/server";

function stripTrailingSlashes(value: string) {
  return value.replace(/\/+$/, "");
}

function resolveAppBaseUrl() {
  const configuredAppUrl =
    process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredAppUrl) {
    return stripTrailingSlashes(configuredAppUrl);
  }

  const headerStore = headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol =
    headerStore.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");

  if (!host) {
    return "http://localhost:3000";
  }

  return `${protocol}://${host}`;
}

const DEFAULT_TARGET = "/admin/billing?checkout=failure";

function normalizeTargetPath(target: string | null, appBaseUrl: string) {
  if (!target) return DEFAULT_TARGET;
  if (!target.startsWith("/")) return DEFAULT_TARGET;
  // Bloquea rutas protocol-relative ("//evil.com") y variantes con backslash.
  if (target.startsWith("//") || target.startsWith("/\\")) return DEFAULT_TARGET;
  try {
    const parsed = new URL(target, `${appBaseUrl}/`);
    const base = new URL(appBaseUrl);
    if (parsed.origin !== base.origin) return DEFAULT_TARGET;
    return parsed.pathname + parsed.search;
  } catch {
    return DEFAULT_TARGET;
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const appBaseUrl = resolveAppBaseUrl();
  const targetPath = normalizeTargetPath(requestUrl.searchParams.get("target"), appBaseUrl);
  const destination = new URL(targetPath, `${appBaseUrl}/`);

  for (const [key, value] of requestUrl.searchParams.entries()) {
    if (key === "target") continue;
    destination.searchParams.set(key, value);
  }

  return NextResponse.redirect(destination.toString(), { status: 302 });
}

