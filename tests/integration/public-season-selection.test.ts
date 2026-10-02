import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { publicClient } = vi.hoisted(() => ({ publicClient: vi.fn() }));
vi.mock("@/lib/supabase/public", () => ({ createSupabasePublicClient: publicClient }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/cache", () => ({ unstable_noStore: vi.fn() }));

import {
  getMatchCalendarActivity,
  getMatchHistoryCardsPage,
  getOrganizationSeasons,
  getPlayersWithStats
} from "@/lib/queries/public";
import { createFakeSupabase } from "../helpers/fake-supabase";

const ORG_ID = "group-local";
const legacy = {
  id: "legacy-2026",
  organization_id: ORG_ID,
  label: "Temporada 2026",
  duration_months: 9,
  starts_at: "2026-04-04",
  ends_at: "2026-12-31",
  status: "active"
};
const previous = {
  ...legacy,
  id: "previous-2025",
  label: "Temporada 2025",
  starts_at: "2025-04-04",
  ends_at: "2025-12-31",
  status: "closed"
};
type SeasonRow = typeof legacy;

function seasonPlayerId(season: SeasonRow) {
  return season.organization_id === ORG_ID ? "player-local" : `player-${season.organization_id}`;
}

function seedSeasonData(seasons: SeasonRow[] = [legacy, previous]) {
  const fake = createFakeSupabase({
    organization_seasons: seasons,
    players: [...new Set(seasons.map((season) => season.organization_id))].map((organizationId) => ({
      id: organizationId === ORG_ID ? "player-local" : `player-${organizationId}`,
      organization_id: organizationId,
      full_name: "Jugador",
      initial_rank: 1, current_rating: 1250, active: true
    })),
    organization_season_player_ratings: seasons.map((season, index) => ({
      organization_id: season.organization_id,
      season_id: season.id,
      player_id: seasonPlayerId(season),
      current_rating: 1080 + index * 20
    })),
    matches: seasons.map((season) => ({
      id: `match-${season.id}`,
      organization_id: season.organization_id,
      season_id: season.id,
      scheduled_at: `${season.id === legacy.id ? "2026-10-01" : season.starts_at}T21:00:00Z`,
      modality: "5v5",
      status: "finished"
    })),
    team_options: seasons.map((season) => ({
      id: `option-${season.id}`, match_id: `match-${season.id}`, is_confirmed: true
    })),
    team_option_players: seasons.map((season) => ({
      team_option_id: `option-${season.id}`, player_id: seasonPlayerId(season), team: "A"
    })),
    match_result: seasons.map((season) => ({
      match_id: `match-${season.id}`, winner_team: "A", score_a: 2, score_b: 0,
      mvp_player_id: seasonPlayerId(season)
    }))
  });
  publicClient.mockReturnValue(fake.client);
  return fake;
}

describe("public current season selection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T16:00:00Z"));
    publicClient.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("uses a legacy April opening as the single current 2026 season across ranking, history and calendar", async () => {
    seedSeasonData();

    const seasons = await getOrganizationSeasons(ORG_ID);
    expect(seasons.filter((season) => season.label === "Temporada 2026")).toEqual([{
      id: legacy.id,
      label: legacy.label,
      durationMonths: legacy.duration_months,
      startsAt: legacy.starts_at,
      endsAt: legacy.ends_at,
      status: "active"
    }]);
    expect(seasons.some((season) => season.id === "current")).toBe(false);

    const currentStandings = await getPlayersWithStats(ORG_ID, { season: "current" });
    expect(currentStandings).toEqual(await getPlayersWithStats(ORG_ID, { season: legacy.id }));
    expect(currentStandings[0]).toMatchObject({ currentRating: 1080, matchesPlayed: 1, mvpCount: 1 });
    expect(await getMatchHistoryCardsPage(ORG_ID, { season: "current" }))
      .toEqual(await getMatchHistoryCardsPage(ORG_ID, { season: legacy.id }));
    expect(await getMatchCalendarActivity(ORG_ID))
      .toEqual(await getMatchCalendarActivity(ORG_ID, legacy.id));
    expect((await getMatchCalendarActivity(ORG_ID)).matches.map((match) => match.id))
      .toEqual([`match-${legacy.id}`]);
  });

  it("recognizes a closed row covering today and ignores a stale historical active status", async () => {
    seedSeasonData([{ ...legacy, status: "closed" }, { ...previous, status: "active" }]);

    expect((await getOrganizationSeasons(ORG_ID)).filter((season) => season.status === "active")
      .map((season) => season.id)).toEqual([legacy.id]);
    expect((await getMatchCalendarActivity(ORG_ID)).season?.id).toBe(legacy.id);
    expect((await getPlayersWithStats(ORG_ID))[0].currentRating).toBe(1080);
  });

  it("keeps a future opening out of current selection even when its stored status is active", async () => {
    const future = { ...legacy, id: "future", label: "Temporada futura", starts_at: "2026-11-01" };
    seedSeasonData([{ ...legacy, status: "closed" }, future]);

    const seasons = await getOrganizationSeasons(ORG_ID);
    expect(seasons.filter((season) => season.status === "active").map((season) => season.id))
      .toEqual([legacy.id]);
    expect(seasons.find((season) => season.id === future.id)?.status).toBe("closed");
    expect((await getMatchCalendarActivity(ORG_ID)).season?.id).toBe(legacy.id);
  });

  it("selects the latest opening when current ranges overlap rather than preferring January or stored status", async () => {
    const annual = { ...legacy, id: "annual", starts_at: "2026-01-01" };
    const latest = { ...legacy, id: "latest", starts_at: "2026-09-01", status: "closed" };
    seedSeasonData([annual, legacy, latest]);

    expect((await getOrganizationSeasons(ORG_ID)).filter((season) => season.status === "active")
      .map((season) => season.id)).toEqual([latest.id]);
    expect((await getMatchCalendarActivity(ORG_ID)).season?.id).toBe(latest.id);
    expect((await getPlayersWithStats(ORG_ID))[0].currentRating).toBe(1120);
    expect((await getMatchHistoryCardsPage(ORG_ID)).matches.map((match) => match.id))
      .toEqual([`match-${latest.id}`]);
  });

  it("uses ascending IDs to resolve equal opening dates consistently", async () => {
    const laterId = { ...legacy, id: "z-season", starts_at: "2026-09-01" };
    const earlierId = { ...laterId, id: "a-season", status: "closed" };
    seedSeasonData([laterId, earlierId]);

    expect((await getOrganizationSeasons(ORG_ID)).filter((season) => season.status === "active")
      .map((season) => season.id)).toEqual([earlierId.id]);
    expect((await getMatchCalendarActivity(ORG_ID)).season?.id).toBe(earlierId.id);
  });

  it("isolates both current resolution and explicit IDs to the selected group", async () => {
    const foreign = {
      ...legacy, id: "foreign-current", organization_id: "other-group", starts_at: "2026-10-02"
    };
    seedSeasonData([legacy, foreign]);

    expect((await getOrganizationSeasons(ORG_ID)).map((season) => season.id)).toEqual([legacy.id]);
    expect((await getMatchCalendarActivity(ORG_ID)).season?.id).toBe(legacy.id);
    expect((await getMatchHistoryCardsPage(ORG_ID)).matches.map((match) => match.id))
      .toEqual([`match-${legacy.id}`]);
    expect(await getMatchCalendarActivity(ORG_ID, foreign.id)).toEqual({ matches: [], season: null });
  });

  it.each(["2026-04-04T03:00:00Z", "2027-01-01T02:59:59Z"])(
    "includes the legacy range's first and last Buenos Aires date at %s",
    async (now) => {
      seedSeasonData();
      vi.setSystemTime(new Date(now));

      expect((await getOrganizationSeasons(ORG_ID)).filter((season) => season.status === "active")
        .map((season) => season.id)).toEqual([legacy.id]);
      expect((await getMatchCalendarActivity(ORG_ID)).season?.id).toBe(legacy.id);
    }
  );
});
