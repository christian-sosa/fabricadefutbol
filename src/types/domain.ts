export type MatchStatus = "draft" | "confirmed" | "finished" | "cancelled";
export type MatchModality = "5v5" | "6v6" | "7v7" | "9v9" | "10v10" | "11v11";
export type TeamSide = "A" | "B";
export type WinnerTeam = TeamSide | "DRAW";
export type ResultAssignmentTeam = TeamSide | "OUT";
export type PlayerRecentResult = "V" | "E" | "D";

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
  photoPath?: string | null;
  photoUpdatedAt?: string | null;
  currentRating: number;
  allTimeRating?: number;
  initialRank: number;
  currentRank: number;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  streak: string;
  recentResults: PlayerRecentResult[];
  goals: number;
  assists: number;
  mvpCount?: number;
  /** Current activity across all seasons, independent of the ranking's season. */
  isInjured?: boolean;
  lastPlayedAt?: string | null;
  matchesSinceLastPlayed?: number;
  isAbsent?: boolean;
};

export type MatchResultInput = {
  expectedVersion?: number;
  scoreA: number;
  scoreB: number;
  notes?: string;
  mvpParticipantId?: string | null;
  lineup?: {
    assignments: Array<{
      participantId: string;
      team: ResultAssignmentTeam;
    }>;
    absencePenaltyParticipantIds?: string[];
    newGuests?: Array<{
      clientId?: string;
      name: string;
      rating: number;
      team: TeamSide;
    }>;
    newPlayers?: Array<{
      playerId: string;
      team: TeamSide;
    }>;
    handicapTeam?: TeamSide | null;
  };
};
