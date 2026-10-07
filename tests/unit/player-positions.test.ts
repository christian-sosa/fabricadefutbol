import { describe, expect, it } from "vitest";
import { assignPlayersToPositions, getFormationRoles, getPlayerPositionCost, getPlayerPositionFit, playerPositionSchema, supportsPositionBalancing, type PositionPreferences } from "@/lib/domain/player-positions";
import type { PlayerPosition } from "@/types/domain";

describe("player position preferences", () => {
  it("accepts only the four nullable optional positions with Spanish errors", () => {
    for (const position of ["GK", "DEF", "MID", "FWD", null, undefined]) expect(playerPositionSchema.safeParse(position).success).toBe(true);
    for (const position of ["", "WING", "def", 1, {}]) {
      const parsed = playerPositionSchema.safeParse(position);
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(parsed.error.issues[0].message).toBe("Seleccioná una posición válida.");
    }
  });
  it("balances positions only for F9, F10 and F11", () => {
    for (const modality of ["9v9", "10v10", "11v11"]) expect(supportsPositionBalancing(modality)).toBe(true);
    for (const modality of ["5v5", "6v6", "7v7", "8v8", "constructor", "__proto__", ""]) expect(supportsPositionBalancing(modality)).toBe(false);
  });
  it("prioritizes selected keepers, primary, secondary, flexible and fallback in that order", () => {
    const player: PositionPreferences = { preferredPosition: "DEF", secondaryPosition: "MID" };
    expect(getPlayerPositionFit(player, "DEF")).toBe("preferred");
    expect(getPlayerPositionFit(player, "MID")).toBe("secondary");
    expect(getPlayerPositionFit({}, "DEF")).toBe("flexible");
    expect(getPlayerPositionFit(player, "FWD")).toBe("fallback");
    expect(getPlayerPositionFit({ ...player, isGoalkeeper: true }, "GK")).toBe("preferred");
    expect(getPlayerPositionFit({ ...player, isGoalkeeper: true }, "DEF")).toBe("fallback");
    expect(getFormationRoles("4-2-3-1")).toEqual(["GK", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "MID", "MID", "FWD"]);
    for (const formation of ["x-y", "1", "4-0-2", "11-1", "1.5-2", "-1-2"]) expect(getFormationRoles(formation)).toEqual([]);
  });
  it("assigns secondary positions without taking another player's only primary role", () => {
    const flexible = { id: "flexible", preferredPosition: "DEF" as const, secondaryPosition: "MID" as const };
    const defender = { id: "defender", preferredPosition: "DEF" as const };
    expect(assignPlayersToPositions([flexible, defender], ["DEF", "MID"])).toEqual({ assignments: [defender, flexible], cost: 1 });
  });
  it("always assigns a selected keeper even if another player prefers GK and extras exist", () => {
    const players = [{ id: "stored", preferredPosition: "GK" as const },
      { id: "selected", preferredPosition: "FWD" as const, isGoalkeeper: true },
      { id: "forward", preferredPosition: "FWD" as const }];
    expect(assignPlayersToPositions(players, ["GK", "FWD"]).assignments).toEqual([players[1], players[2]]);
  });
  it("returns complete, deterministic, unique fallback assignments and handles missing players", () => {
    const players = Array.from({ length: 5 }, (_, id) => ({ id, preferredPosition: "FWD" as const }));
    const positions: PlayerPosition[] = ["GK", "DEF", "DEF", "MID", "FWD"];
    const result = assignPlayersToPositions(players, positions);
    expect(new Set(result.assignments.map((player) => player?.id)).size).toBe(5);
    expect(result.cost).toBe(48);
    expect(assignPlayersToPositions(players, positions)).toEqual(result);
    expect(assignPlayersToPositions([], [])).toEqual({ assignments: [], cost: 0 });
    expect(assignPlayersToPositions([], ["GK"]).assignments).toEqual([null]);
    expect(assignPlayersToPositions(players.slice(0, 2), positions).assignments.filter(Boolean)).toHaveLength(2);
  });
  it("matches exhaustive minimum assignment across adversarial preference combinations", () => {
    const positions: PlayerPosition[] = ["GK", "DEF", "MID", "FWD"];
    const profiles: PositionPreferences[] = [{}, { preferredPosition: "DEF" }, { preferredPosition: "FWD", secondaryPosition: "DEF" },
      { preferredPosition: "GK", secondaryPosition: "MID" }, { preferredPosition: "MID", secondaryPosition: "FWD" }];
    for (let seed = 0; seed < 20; seed += 1) {
      const roster = positions.map((_, index) => profiles[(seed * (index + 1) + index) % profiles.length]);
      let best = Infinity;
      const visit = (remaining: PositionPreferences[], row: number, cost: number) => {
        if (!remaining.length) { best = Math.min(best, cost); return; }
        for (let index = 0; index < remaining.length; index += 1) visit(remaining.filter((_, other) => index !== other), row + 1, cost + getPlayerPositionCost(remaining[index], positions[row]));
      };
      visit(roster, 0, 0);
      expect(assignPlayersToPositions(roster, positions).cost).toBe(best);
    }
  });
});
