export function parseMatchHistoryPage(value: string | string[] | null | undefined) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page <= 100_000 ? page : 1;
}

export function parseMatchHistorySeason(value: string | string[] | null | undefined) {
  if (value === "all") return value;
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : "current";
}

export function buildMatchHistoryHref(params: {
  organizationSlug?: string | null;
  season?: string | null;
  page?: number;
  matchId?: string;
  view?: string;
}) {
  const search = new URLSearchParams();
  if (params.organizationSlug) search.set("org", params.organizationSlug);
  const season = parseMatchHistorySeason(params.season);
  const page = parseMatchHistoryPage(String(params.page ?? 1));
  if (season !== "current") search.set("season", season);
  if (page > 1) search.set("page", String(page));
  if (params.view === "calendar") search.set("view", "calendar");
  const pathname = params.matchId ? `/matches/${encodeURIComponent(params.matchId)}` : "/matches";
  return search.size ? `${pathname}?${search.toString()}` : pathname;
}
