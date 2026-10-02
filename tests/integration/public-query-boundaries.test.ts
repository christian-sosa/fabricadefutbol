import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { publicClient, authenticatedClient, cookies } = vi.hoisted(() => ({
  publicClient: vi.fn(), authenticatedClient: vi.fn(), cookies: vi.fn()
}));
vi.mock("@/lib/supabase/public", () => ({ createSupabasePublicClient: publicClient }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: authenticatedClient }));
vi.mock("next/headers", () => ({ cookies }));
vi.mock("next/cache", () => ({ unstable_noStore: vi.fn() }));

import {
  getHomeSummary, getMatchCalendarActivity, getMatchDetails, getMatchHistoryCards,
  getMatchHistoryCardsPage, getOrganizationSeasons, getPlayerDetails, getPlayersWithStats,
  getPublicOrganizations, getRankingPlayers, getUpcomingConfirmedMatches,
  refreshOrganizationPublicSnapshot, resolvePublicOrganization
} from "@/lib/queries/public";
import { createFakeSupabase } from "../helpers/fake-supabase";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const UNLISTED_ID = "22222222-2222-4222-8222-222222222222";
const organization = { id: ORG_ID, name: "Visible", slug: "visible", is_public: true, is_listed: true, archived_at: null, sporting_revision: 7 };
const annual = { id: "year-2026", organization_id: ORG_ID, starts_at: "2026-01-01", ends_at: "2026-12-31", label: "2026", status: "closed" };
const previous = { ...annual, id: "year-2025", starts_at: "2025-01-01", ends_at: "2025-12-31", label: "2025", status: "active" };
const player = { id: "player-1", organization_id: ORG_ID, full_name: "Jugador", initial_rank: 1, current_rating: 1250, active: true, is_injured: true };
function match(id: string, season_id = annual.id, overrides: Record<string, unknown> = {}) {
  return { id, organization_id: ORG_ID, season_id, scheduled_at: "2026-12-20T20:00:00Z", modality: "5v5", status: "finished", ...overrides };
}
type FakeClient = ReturnType<typeof createFakeSupabase>["client"];
function observePublicReads(client: FakeClient) {
  const tables: string[] = [];
  const ranges: Array<{ table: string; from: number; to: number }> = [];
  return {
    tables, ranges,
    client: {
      ...client,
      from(table: Parameters<FakeClient["from"]>[0]) {
        if (table === "players") throw new Error("Private players table used by a public reader");
        tables.push(table);
        const query = client.from(table);
        const range = query.range.bind(query);
        query.range = (from, to) => { ranges.push({ table, from, to }); return range(from, to); };
        return query;
      }
    }
  };
}
function annualData() {
  return createFakeSupabase({
    organizations: [organization], players: [player], organization_seasons: [previous, annual],
    organization_season_player_ratings: [
      { season_id: annual.id, player_id: player.id, current_rating: 1080 },
      { season_id: previous.id, player_id: player.id, current_rating: 1120 }
    ],
    matches: [match("annual-match"), match("previous-match", previous.id, { scheduled_at: "2025-12-20T20:00:00Z" })],
    team_options: [
      { id: "annual-option", match_id: "annual-match", is_confirmed: true },
      { id: "previous-option", match_id: "previous-match", is_confirmed: true }
    ],
    team_option_players: [
      { team_option_id: "annual-option", player_id: player.id, team: "A" },
      { team_option_id: "previous-option", player_id: player.id, team: "A" }
    ],
    match_result: [
      { match_id: "annual-match", winner_team: "A", score_a: 2, score_b: 0, mvp_player_id: player.id },
      { match_id: "previous-match", winner_team: "A", score_a: 1, score_b: 0, mvp_player_id: player.id }
    ]
  });
}

