import { describe, expect, it } from "vitest";

import { generateBalancedTeamOptions } from "@/lib/domain/team-generator";
import { MATCH_MODALITIES, TEAM_SIZE_BY_MODALITY } from "@/lib/constants";
import { assignPlayersToPositions, getDefaultPositionFormation, getFormationRoles, getPlayerPositionFit } from "@/lib/domain/player-positions";
import type { PlayerPosition, PlayerRatingInput } from "@/types/domain";

function buildPlayers(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `player-${index + 1}`,
    fullName: `Jugador ${index + 1}`,
    rating: 120 - index * 4
  }));
}

function playersByRole(roles: PlayerPosition[]): PlayerRatingInput[] {
  return roles.map((role, index) => ({ id: `player-${index + 1}`, fullName: `Jugador ${index + 1}`, rating: 300,
    preferredPosition: role, isGoalkeeper: role === "GK" }));
}

function levelScore(option: ReturnType<typeof generateBalancedTeamOptions>[number], players: PlayerRatingInput[]) {
  const strongest = [...players].sort((a, b) => b.rating - a.rating).slice(0, 2);
  const together = option.teamA.includes(strongest[0]) === option.teamA.includes(strongest[1]);
  const countDiff = (threshold: number) => Math.abs(option.teamA.filter((player) => player.rating >= threshold).length - option.teamB.filter((player) => player.rating >= threshold).length);
  return option.ratingDiff + (together ? 35 : 0) + countDiff(400) * 30 + countDiff(500) * 20;
}

