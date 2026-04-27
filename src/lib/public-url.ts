const DEFAULT_PUBLIC_APP_URL = "https://fabricadefutbol.com.ar";

function firstConfiguredUrl(names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return null;
}

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

export function getPublicAppUrl() {
  const isDevelopment =
    process.env.NODE_ENV === "development" ||
    ["dev", "development"].includes((process.env.SUPABASE_TARGET_ENV ?? "").toLowerCase());
  const selected = isDevelopment
    ? firstConfiguredUrl(["NEXT_PUBLIC_APP_URL_DEV", "APP_URL_DEV", "NEXT_PUBLIC_APP_URL", "APP_URL"])
    : firstConfiguredUrl(["NEXT_PUBLIC_APP_URL", "APP_URL", "NEXT_PUBLIC_APP_URL_PROD", "APP_URL_PROD"]);
  const fallback = firstConfiguredUrl([
    "NEXT_PUBLIC_APP_URL",
    "APP_URL",
    "NEXT_PUBLIC_APP_URL_DEV",
    "APP_URL_DEV",
    "NEXT_PUBLIC_APP_URL_PROD",
    "APP_URL_PROD"
  ]);

  return normalizeBaseUrl(selected ?? fallback ?? DEFAULT_PUBLIC_APP_URL);
}

export function buildAbsolutePublicUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, `${getPublicAppUrl()}/`).toString();
}

