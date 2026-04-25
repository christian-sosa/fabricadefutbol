import { describe, expect, it } from "vitest";

import { generateBalancedTeamOptions } from "@/lib/domain/team-generator";

function buildPlayers(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `player-${index + 1}`,
    fullName: `Jugador ${index + 1}`,
    rating: 120 - index * 4
  }));
}

describe("generateBalancedTeamOptions", () => {
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
