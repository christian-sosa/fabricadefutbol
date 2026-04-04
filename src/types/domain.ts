export type MatchStatus = "draft" | "confirmed" | "finished" | "cancelled";
export type MatchModality = "5v5" | "6v6" | "7v7" | "9v9" | "11v11";
export type TeamSide = "A" | "B";
export type WinnerTeam = TeamSide | "DRAW";

export type PlayerRatingInput = {
  id: string;
  fullName: string;
  rating: number;
};

export type TeamOptionCandidate = {
  teamA: PlayerRatingInput[];
  teamB: PlayerRatingInput[];
  ratingSumA: number;
  ratingSumB: number;
  ratingDiff: number;
};

export type PlayerComputedStats = {
  playerId: string;
  playerName: string;
  currentRating: number;
  initialRank: number;
  currentRank: number;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  streak: string;
  goals: number;
  assists: number;
};

export type MatchResultInput = {
  scoreA: number;
  scoreB: number;
  notes?: string;
};
