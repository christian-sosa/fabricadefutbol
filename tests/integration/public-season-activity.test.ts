import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { publicClient } = vi.hoisted(() => ({ publicClient: vi.fn() }));
vi.mock("@/lib/supabase/public", () => ({ createSupabasePublicClient: publicClient }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/cache", () => ({ unstable_noStore: vi.fn() }));

import { getPlayersWithStats } from "@/lib/queries/public";
import type { PlayerComputedStats } from "@/types/domain";
import { createFakeSupabase } from "../helpers/fake-supabase";

const ORG_ID = "season-activity-group";
const SEASON_ID = "season-2026";

function activityFixture({ persistedSeason = true, december = false } = {}) {
  const earlierDate = december ? "2026-12-29T21:00:00Z" : "2026-09-30T21:00:00Z";
  const latestDate = december ? "2026-12-30T21:00:00Z" : "2026-10-01T21:00:00Z";
  const seasonId = persistedSeason ? SEASON_ID : null;

  return createFakeSupabase({
    players: [
      { id: "player-one", organization_id: ORG_ID, full_name: "Jugador uno", initial_rank: 1, current_rating: 1230, active: true, created_at: "2026-01-01T12:00:00Z" },
      { id: "player-two", organization_id: ORG_ID, full_name: "Jugador dos", initial_rank: 2, current_rating: 1080, active: true, created_at: "2026-01-01T12:00:00Z" },
      { id: "player-new", organization_id: ORG_ID, full_name: "Sin debut", initial_rank: 3, current_rating: 1000, active: true, created_at: "2026-01-01T12:00:00Z" }
    ],
    organization_seasons: persistedSeason ? [{
      id: SEASON_ID, organization_id: ORG_ID, label: "Temporada 2026", duration_months: 12,
      starts_at: "2026-01-01", ends_at: "2026-12-31", status: "active"
    }] : [],
    organization_season_player_ratings: persistedSeason ? [
      { season_id: SEASON_ID, player_id: "player-one", current_rating: 1100 },
      { season_id: SEASON_ID, player_id: "player-two", current_rating: 1050 }
    ] : [],
    matches: [
      { id: "earlier-match", organization_id: ORG_ID, season_id: seasonId, scheduled_at: earlierDate, modality: "5v5", status: "finished" },
      { id: "latest-match", organization_id: ORG_ID, season_id: seasonId, scheduled_at: latestDate, modality: "5v5", status: "finished" }
    ],
    team_options: [
      { id: "earlier-option", match_id: "earlier-match", is_confirmed: true },
      { id: "latest-option", match_id: "latest-match", is_confirmed: true }
    ],
    team_option_players: [
      { team_option_id: "earlier-option", player_id: "player-one", team: "A" },
      { team_option_id: "latest-option", player_id: "player-two", team: "A" }
    ],
    match_result: [
      { match_id: "earlier-match", winner_team: "A", score_a: 2, score_b: 0, mvp_player_id: "player-one" },
      { match_id: "latest-match", winner_team: "A", score_a: 1, score_b: 0, mvp_player_id: "player-two" }
    ],
    match_player_stats: [
      { id: "earlier-stats", match_id: "earlier-match", player_id: "player-one", goals: 2, assists: 1 },
      { id: "latest-stats", match_id: "latest-match", player_id: "player-two", goals: 1, assists: 0 }
    ]
  });
}

function activityByPlayer(players: PlayerComputedStats[]) {
  return [...players].sort((left, right) => left.playerId.localeCompare(right.playerId)).map((player) => ({
    playerId: player.playerId,
    lastPlayedAt: player.lastPlayedAt,
    matchesSinceLastPlayed: player.matchesSinceLastPlayed,
    isAbsent: player.isAbsent,
    isInjured: player.isInjured
  }));
}

function expectEmptySeasonStats(players: PlayerComputedStats[]) {
  expect(players).toHaveLength(3);
  for (const player of players) {
    expect(player).toMatchObject({
      currentRating: 1000, matchesPlayed: 0, wins: 0, draws: 0, losses: 0,
      mvpCount: 0, goals: 0, assists: 0, recentResults: []
    });
  }
}

describe("player activity when the selected season is missing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T15:00:00Z"));
    publicClient.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("keeps recent historical activity with an empty current season", async () => {
    publicClient.mockReturnValue(activityFixture({ persistedSeason: false }).client);

    const historical = await getPlayersWithStats(ORG_ID, { season: "all" });
    const current = await getPlayersWithStats(ORG_ID, { season: "current" });

    expect(historical.find((player) => player.playerId === "player-one")).toMatchObject({
      lastPlayedAt: "2026-09-30T21:00:00Z", matchesSinceLastPlayed: 1, isAbsent: false
    });
    expect(historical.find((player) => player.playerId === "player-new")).toMatchObject({ lastPlayedAt: null, isAbsent: true });
    expectEmptySeasonStats(current);
    expect(activityByPlayer(current)).toEqual(activityByPlayer(historical));
  });

  it("resets seasonal points at Buenos Aires rollover while preserving current activity", async () => {
    publicClient.mockReturnValue(activityFixture({ december: true }).client);
    vi.setSystemTime(new Date("2027-01-01T02:59:59Z"));
    const beforeRollover = await getPlayersWithStats(ORG_ID, { season: "current" });
    expect(beforeRollover.find((player) => player.playerId === "player-one")).toMatchObject({
      currentRating: 1100, matchesPlayed: 1, mvpCount: 1, goals: 2, isAbsent: false
    });

    vi.setSystemTime(new Date("2027-01-01T03:00:00Z"));
    const afterRollover = await getPlayersWithStats(ORG_ID, { season: "current" });
    const historical = await getPlayersWithStats(ORG_ID, { season: "all" });

    expectEmptySeasonStats(afterRollover);
    expect(activityByPlayer(afterRollover)).toEqual(activityByPlayer(beforeRollover));
    expect(activityByPlayer(afterRollover)).toEqual(activityByPlayer(historical));
  });

  it("keeps current activity for an unknown season ID without borrowing seasonal points", async () => {
    publicClient.mockReturnValue(activityFixture().client);

    const existingSeason = await getPlayersWithStats(ORG_ID, { season: SEASON_ID });
    const unknownSeason = await getPlayersWithStats(ORG_ID, { season: "missing-season" });

    expect(existingSeason.find((player) => player.playerId === "player-two")).toMatchObject({
      currentRating: 1050, matchesPlayed: 1, mvpCount: 1, isAbsent: false
    });
    expectEmptySeasonStats(unknownSeason);
    expect(activityByPlayer(unknownSeason)).toEqual(activityByPlayer(existingSeason));
  });

  it("keeps injured players exempt from inactivity across historical, current and missing seasons", async () => {
    const fake = activityFixture();
    await fake.client.from("players").update({ is_injured: true }).in("id", ["player-one", "player-new"]);
    publicClient.mockReturnValue(fake.client);
    vi.setSystemTime(new Date("2026-11-02T15:00:00Z"));

    const standings = await Promise.all(["all", "current", SEASON_ID, "missing-season"].map((season) => getPlayersWithStats(ORG_ID, { season })));
    for (const players of standings) {
      expect(players.find((player) => player.playerId === "player-one")).toMatchObject({
        isInjured: true, isAbsent: false, lastPlayedAt: "2026-09-30T21:00:00Z", matchesSinceLastPlayed: 1
      });
      expect(players.find((player) => player.playerId === "player-new")).toMatchObject({ isInjured: true, isAbsent: false, lastPlayedAt: null });
      expect(players.find((player) => player.playerId === "player-two")).toMatchObject({ isInjured: false, isAbsent: true });
    }
    expect(standings[0].find((player) => player.playerId === "player-one")).toMatchObject({ currentRating: 1230, matchesPlayed: 1, mvpCount: 1 });
    expect(standings[1].find((player) => player.playerId === "player-one")).toMatchObject({ currentRating: 1100, matchesPlayed: 1, mvpCount: 1 });
    expectEmptySeasonStats(standings[3]);
  });
});
