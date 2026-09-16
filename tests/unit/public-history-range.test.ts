import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/types/database";
import type { MatchHistoryItem } from "@/lib/query/types";

const { serverClient } = vi.hoisted(() => ({ serverClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: serverClient }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/cache", () => ({ unstable_noStore: vi.fn() }));
import { getMatchHistoryCardsPage } from "@/lib/queries/public";

const ORG = "00000000-0000-4000-8000-000000000001";
const SEASON = "00000000-0000-4000-8000-000000000002";
const rangeError = { code: "PGRST103", message: "Requested range not satisfiable", details: "An offset of 10 was requested, but there are only 2 rows.", hint: null };

function setup(options: { count?: number | null; rangeCode?: string; countFails?: boolean; normal?: boolean; snapshot?: MatchHistoryItem[] } = {}) {
  const requests: Array<{ url: URL; method: string }> = [];
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    requests.push({ url, method });
    if (url.pathname.endsWith("/organization_seasons")) return Response.json([{
      id: SEASON, organization_id: ORG, label: "Temporada", duration_months: 12,
      starts_at: "2026-01-01", ends_at: "2027-01-01", status: "active"
    }]);
    if (url.pathname.endsWith("/organization_public_snapshots")) return Response.json(options.snapshot
      ? [{ organization_id: ORG, match_history: options.snapshot }]
      : []);
    if (url.pathname.endsWith("/match_result")) return Response.json([]);
    if (url.pathname.endsWith("/matches")) {
      if (method === "HEAD") {
        if (options.countFails) return new Response(null, { status: 503, statusText: "Count unavailable" });
        return new Response(null, { headers: options.count === null ? {} : { "content-range": `*/${options.count ?? 2}` } });
      }
      if (options.normal) return Response.json([{
        id: "match-1", scheduled_at: "2026-09-14T21:00:00Z", modality: "6v6", status: "finished", season_id: SEASON, team_a_label: "Verdes", team_b_label: "Azules"
      }], { headers: { "content-range": "0-0/1" } });
      return Response.json({ ...rangeError, code: options.rangeCode ?? "PGRST103" }, { status: 416 });
    }
    throw new Error(`Unexpected test request ${url.pathname}`);
  });
  const client = createClient<Database>("https://fixture.supabase.co", "test-public-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: fetcher }
  });
  serverClient.mockResolvedValue(client);
  return requests;
}

beforeEach(() => { serverClient.mockReset(); });

describe("public history outside the available range", () => {
  it.each([0, 2])("returns page two with the exact total %i and identical group/season filters", async (count) => {
    const requests = setup({ count });
    const result = await getMatchHistoryCardsPage(ORG, { page: 2, pageSize: 10, season: SEASON });
    expect(result).toEqual({ organizationId: ORG, matches: [], pagination: {
      page: 2, pageSize: 10, totalCount: count, totalPages: 1, hasNextPage: false, hasPreviousPage: true
    } });
    const matchQueries = requests.filter(({ url }) => url.pathname.endsWith("/matches"));
    expect(matchQueries.map(({ method }) => method)).toEqual(["GET", "HEAD"]);
    for (const { url } of matchQueries) {
      expect(url.searchParams.get("organization_id")).toBe(`eq.${ORG}`);
      expect(url.searchParams.get("season_id")).toBe(`eq.${SEASON}`);
      expect(url.searchParams.get("status")).toBe("in.(finished,cancelled)");
    }
    expect(matchQueries[1].url.searchParams.has("offset")).toBe(false);
    expect(matchQueries[1].url.searchParams.has("limit")).toBe(false);
  });

  it("preserves historical scope without adding a season filter to the recovery count", async () => {
    const requests = setup({ count: 0 });
    const result = await getMatchHistoryCardsPage(ORG, { page: 2, season: "all" });
    expect(result.pagination.totalCount).toBe(0);
    const countQuery = requests.find(({ method }) => method === "HEAD")!;
    expect(countQuery.url.searchParams.get("organization_id")).toBe(`eq.${ORG}`);
    expect(countQuery.url.searchParams.has("season_id")).toBe(false);
  });

  it("does not hide a failed count as an empty history", async () => {
    setup({ countFails: true });
    await expect(getMatchHistoryCardsPage(ORG, { page: 2, season: SEASON })).rejects.toThrow("No se pudo obtener la cantidad de partidos.");
  });

  it.each([null, 11])("does not invent an empty page when its exact count is missing or contradicts the range error (%s)", async (count) => {
    setup({ count });
    await expect(getMatchHistoryCardsPage(ORG, { page: 2, season: SEASON })).rejects.toThrow("Requested range not satisfiable");
  });

  it("only recovers PGRST103, never matching errors by message alone", async () => {
    const requests = setup({ rangeCode: "42501" });
    await expect(getMatchHistoryCardsPage(ORG, { page: 2, season: SEASON })).rejects.toThrow("Requested range not satisfiable");
    expect(requests.some(({ method }) => method === "HEAD")).toBe(false);
  });

  it("keeps ordinary history to one match query and preserves its rows", async () => {
    const requests = setup({ normal: true });
    const result = await getMatchHistoryCardsPage(ORG, { page: 1, season: SEASON });
    expect(result.matches.map(({ id }) => id)).toEqual(["match-1"]);
    expect(result.matches[0]).toMatchObject({ team_a_label: "Verdes", team_b_label: "Azules" });
    expect(result.pagination.totalCount).toBe(1);
    expect(requests.filter(({ url }) => url.pathname.endsWith("/matches"))).toHaveLength(1);
    expect(requests.some(({ method }) => method === "HEAD")).toBe(false);
  });

  it.each([
    { total: 0, page: 2, expectedIds: [] },
    { total: 3, page: 3, expectedIds: [] },
    { total: 3, page: 2, expectedIds: ["snapshot-3"] }
  ])("keeps snapshot pagination consistent with live history (total $total, page $page)", async ({ total, page, expectedIds }) => {
    const snapshot: MatchHistoryItem[] = Array.from({ length: total }, (_, index) => ({
      id: `snapshot-${index + 1}`, scheduledAt: "2026-09-14T21:00:00Z", modality: "6v6", status: "finished", scoreA: 3, scoreB: 2, winnerTeam: "A", team_a_label: null, team_b_label: null
    }));
    const requests = setup({ snapshot });
    const response = await getMatchHistoryCardsPage(ORG, { page, pageSize: 2, season: "all" });
    expect(response.matches.map(({ id }) => id)).toEqual(expectedIds);
    expect(response.pagination).toEqual({ page, pageSize: 2, totalCount: total, totalPages: Math.max(1, Math.ceil(total / 2)), hasPreviousPage: true, hasNextPage: false });
    expect(requests).toHaveLength(1);
    expect(requests[0].url.pathname).toBe("/rest/v1/organization_public_snapshots");
    expect(requests[0].url.searchParams.get("organization_id")).toBe(`eq.${ORG}`);
  });

  it("loads real team names when the snapshot predates custom labels", async () => {
    const requests = setup({ normal: true, snapshot: [{ id: "match-1", scheduledAt: "2026-09-14T21:00:00Z", modality: "6v6", status: "finished", scoreA: 3, scoreB: 2, winnerTeam: "A" }] });
    const result = await getMatchHistoryCardsPage(ORG, { season: "all" });
    expect(result.matches[0]).toMatchObject({ team_a_label: "Verdes", team_b_label: "Azules" });
    expect(requests.filter(({ url }) => url.pathname.endsWith("/matches"))).toHaveLength(1);
  });
});
