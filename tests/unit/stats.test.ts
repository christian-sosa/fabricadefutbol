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
});
