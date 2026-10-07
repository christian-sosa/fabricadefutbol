import { describe, expect, it } from "vitest";
import { FORMATION_PRESETS, assignFormationPlayer, changeFormationPreset, createTeamFormation, getFormationPositions, getFormationSlotPosition, readMatchFormation, supportsMatchFormation, toFormationPlayers, validateMatchFormation, type FormationModality, type FormationPlayer, type MatchFormation } from "@/lib/domain/match-formation";
import { getPlayerPositionFit } from "@/lib/domain/player-positions";
import { MATCH_MODALITIES, TEAM_SIZE_BY_MODALITY } from "@/lib/constants";

const players = (team: string, size: number): FormationPlayer[] => Array.from({ length: size }, (_, i) => ({ participantId: `${i === size - 1 ? "guest" : "player"}:${team}-${i}`, name: `${team} ${i}`, isGoalkeeper: i === 0 }));
const complete = (preset: string, team: FormationPlayer[]) => ({ formationId: preset, slots: getFormationPositions(preset).map((position, i) => ({ slotId: position.slotId, participantId: team[i].participantId })) });

describe("match formation", () => {
  it("permite elegir los nueve en cancha de un plantel con suplentes sin duplicar jugadores", () => {
    const teams = { teamA: players("A", 10), teamB: players("B", 11) };
    const formation = { teamA: complete("3-3-2", teams.teamA), teamB: complete("3-3-2", teams.teamB) };
    expect(validateMatchFormation(formation, "9v9", teams)).toEqual(formation);
    const duplicate = { ...teams, teamA: [...teams.teamA, teams.teamA[0]] };
    expect(() => validateMatchFormation(formation, "9v9", duplicate)).toThrow("Los equipos cambiaron");
  });
  it("supports the full modality catalog without introducing F8 or object prototype names", () => {
    expect(Object.keys(FORMATION_PRESETS)).toEqual(MATCH_MODALITIES);
    for (const modality of MATCH_MODALITIES) expect(supportsMatchFormation(modality)).toBe(true);
    for (const modality of ["8v8", "12v12", "", "constructor", "__proto__"]) {
      expect(supportsMatchFormation(modality)).toBe(false);
      expect(() => validateMatchFormation({}, modality, { teamA: [], teamB: [] })).toThrow("La modalidad del partido no admite formaciones.");
    }
  });
  for (const modality of Object.keys(FORMATION_PRESETS) as FormationModality[]) {
    it.each(FORMATION_PRESETS[modality])(`validates all positions, keeper and guest for ${modality} %s`, (preset) => {
      const size = TEAM_SIZE_BY_MODALITY[modality];
      const teams = { teamA: players("A", size), teamB: players("B", size) };
      const formation = { teamA: complete(preset, teams.teamA), teamB: complete(preset, teams.teamB) };
      expect(validateMatchFormation(formation, modality, teams)).toEqual(formation);
      expect(getFormationPositions(preset)).toHaveLength(size);
    });
    it(`keeps all ${modality} players when switching every available scheme`, () => {
      const roster = players("A", TEAM_SIZE_BY_MODALITY[modality]);
      let formation: MatchFormation["teamA"] = complete(FORMATION_PRESETS[modality][0], roster);
      for (const preset of FORMATION_PRESETS[modality]) {
        formation = changeFormationPreset(formation, preset);
        expect(formation.slots.map((slot) => slot.participantId)).toEqual(roster.map((player) => player.participantId));
        expect(formation.slots[0]).toEqual({ slotId: "gk", participantId: "player:A-0" });
      }
    });
  }
  it("places every preset inside the pitch with unique positions and enough row separation", () => {
    for (const preset of Object.values(FORMATION_PRESETS).flat()) {
      const positions = getFormationPositions(preset);
      expect(new Set(positions.map(({ slotId }) => slotId)).size).toBe(positions.length);
      for (const position of positions) {
        expect(position.x).toBeGreaterThanOrEqual(6);
        expect(position.x).toBeLessThanOrEqual(94);
        expect(position.y).toBeGreaterThanOrEqual(15);
        expect(position.y).toBeLessThanOrEqual(88);
      }
      const rows = [...new Set(positions.map(({ y }) => y))].sort((a, b) => a - b);
      for (let index = 1; index < rows.length; index += 1) expect(rows[index] - rows[index - 1]).toBeGreaterThanOrEqual(18);
    }
  });
  const teams = { teamA: players("A", 9), teamB: players("B", 9) };
  const formation = (): MatchFormation => ({ teamA: complete("3-3-2", teams.teamA), teamB: complete("4-2-2", teams.teamB) });
  it.each(["5v5", "6v6", "7v7"] as const)("preselects only the confirmed goalkeeper for %s", (modality) => {
    expect(createTeamFormation(modality, players("A", TEAM_SIZE_BY_MODALITY[modality])).slots.filter((slot) => slot.participantId)).toEqual([{ slotId: "gk", participantId: "player:A-0" }]);
  });
  it.each([["9v9", "3-3-2"], ["10v10", "3-4-2"], ["11v11", "4-3-3"]] as const)("completes recommended %s %s without preferences or duplicate players", (modality, preset) => {
    const roster = players("A", TEAM_SIZE_BY_MODALITY[modality]);
    const created = createTeamFormation(modality, roster);
    expect(created.formationId).toBe(preset);
    expect(created.slots[0].participantId).toBe(roster[0].participantId);
    expect(new Set(created.slots.map((slot) => slot.participantId))).toEqual(new Set(roster.map((player) => player.participantId)));
    expect(createTeamFormation(modality, roster)).toEqual(created);
  });
  it("reserves the sole defender while using a secondary midfielder globally", () => {
    const roster: FormationPlayer[] = players("A", 9).map((player, index) => ({ ...player,
      preferredPosition: index <= 3 ? "DEF" : index <= 6 ? "MID" : "FWD",
      ...(index === 1 ? { secondaryPosition: "MID" } : {})
    }));
    roster[4].preferredPosition = "DEF";
    const created = createTeamFormation("9v9", roster);
    for (const slot of created.slots) {
      const player = roster.find((candidate) => candidate.participantId === slot.participantId)!;
      expect(getPlayerPositionFit(player, getFormationSlotPosition(created.formationId, slot.slotId)!)).not.toBe("fallback");
    }
    expect(created.slots.filter((slot) => getFormationSlotPosition(created.formationId, slot.slotId) === "MID").map((slot) => slot.participantId)).toContain(roster[1].participantId);
  });
  it("completes an all-forward roster even when recommendations are infeasible", () => {
    const roster: FormationPlayer[] = players("A", 11).map((player) => ({ ...player, preferredPosition: "FWD" }));
    const created = createTeamFormation("11v11", roster);
    expect(created.slots[0].participantId).toBe(roster[0].participantId);
    expect(new Set(created.slots.map((slot) => slot.participantId))).toEqual(new Set(roster.map((player) => player.participantId)));
    const teams = { teamA: roster, teamB: players("B", 11) };
    expect(validateMatchFormation({ teamA: created, teamB: createTeamFormation("11v11", teams.teamB) }, "11v11", teams)).toBeTruthy();
  });
  it("uses confirmed starters before substitutes and keeps a selected goalkeeper", () => {
    const roster: FormationPlayer[] = players("A", 11).map((player, index) => ({ ...player,
      isGoalkeeper: index === 10,
      preferredPosition: index < 9 ? "FWD" : "DEF"
    }));
    const created = createTeamFormation("9v9", roster);
    expect(created.slots[0].participantId).toBe(roster[10].participantId);
    const used = new Set(created.slots.map((slot) => slot.participantId));
    expect(used).toEqual(new Set([...roster.slice(0, 8), roster[10]].map((player) => player.participantId)));
    expect(used.has(roster[9].participantId)).toBe(false);
  });
  it("classifies formation roles including both midfield rows and unknown slots", () => {
    expect(getFormationSlotPosition("4-2-3-1", "gk")).toBe("GK");
    expect(getFormationSlotPosition("4-2-3-1", "line-0-1")).toBe("DEF");
    expect(getFormationSlotPosition("4-2-3-1", "line-1-1")).toBe("MID");
    expect(getFormationSlotPosition("4-2-3-1", "line-2-1")).toBe("MID");
    expect(getFormationSlotPosition("4-2-3-1", "line-3-0")).toBe("FWD");
    expect(getFormationSlotPosition("4-2-3-1", "unknown")).toBeNull();
    expect(getFormationSlotPosition("unknown", "gk")).toBeNull();
  });
  it("maps optional preferred/secondary positions for admin and public players", () => {
    expect(toFormationPlayers([{ id: "abc", full_name: "Flexible", preferred_position: "DEF", secondary_position: "MID" },
      { id: "other", full_name: "Sin ficha", preferred_position: null, secondary_position: null }], ["abc"])).toEqual([
      { participantId: "player:abc", name: "Flexible", isGoalkeeper: true, preferredPosition: "DEF", secondaryPosition: "MID" },
      { participantId: "player:other", name: "Sin ficha", isGoalkeeper: false, preferredPosition: null, secondaryPosition: null }
    ]);
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
    expect(readMatchFormation(formation(), "8v8", teams)).toBeNull();
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
