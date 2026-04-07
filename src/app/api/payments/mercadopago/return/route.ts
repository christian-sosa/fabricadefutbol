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

function normalizeTargetPath(target: string | null) {
  if (!target) return "/admin/billing?checkout=failure";
  if (!target.startsWith("/")) return "/admin/billing?checkout=failure";
  return target;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const appBaseUrl = resolveAppBaseUrl();
  const targetPath = normalizeTargetPath(requestUrl.searchParams.get("target"));
  const destination = new URL(targetPath, `${appBaseUrl}/`);

  for (const [key, value] of requestUrl.searchParams.entries()) {
    if (key === "target") continue;
    destination.searchParams.set(key, value);
  }

  return NextResponse.redirect(destination.toString(), { status: 302 });
}

