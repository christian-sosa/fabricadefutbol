import { describe, expect, it } from "vitest";
import { FORMATION_PRESETS, assignFormationPlayer, changeFormationPreset, createTeamFormation, getFormationPositions, readMatchFormation, toFormationPlayers, validateMatchFormation, type FormationModality, type FormationPlayer, type MatchFormation } from "@/lib/domain/match-formation";

const players = (team: string, size: number): FormationPlayer[] => Array.from({ length: size }, (_, i) => ({ participantId: `${i === size - 1 ? "guest" : "player"}:${team}-${i}`, name: `${team} ${i}`, isGoalkeeper: i === 0 }));
const complete = (preset: string, team: FormationPlayer[]) => ({ formationId: preset, slots: getFormationPositions(preset).map((position, i) => ({ slotId: position.slotId, participantId: team[i].participantId })) });

describe("match formation", () => {
  for (const modality of Object.keys(FORMATION_PRESETS) as FormationModality[]) {
    it.each(FORMATION_PRESETS[modality])(`validates all positions, keeper and guest for ${modality} %s`, (preset) => {
      const size = modality === "9v9" ? 9 : 11;
      const teams = { teamA: players("A", size), teamB: players("B", size) };
      const formation = { teamA: complete(preset, teams.teamA), teamB: complete(preset, teams.teamB) };
      expect(validateMatchFormation(formation, modality, teams)).toEqual(formation);
      expect(getFormationPositions(preset)).toHaveLength(size);
    });
  }
  const teams = { teamA: players("A", 9), teamB: players("B", 9) };
  const formation = (): MatchFormation => ({ teamA: complete("3-3-2", teams.teamA), teamB: complete("4-2-2", teams.teamB) });
  it("preselects only the confirmed goalkeeper", () => {
    expect(createTeamFormation("9v9", teams.teamA).slots.filter((slot) => slot.participantId)).toEqual([{ slotId: "gk", participantId: "player:A-0" }]);
  });
  it("retains every assignment and goalkeeper when changing shape", () => {
    const changed = changeFormationPreset(formation().teamA, "4-3-1");
    expect(changed.slots.map((slot) => slot.participantId)).toEqual(teams.teamA.map((p) => p.participantId));
    expect(changed.slots.map((slot) => slot.slotId)).toEqual(getFormationPositions("4-3-1").map((slot) => slot.slotId));
  });
  it("moving a player frees their previous position and removing returns them to the pool", () => {
    const changed = assignFormationPlayer(formation().teamA, "line-0-1", "player:A-1");
    expect(changed.slots.find((slot) => slot.slotId === "line-0-0")?.participantId).toBeNull();
    expect(changed.slots.find((slot) => slot.slotId === "line-0-1")?.participantId).toBe("player:A-1");
    expect(assignFormationPlayer(changed, "line-0-1", null).slots.filter((slot) => slot.participantId === "player:A-1")).toHaveLength(0);
  });
  it("rejects incomplete, duplicated, foreign or invalid positions and goalkeeper changes", () => {
    for (const mutate of [
      (value: MatchFormation) => { value.teamA.slots[1].participantId = null; },
      (value: MatchFormation) => { value.teamA.slots[1].participantId = value.teamA.slots[2].participantId; },
      (value: MatchFormation) => { value.teamA.slots[1].participantId = teams.teamB[1].participantId; },
      (value: MatchFormation) => { value.teamA.slots[1].slotId = "foreign-slot"; },
      (value: MatchFormation) => { [value.teamA.slots[0].participantId, value.teamA.slots[1].participantId] = [value.teamA.slots[1].participantId, value.teamA.slots[0].participantId]; }
    ]) {
      const value = formation(); mutate(value);
      expect(() => validateMatchFormation(value, "9v9", teams)).toThrow();
      expect(readMatchFormation(value, "9v9", teams)).toBeNull();
    }
  });
  it("falls back to lists for unsupported modalities and stale roster data", () => {
    expect(readMatchFormation(formation(), "5v5", teams)).toBeNull();
    expect(readMatchFormation(formation(), "9v9", { ...teams, teamA: teams.teamA.slice(1) })).toBeNull();
    expect(readMatchFormation(null, "9v9", teams)).toBeNull();
  });
  it("normalizes public and admin guest IDs without including ratings", () => {
    expect(toFormationPlayers([{ id: "guest-abc", full_name: "Visita", is_guest: true }, { id: "abc", full_name: "Arco" }], ["abc"])).toEqual([
      { participantId: "guest:abc", name: "Visita", isGoalkeeper: false }, { participantId: "player:abc", name: "Arco", isGoalkeeper: true }
    ]);
  });
});
