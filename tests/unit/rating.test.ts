import { describe, expect, it } from "vitest";

import { calculateMatchRatingAdjustments, deriveWinnerTeam } from "@/lib/domain/rating";

const TEAM_A = [
  { id: "a1", rating: 1000 },
  { id: "a2", rating: 990 }
];

const TEAM_B = [
  { id: "b1", rating: 1000 },
  { id: "b2", rating: 980 }
];

describe("rating", () => {
  it("deriva el ganador segun el marcador", () => {
    expect(deriveWinnerTeam(3, 1)).toBe("A");
    expect(deriveWinnerTeam(0, 2)).toBe("B");
    expect(deriveWinnerTeam(2, 2)).toBe("DRAW");
  });

  it("ajusta ratings normales cuando gana el equipo A", () => {
    const adjustments = calculateMatchRatingAdjustments({
      teamA: TEAM_A,
      teamB: TEAM_B,
      winnerTeam: "A"
    });

    expect(adjustments).toEqual([
      { playerId: "a1", team: "A", ratingBefore: 1000, delta: 10, ratingAfter: 1010 },
      { playerId: "a2", team: "A", ratingBefore: 990, delta: 10, ratingAfter: 1000 },
      { playerId: "b1", team: "B", ratingBefore: 1000, delta: -10, ratingAfter: 990 },
      { playerId: "b2", team: "B", ratingBefore: 980, delta: -10, ratingAfter: 970 }
    ]);
  });

  it("no cambia ratings en empate", () => {
    const adjustments = calculateMatchRatingAdjustments({
      teamA: TEAM_A,
      teamB: TEAM_B,
      winnerTeam: "DRAW"
    });

    expect(adjustments.every((row) => row.delta === 0)).toBe(true);
    expect(adjustments.map((row) => row.ratingAfter)).toEqual([1000, 990, 1000, 980]);
  });

  it("duplica el premio si gana el equipo con desventaja numerica", () => {
    const adjustments = calculateMatchRatingAdjustments({
      teamA: TEAM_A,
      teamB: TEAM_B,
      winnerTeam: "A",
      shortHandedTeam: "A"
    });

    expect(adjustments.filter((row) => row.team === "A").map((row) => row.delta)).toEqual([20, 20]);
    expect(adjustments.filter((row) => row.team === "B").map((row) => row.delta)).toEqual([-20, -20]);
  });

  it("no castiga al equipo en desventaja si igual pierde", () => {
    const adjustments = calculateMatchRatingAdjustments({
      teamA: TEAM_A,
      teamB: TEAM_B,
      winnerTeam: "B",
      shortHandedTeam: "A"
    });

    expect(adjustments.filter((row) => row.team === "A").map((row) => row.delta)).toEqual([0, 0]);
    expect(adjustments.filter((row) => row.team === "B").map((row) => row.delta)).toEqual([10, 10]);
  });
});