describe("generateBalancedTeamOptions", () => {
  it.each(["9v9", "10v10", "11v11"] as const)("balances grouped equal-level roles for %s and obeys selected keepers", (modality) => {
    const roles = getFormationRoles(getDefaultPositionFormation(modality)!);
    const players = playersByRole([...roles, ...roles].sort());
    const options = generateBalancedTeamOptions({ modality, players, seed: 2345 });
    expect(options).toHaveLength(3);
    for (const option of options) {
      expect(option.ratingDiff).toBe(0);
      for (const team of [option.teamA, option.teamB]) {
        expect(team.filter((player) => player.isGoalkeeper)).toHaveLength(1);
        const fit = assignPlayersToPositions(team, roles);
        expect(fit.cost).toBe(0);
        for (const role of new Set(roles)) expect(team.filter((player) => player.preferredPosition === role)).toHaveLength(roles.filter((position) => position === role).length);
      }
    }
    expect(generateBalancedTeamOptions({ modality, players, seed: 2345 })).toEqual(options);
  });
  it("uses secondary midfielders when primary defenders are overrepresented", () => {
    const players = playersByRole(["GK", "GK", ...Array<PlayerPosition>(8).fill("DEF"), ...Array<PlayerPosition>(4).fill("MID"), ...Array<PlayerPosition>(4).fill("FWD")]);
    players[8].secondaryPosition = "MID";
    players[9].secondaryPosition = "MID";
    const roles = getFormationRoles("3-3-2");
    const options = generateBalancedTeamOptions({ modality: "9v9", players, seed: 91 });
    for (const option of options) for (const team of [option.teamA, option.teamB]) {
      const fit = assignPlayersToPositions(team, roles);
      expect(fit.cost).toBe(1);
      expect(fit.assignments.every((player, index) => player && getPlayerPositionFit(player, roles[index]) !== "fallback")).toBe(true);
    }
  });
  it("keeps the chosen keepers apart even when both prefer to play forward", () => {
    const players: PlayerRatingInput[] = buildPlayers(18).map((player, index) => ({ ...player, preferredPosition: "FWD", isGoalkeeper: index < 2 }));
    const options = generateBalancedTeamOptions({ modality: "9v9", players, seed: 84 });
    for (const option of options) for (const team of [option.teamA, option.teamB]) {
      expect(team.filter((player) => player.isGoalkeeper)).toHaveLength(1);
      expect(assignPlayersToPositions(team, getFormationRoles("3-3-2")).assignments[0]?.isGoalkeeper).toBe(true);
    }
  });
  it.each(["9v9", "10v10", "11v11"] as const)("completes %s when everyone is a forward", (modality) => {
    const players: PlayerRatingInput[] = buildPlayers(TEAM_SIZE_BY_MODALITY[modality] * 2).map((player) => ({ ...player, preferredPosition: "FWD" }));
    const options = generateBalancedTeamOptions({ modality, players, seed: 615 });
    expect(options).toHaveLength(3);
    for (const option of options) expect(new Set([...option.teamA, ...option.teamB].map((player) => player.id))).toEqual(new Set(players.map((player) => player.id)));
  });
  it("preserves strong/elite distribution and bounds the role tradeoff against existing level scoring", () => {
    const ratings = [500, 500, 500, 500, 400, 400, 400, 400, 300, 300, 300, 300, 300, 300, 200, 200, 200, 200, 100, 100, 100, 100];
    const players: PlayerRatingInput[] = ratings.map((rating, index) => ({ id: `player-${index}`, fullName: `Jugador ${index}`, rating,
      preferredPosition: index < 8 ? "DEF" : index < 14 ? "MID" : "FWD" }));
    const baselinePlayers = players.map(({ id, fullName, rating }) => ({ id, fullName, rating }));
    const baseline = generateBalancedTeamOptions({ modality: "11v11", players: baselinePlayers, seed: 91 });
    const options = generateBalancedTeamOptions({ modality: "11v11", players, seed: 91 });
    const baselineScore = levelScore(baseline[0], baselinePlayers);
    for (const option of options) {
      expect(levelScore(option, players)).toBeLessThanOrEqual(baselineScore + 30);
      for (const threshold of [400, 500]) expect(option.teamA.filter((player) => player.rating >= threshold).length).toBe(option.teamB.filter((player) => player.rating >= threshold).length);
    }
  });
  it.each(["5v5", "6v6", "7v7"] as const)("leaves %s balancing unchanged when positions are added", (modality) => {
    const players = buildPlayers(TEAM_SIZE_BY_MODALITY[modality] * 2);
    const withRoles: PlayerRatingInput[] = players.map((player, index) => ({ ...player, preferredPosition: index < 5 ? "DEF" : "FWD", secondaryPosition: "MID" }));
    const baseline = generateBalancedTeamOptions({ modality, players, seed: 91 });
    const result = generateBalancedTeamOptions({ modality, players: withRoles, seed: 91 });
    expect(result.map((option) => ({ teamA: option.teamA.map((player) => player.id), teamB: option.teamB.map((player) => player.id), diff: option.ratingDiff })))
      .toEqual(baseline.map((option) => ({ teamA: option.teamA.map((player) => player.id), teamB: option.teamB.map((player) => player.id), diff: option.ratingDiff })));
  });
  it("finds a rare feasible large partition rather than depending on sampled separation luck", () => {
    const players = buildPlayers(22);
    const requiredSeparatedPairs: Array<[string, string]> = players.slice(1, 12).map((player) => [players[0].id, player.id]);
    const options = generateBalancedTeamOptions({ modality: "11v11", players, requiredSeparatedPairs, seed: 9 });
    expect(options).toHaveLength(1);
    const teamA = new Set(options[0].teamA.map((player) => player.id));
    for (const [first, second] of requiredSeparatedPairs) expect(teamA.has(first)).not.toBe(teamA.has(second));
    expect(generateBalancedTeamOptions({ modality: "11v11", players, requiredSeparatedPairs, seed: 9 })).toEqual(options);
  });
  it("rejects large contradictory separation graphs even with position preferences", () => {
    const players = playersByRole(getFormationRoles("4-3-3").flatMap((role) => [role, role]));
    expect(() => generateBalancedTeamOptions({ modality: "11v11", players, seed: 91,
      requiredSeparatedPairs: [[players[0].id, players[1].id], [players[1].id, players[2].id], [players[2].id, players[0].id]]
    })).toThrow("No se pudieron generar equipos");
  });
  it.each(MATCH_MODALITIES)("arma %s con planteles completos, sin duplicados y arqueros separados", (modality) => {
    const size = TEAM_SIZE_BY_MODALITY[modality];
    const players = buildPlayers(size * 2);
    const options = generateBalancedTeamOptions({ modality, players, seed: 20260915,
      requiredSeparatedPairs: [[players[0].id, players[1].id]] });
    expect(options).toHaveLength(3);
    for (const option of options) {
      expect(option.teamA).toHaveLength(size);
      expect(option.teamB).toHaveLength(size);
      expect(new Set([...option.teamA, ...option.teamB].map((player) => player.id)))
        .toEqual(new Set(players.map((player) => player.id)));
      expect(option.teamA.some((player) => player.id === players[0].id))
        .not.toBe(option.teamA.some((player) => player.id === players[1].id));
    }
  });
  it("falla si la cantidad no coincide con la modalidad", () => {
    expect(() =>
      generateBalancedTeamOptions({
        modality: "5v5",
        players: buildPlayers(8)
      })
    ).toThrow(/Cantidad/);
  });

  it("falla si hay jugadores duplicados", () => {
    const players = buildPlayers(10);
    players[9] = players[0];

    expect(() =>
      generateBalancedTeamOptions({
        modality: "5v5",
        players
      })
    ).toThrow("duplicados");
  });

  it("respeta pares que deben quedar separados", () => {
    const players = buildPlayers(10);

    const options = generateBalancedTeamOptions({
      modality: "5v5",
      players,
      seed: 1234,
      requiredSeparatedPairs: [["player-1", "player-2"]]
    });

    expect(options.length).toBeGreaterThan(0);
    for (const option of options) {
      const teamAIds = new Set(option.teamA.map((player) => player.id));
      expect(teamAIds.has("player-1")).not.toBe(teamAIds.has("player-2"));
    }
  });

  it("con semilla fija devuelve opciones reproducibles", () => {
    const players = buildPlayers(10);

    const first = generateBalancedTeamOptions({
      modality: "5v5",
      players,
      seed: 777
    });
    const second = generateBalancedTeamOptions({
      modality: "5v5",
      players,
      seed: 777
    });

    expect(second).toEqual(first);
  });

  it("falla si las reglas de separacion apuntan a jugadores inexistentes", () => {
    expect(() =>
      generateBalancedTeamOptions({
        modality: "5v5",
        players: buildPlayers(10),
        requiredSeparatedPairs: [["player-1", "missing-player"]]
      })
    ).toThrow("no existen");
  });

  it("falla si una regla de separacion repite al mismo participante", () => {
    expect(() =>
      generateBalancedTeamOptions({
        modality: "5v5",
        players: buildPlayers(10),
        requiredSeparatedPairs: [["player-1", "player-1"]]
      })
    ).toThrow("duplicados");
  });

  it("falla si las restricciones vuelven imposible cualquier armado", () => {
    expect(() =>
      generateBalancedTeamOptions({
        modality: "5v5",
        players: buildPlayers(10),
        requiredSeparatedPairs: [
          ["player-1", "player-2"],
          ["player-1", "player-3"],
          ["player-2", "player-3"]
        ]
      })
    ).toThrow("No se pudieron generar equipos");
  });

  it("limita la cantidad solicitada al maximo soportado", () => {
    const options = generateBalancedTeamOptions({
      modality: "5v5",
      players: buildPlayers(10),
      seed: 2026,
      requestedOptions: 20
    });

    expect(options.length).toBeLessThanOrEqual(6);
  });

  it("soporta niveles repetidos como puntajes de balance", () => {
    const players = [
      500,
      500,
      400,
      400,
      300,
      300,
      200,
      200,
      100,
      100
    ].map((rating, index) => ({
      id: `player-${index + 1}`,
      fullName: `Jugador ${index + 1}`,
      rating
    }));

    const options = generateBalancedTeamOptions({
      modality: "5v5",
      players,
      seed: 20260425
    });

    expect(options).toHaveLength(3);
    expect(options[0]?.ratingDiff).toBe(0);
  });

  it("evita concentrar demasiados jugadores fuertes en el mismo equipo", () => {
    const players = [500, 500, 400, 400, 300, 300, 200, 200, 100, 100].map((rating, index) => ({
      id: `player-${index + 1}`,
      fullName: `Jugador ${index + 1}`,
      rating
    }));

    const options = generateBalancedTeamOptions({
      modality: "5v5",
      players,
      seed: 2222,
      requestedOptions: 3
    });

    for (const option of options) {
      const strongA = option.teamA.filter((player) => player.rating >= 400).length;
      const strongB = option.teamB.filter((player) => player.rating >= 400).length;
      expect(Math.abs(strongA - strongB)).toBe(0);
    }
  });
});
