import { describe, expect, it } from "vitest";

import { calculatePlayerStats } from "@/lib/domain/stats";
import type { Database } from "@/types/database";

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
});