describe("public query boundaries", () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-12-31T12:00:00Z"));
    publicClient.mockReset(); authenticatedClient.mockReset(); cookies.mockReset();
    authenticatedClient.mockImplementation(() => { throw new Error("Cookie-backed client accessed by a public reader"); });
    cookies.mockResolvedValue({ get: () => undefined });
  });
  afterEach(() => vi.useRealTimers());

  it("keeps every public entry point and nested helper on the anonymous client and public player view", async () => {
    const reads = observePublicReads(annualData().client);
    publicClient.mockReturnValue(reads.client);
    await getPublicOrganizations(); await resolvePublicOrganization("visible"); await getOrganizationSeasons(ORG_ID);
    await getHomeSummary(ORG_ID); await getRankingPlayers(ORG_ID);
    const standings = await getPlayersWithStats(ORG_ID);
    await getPlayersWithStats(ORG_ID, { season: "all" });
    await getMatchHistoryCards(ORG_ID); await getMatchHistoryCardsPage(ORG_ID, { season: "all" });
    await getMatchCalendarActivity(ORG_ID); await getUpcomingConfirmedMatches(ORG_ID);
    const details = await getPlayerDetails(player.id, "visible");
    await getMatchDetails("annual-match", "visible");
    expect(authenticatedClient).not.toHaveBeenCalled();
    expect(reads.tables).not.toContain("players");
    expect(reads.tables).toContain("public_players");
    expect(standings[0]).toMatchObject({ isInjured: true, isAbsent: false, matchesPlayed: 1 });
    expect(details?.player.is_injured).toBe(true);
    expect(details?.playerStats).toMatchObject({ isInjured: true, isAbsent: false });
  });

  it("excludes unlisted groups from the directory while supporting explicit slug, UUID and cookie selection", async () => {
    const fake = createFakeSupabase({ organizations: [organization,
      { ...organization, id: UNLISTED_ID, slug: "compartido", name: "Compartido", is_listed: false },
      { ...organization, id: "archived", slug: "archivado", archived_at: "2026-12-01T00:00:00Z" },
      { ...organization, id: "private", slug: "privado", is_public: false }
    ] });
    publicClient.mockReturnValue(fake.client);
    expect((await getPublicOrganizations()).map((row) => row.id)).toEqual([ORG_ID]);
    expect((await resolvePublicOrganization("COMPARTIDO")).selectedOrganization?.id).toBe(UNLISTED_ID);
    expect((await resolvePublicOrganization(UNLISTED_ID)).selectedOrganization?.id).toBe(UNLISTED_ID);
    cookies.mockResolvedValue({ get: () => ({ value: UNLISTED_ID }) });
    const fromCookie = await resolvePublicOrganization();
    expect(fromCookie.selectedOrganization?.id).toBe(UNLISTED_ID);
    expect(fromCookie.organizations.map((row) => row.id)).toEqual([ORG_ID]);
    cookies.mockResolvedValue({ get: () => undefined });
    expect((await resolvePublicOrganization("archivado")).selectedOrganization?.id).toBe(ORG_ID);
    expect((await resolvePublicOrganization("privado")).selectedOrganization?.id).toBe(ORG_ID);
    expect(authenticatedClient).not.toHaveBeenCalled();
  });

  it("resolves explicit unlisted groups in player and match details without exposing archived groups", async () => {
    const fake = createFakeSupabase({ organizations: [{ ...organization, is_listed: false }], players: [player], matches: [match("finished")] });
    publicClient.mockReturnValue(fake.client);
    expect((await getPlayerDetails(player.id, "visible"))?.player.id).toBe(player.id);
    expect((await getMatchDetails("finished", ORG_ID))?.match.id).toBe("finished");
    await fake.client.from("organizations").update({ archived_at: "2026-12-01T00:00:00Z" }).eq("id", ORG_ID);
    await expect(getPlayerDetails(player.id, "visible")).resolves.toBeNull();
    await expect(getMatchDetails("finished", ORG_ID)).resolves.toBeNull();
  });

  it("paginates the directory and season selector beyond the PostgREST row cap", async () => {
    const ids = Array.from({ length: 1207 }, (_, i) => String(i).padStart(4, "0"));
    const fake = createFakeSupabase({
      organizations: ids.map((id) => ({ ...organization, id, slug: `group-${id}`, name: `Grupo ${id}` })).reverse(),
      organization_seasons: ids.map((id, i) => ({ ...annual, id, starts_at: `${1800 + i}-01-01`, ends_at: `${1800 + i}-12-31` })).reverse()
    });
    const reads = observePublicReads(fake.client); publicClient.mockReturnValue(reads.client);
    expect((await getPublicOrganizations()).map((row) => row.id)).toEqual(ids);
    const seasons = await getOrganizationSeasons(ORG_ID);
    expect(seasons).toHaveLength(1207);
    expect(seasons.filter((row) => row.status === "active").map((row) => row.startsAt)).toEqual(["2026-01-01"]);
    for (const table of ["organizations", "organization_seasons"]) {
      expect(reads.ranges.filter((row) => row.table === table).map((row) => [row.from, row.to])).toEqual([[0, 499], [500, 999], [1000, 1499]]);
    }
  });

  it("rolls current over at Buenos Aires midnight and keeps a missing year empty instead of using history", async () => {
    const reads = observePublicReads(annualData().client); publicClient.mockReturnValue(reads.client);
    vi.setSystemTime(new Date("2027-01-01T02:59:59Z"));
    expect((await getPlayersWithStats(ORG_ID))[0]).toMatchObject({ currentRating: 1080, matchesPlayed: 1, mvpCount: 1 });
    expect((await getMatchCalendarActivity(ORG_ID)).season?.id).toBe(annual.id);
    vi.setSystemTime(new Date("2027-01-01T03:00:00Z")); reads.tables.length = 0;
    expect((await getPlayersWithStats(ORG_ID))[0]).toMatchObject({ currentRating: 1000, matchesPlayed: 0, mvpCount: 0, goals: 0, assists: 0 });
    expect(reads.tables).toContain("matches"); // Current activity still needs historical appearances.
    reads.tables.length = 0;
    expect((await getMatchHistoryCardsPage(ORG_ID)).matches).toEqual([]);
    await expect(getMatchCalendarActivity(ORG_ID)).resolves.toEqual({ matches: [], season: null });
    expect(reads.tables).not.toContain("matches");
    const seasons = await getOrganizationSeasons(ORG_ID);
    expect(seasons[0]).toMatchObject({ id: "current", startsAt: "2027-01-01", endsAt: "2027-12-31", status: "active" });
    expect(seasons.slice(1).every((row) => row.status === "closed")).toBe(true);
    expect((await getHomeSummary(ORG_ID)).topPlayers[0].current_rating).toBe(1000);
    expect((await getRankingPlayers(ORG_ID))[0].current_rating).toBe(1000);
  });

  it("preserves explicit previous seasons and all-time data after rollover", async () => {
    publicClient.mockReturnValue(annualData().client); vi.setSystemTime(new Date("2027-01-01T03:00:00Z"));
    expect((await getPlayersWithStats(ORG_ID, { season: previous.id }))[0]).toMatchObject({ currentRating: 1120, matchesPlayed: 1, mvpCount: 1 });
    expect((await getPlayersWithStats(ORG_ID, { season: "all" }))[0]).toMatchObject({ currentRating: 1250, matchesPlayed: 2, mvpCount: 2 });
    expect((await getMatchHistoryCardsPage(ORG_ID, { season: "all" })).matches).toHaveLength(2);
    expect((await getMatchHistoryCardsPage(ORG_ID, { season: previous.id })).matches.map((row) => row.id)).toEqual(["previous-match"]);
    expect((await getPlayersWithStats(ORG_ID, { season: "missing-season" }))[0]).toMatchObject({ currentRating: 1000, matchesPlayed: 0 });
  });

  it("reads the source revision before rebuilding and sends only the authenticated CAS write", async () => {
    const reads = observePublicReads(annualData().client); publicClient.mockReturnValue(reads.client);
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    const from = vi.fn(() => { throw new Error("Snapshot writer attempted a table operation"); });
    authenticatedClient.mockResolvedValue({ rpc, from });
    await expect(refreshOrganizationPublicSnapshot(ORG_ID)).resolves.toBeNull();
    expect(reads.tables[0]).toBe("organizations");
    expect(reads.tables).not.toContain("players");
    expect(from).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledExactlyOnceWith("write_group_public_snapshot", expect.objectContaining({ p_organization_id: ORG_ID, p_expected_revision: 7 }));
    const candidate = rpc.mock.calls[0][1].p_payload;
    expect(candidate.summary.topPlayers[0].current_rating).toBe(1080);
    expect(candidate.standings[0]).toMatchObject({ currentRating: 1250, isInjured: true, isAbsent: false, matchesPlayed: 2 });
  });

  it("does not rebuild or write snapshots of inaccessible groups", async () => {
    const reads = observePublicReads(createFakeSupabase({ organizations: [{ ...organization, archived_at: "2026-12-01T00:00:00Z" }] }).client);
    publicClient.mockReturnValue(reads.client);
    await expect(refreshOrganizationPublicSnapshot(ORG_ID)).resolves.toBeNull();
    expect(reads.tables).toEqual(["organizations"]);
    expect(authenticatedClient).not.toHaveBeenCalled();
  });

  it("loads more than 1000 team members and guests and reuses the already fetched match", async () => {
    const ids = Array.from({ length: 1207 }, (_, i) => `member-${i}`);
    const fake = createFakeSupabase({ organizations: [organization],
      players: ids.map((id) => ({ ...player, id })),
      matches: [match("next", annual.id, { status: "confirmed", scheduled_at: "2027-01-02T20:00:00Z", confirmed_option_id: "next-option" })],
      team_options: [{ id: "next-option", match_id: "next", is_confirmed: true }],
      team_option_players: ids.map((id) => ({ team_option_id: "next-option", player_id: id, team: "A" })),
      match_guests: ids.map((id) => ({ id: `guest-${id}`, match_id: "next", guest_name: `Invitado ${id}`, guest_rating: 5 })),
      team_option_guests: ids.map((id) => ({ team_option_id: "next-option", guest_id: `guest-${id}`, team: "B" }))
    });
    const reads = observePublicReads(fake.client); publicClient.mockReturnValue(reads.client);
    const upcoming = await getUpcomingConfirmedMatches(ORG_ID);
    expect(upcoming[0].teamAPlayers).toHaveLength(1207); expect(upcoming[0].teamBPlayers).toHaveLength(1207);
    expect(reads.tables.filter((table) => table === "matches")).toHaveLength(1);
    reads.tables.length = 0;
    const details = await getMatchDetails("next");
    expect(details?.teamAPlayers).toHaveLength(1207); expect(details?.teamBPlayers).toHaveLength(1207);
    expect(reads.tables.filter((table) => table === "matches")).toHaveLength(1);
    expect(authenticatedClient).not.toHaveBeenCalled();
  });
});
