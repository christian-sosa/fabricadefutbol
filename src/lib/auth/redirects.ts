export function resolveSafeNextPath(next: string | null | undefined, fallback = "/admin") {
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

export function buildAdminLoginPath(next?: string | null) {
  const safeNext = resolveSafeNextPath(next, "/admin");
  if (!safeNext || safeNext === "/admin") {
    return "/admin/login";
  }

  return `/admin/login?next=${encodeURIComponent(safeNext)}`;
}
