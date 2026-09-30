export function resolveSafeNextPath(next: string | null | undefined, fallback = "/admin") {
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(next)) return fallback;

  const localOrigin = "https://redirect.invalid";
  try {
    const destination = new URL(next, localOrigin);
    if (destination.origin !== localOrigin || destination.pathname.startsWith("//")) return fallback;
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return fallback;
  }
}

export function buildAdminLoginPath(next?: string | null) {
  const safeNext = resolveSafeNextPath(next, "/admin");
  if (!safeNext || safeNext === "/admin") {
    return "/admin/login";
  }

  return `/admin/login?next=${encodeURIComponent(safeNext)}`;
}
