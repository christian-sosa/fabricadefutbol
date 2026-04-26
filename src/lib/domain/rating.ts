import type { TeamSide, WinnerTeam } from "@/types/domain";

type RatingPlayer = {
  id: string;
  rating: number;
};

type CalculateRatingInput = {
  teamA: RatingPlayer[];
  teamB: RatingPlayer[];
  winnerTeam: WinnerTeam;
  deltaPerMatch?: number;
  shortHandedTeam?: TeamSide | null;
};

export type RatingAdjustment = {
  playerId: string;
  team: TeamSide;
  ratingBefore: number;
  delta: number;
  ratingAfter: number;
};

const DEFAULT_DELTA_PER_MATCH = 10;

export function deriveWinnerTeam(scoreA: number, scoreB: number): WinnerTeam {
  if (scoreA === scoreB) return "DRAW";
  return scoreA > scoreB ? "A" : "B";
}

function resolveDelta(
  team: TeamSide,
  winnerTeam: WinnerTeam,
  deltaPerMatch: number,
  shortHandedTeam: TeamSide | null
) {
  if (winnerTeam === "DRAW") return 0;
  if (!shortHandedTeam) {
    return winnerTeam === team ? deltaPerMatch : -deltaPerMatch;
  }

  if (winnerTeam === shortHandedTeam) {
    return winnerTeam === team ? deltaPerMatch * 2 : -(deltaPerMatch * 2);
  }

  return winnerTeam === team ? deltaPerMatch : 0;
}

export function calculateMatchRatingAdjustments(input: CalculateRatingInput): RatingAdjustment[] {
  const {
    teamA,
    teamB,
    winnerTeam,
    deltaPerMatch = DEFAULT_DELTA_PER_MATCH,
    shortHandedTeam = null
  } = input;
  if (!teamA.length || !teamB.length) {
    throw new Error("No se pueden calcular rendimientos sin ambos equipos.");
  }

  const teamADelta = resolveDelta("A", winnerTeam, deltaPerMatch, shortHandedTeam);
  const teamBDelta = resolveDelta("B", winnerTeam, deltaPerMatch, shortHandedTeam);

  const mappedA = teamA.map<RatingAdjustment>((player) => ({
    playerId: player.id,
    team: "A",
    ratingBefore: player.rating,
    delta: teamADelta,
    ratingAfter: Math.round(player.rating + teamADelta)
  }));

  const mappedB = teamB.map<RatingAdjustment>((player) => ({
    playerId: player.id,
    team: "B",
    ratingBefore: player.rating,
    delta: teamBDelta,
    ratingAfter: Math.round(player.rating + teamBDelta)
  }));

  return [...mappedA, ...mappedB];
}
