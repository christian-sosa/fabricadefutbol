import { describe, expect, it } from "vitest";

import { calculatePlayerStats, type MatchWithTeams } from "@/lib/domain/stats";
import type { Database } from "@/types/database";
import type { WinnerTeam } from "@/types/domain";

type PlayerRow = Database["public"]["Tables"]["players"]["Row"];

function buildPlayer(overrides: Partial<PlayerRow> & Pick<PlayerRow, "id" | "full_name">): PlayerRow {
  const { id, full_name: fullName, ...rest } = overrides;
  return {
    active: true,
    created_at: "2026-04-25T00:00:00.000Z",
    current_rating: 1000,
    display_order: 1,
    full_name: fullName,
    id,
    initial_rank: 1,
    notes: null,
    organization_id: "org-1",
    skill_level: 3,
    updated_at: "2026-04-25T00:00:00.000Z",
    ...rest
  };
}

function buildFinishedMatch(params: {
  id: string;
  scheduledAt: string;
  winnerTeam: WinnerTeam;
  teamAPlayerIds?: string[];
  teamBPlayerIds?: string[];
  withResult?: boolean;
}): MatchWithTeams {
  const { id, scheduledAt, winnerTeam, teamAPlayerIds = ["player-a"], teamBPlayerIds = ["player-b"] } = params;

  return {
    match: {
      id,
      organization_id: "org-1",
      scheduled_at: scheduledAt,
      modality: "5v5",
      status: "finished",
      confirmed_option_id: `option-${id}`,
      created_at: "2026-04-01T00:00:00.000Z",
      created_by: "admin-1",
      finished_at: scheduledAt,
      location: null,
      season_id: "season-1",
      team_a_label: null,
      team_b_label: null,
      updated_at: scheduledAt
    },
    result:
      params.withResult === false
        ? null
        : {
            id: `result-${id}`,
            match_id: id,
            created_by: "admin-1",
            score_a: winnerTeam === "A" ? 2 : winnerTeam === "DRAW" ? 1 : 0,
            score_b: winnerTeam === "B" ? 2 : winnerTeam === "DRAW" ? 1 : 0,
            winner_team: winnerTeam,
            mvp_player_id: null,
            mvp_guest_id: null,
            mvp_display_name: null,
            notes: null,
            created_at: scheduledAt,
            updated_at: scheduledAt
          },
    teamAPlayerIds,
    teamBPlayerIds
  };
}

describe("calculatePlayerStats", () => {
  it("desempata el ranking publico por partidos, nivel y orden visual despues del rating", () => {
    const stats = calculatePlayerStats({
      players: [
        buildPlayer({ id: "player-a", full_name: "Ariel", skill_level: 2, display_order: 1 }),
        buildPlayer({ id: "player-b", full_name: "Beto", skill_level: 1, display_order: 4 }),
        buildPlayer({ id: "player-c", full_name: "Carlos", skill_level: 1, display_order: 2 })
      ],
      finishedMatches: []
    });

    expect(stats.map((player) => player.playerId)).toEqual(["player-c", "player-b", "player-a"]);
  });

  it("cuenta MVP registrados en los partidos terminados", () => {
    const stats = calculatePlayerStats({
      players: [
        buildPlayer({ id: "player-a", full_name: "Ariel" }),
        buildPlayer({ id: "player-b", full_name: "Beto" })
      ],
      finishedMatches: [
        {
          match: {
            id: "match-1",
            organization_id: "org-1",
            scheduled_at: "2026-04-25T20:00:00.000Z",
            modality: "5v5",
            status: "finished",
            confirmed_option_id: "option-1",
            created_at: "2026-04-25T00:00:00.000Z",
            created_by: "admin-1",
            finished_at: "2026-04-25T22:00:00.000Z",
            location: null,
            season_id: "season-1",
            team_a_label: null,
            team_b_label: null,
            updated_at: "2026-04-25T22:00:00.000Z"
          },
          result: {
            id: "result-1",
            match_id: "match-1",
            created_by: "admin-1",
            score_a: 2,
            score_b: 1,
            winner_team: "A",
            mvp_player_id: "player-a",
            mvp_guest_id: null,
            mvp_display_name: "Ariel",
            notes: null,
            created_at: "2026-04-25T22:00:00.000Z",
            updated_at: "2026-04-25T22:00:00.000Z"
          },
          teamAPlayerIds: ["player-a"],
          teamBPlayerIds: ["player-b"]
        }
      ]
    });

    expect(stats.find((player) => player.playerId === "player-a")?.mvpCount).toBe(1);
    expect(stats.find((player) => player.playerId === "player-b")?.mvpCount).toBe(0);
  });

  it("expone solo los cinco resultados mas recientes en orden cronologico", () => {
    const chronologicalMatches = [
      buildFinishedMatch({ id: "match-1", scheduledAt: "2026-04-01T20:00:00.000Z", winnerTeam: "A" }),
      buildFinishedMatch({ id: "match-2", scheduledAt: "2026-04-02T20:00:00.000Z", winnerTeam: "DRAW" }),
      buildFinishedMatch({ id: "match-3", scheduledAt: "2026-04-03T20:00:00.000Z", winnerTeam: "B" }),
      buildFinishedMatch({ id: "match-4", scheduledAt: "2026-04-04T20:00:00.000Z", winnerTeam: "A" }),
      buildFinishedMatch({ id: "match-5", scheduledAt: "2026-04-05T20:00:00.000Z", winnerTeam: "B" }),
      buildFinishedMatch({ id: "match-6", scheduledAt: "2026-04-06T20:00:00.000Z", winnerTeam: "DRAW" }),
      buildFinishedMatch({ id: "match-7", scheduledAt: "2026-04-07T20:00:00.000Z", winnerTeam: "A" })
    ];
    const ignoredMatchWithoutResult = buildFinishedMatch({
      id: "match-8",
      scheduledAt: "2026-04-08T20:00:00.000Z",
      winnerTeam: "B",
      withResult: false
    });

    const stats = calculatePlayerStats({
      players: [
        buildPlayer({ id: "player-a", full_name: "Ariel" }),
        buildPlayer({ id: "player-b", full_name: "Beto" }),
        buildPlayer({ id: "player-c", full_name: "Carlos" })
      ],
      finishedMatches: [
        chronologicalMatches[6],
        chronologicalMatches[1],
        ignoredMatchWithoutResult,
        chronologicalMatches[4],
        chronologicalMatches[0],
        chronologicalMatches[5],
        chronologicalMatches[2],
        chronologicalMatches[3]
      ]
    });

    expect(stats.find((player) => player.playerId === "player-a")?.recentResults).toEqual(["D", "V", "D", "E", "V"]);
    expect(stats.find((player) => player.playerId === "player-b")?.recentResults).toEqual(["V", "D", "V", "E", "D"]);
    expect(stats.find((player) => player.playerId === "player-c")?.recentResults).toEqual([]);
  });
});
