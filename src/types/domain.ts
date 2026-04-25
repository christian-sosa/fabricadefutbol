export type MatchStatus = "draft" | "confirmed" | "finished" | "cancelled";
export type MatchModality = "5v5" | "6v6" | "7v7" | "9v9" | "11v11";
export type TeamSide = "A" | "B";
export type WinnerTeam = TeamSide | "DRAW";
export type ResultAssignmentTeam = TeamSide | "OUT";
export type TournamentStatus = "draft" | "active" | "finished" | "archived";
export type TournamentMatchStatus = "draft" | "scheduled" | "played" | "cancelled";
export type LeagueStatus = TournamentStatus;
export type CompetitionStatus = TournamentStatus;
export type CompetitionType = "league" | "cup" | "league_and_cup";
export type CompetitionPhase = "league" | "cup";
export type CompetitionPlayoffSize = 4 | 8;
export type TournamentFixtureItemKind = "match" | "bye";
export type TournamentByeKind = "free_round" | "advance";

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
  lineup?: {
    assignments: Array<{
      participantId: string;
      team: ResultAssignmentTeam;
    }>;
    newGuests?: Array<{
      name: string;
      rating: number;
      team: TeamSide;
    }>;
    handicapTeam?: TeamSide | null;
  };
};

export type LeagueListItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  venueName: string | null;
  locationNotes: string | null;
  logoUrl: string | null;
  isPublic: boolean;
  status: LeagueStatus;
  createdAt: string;
  teamCount: number;
  competitionCount: number;
};

export type CompetitionListItem = {
  id: string;
  leagueId: string;
  name: string;
  slug: string;
  seasonLabel: string;
  description: string | null;
  venueOverride: string | null;
  type: CompetitionType;
  playoffSize: CompetitionPlayoffSize | null;
  isPublic: boolean;
  status: CompetitionStatus;
  createdAt: string;
  teamCount: number;
};

export type TournamentStandingRow = {
  teamId: string;
  teamName: string;
  shortName: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

export type TournamentFixtureRow = {
  id: string;
  kind: TournamentFixtureItemKind;
  roundId: string | null;
  roundNumber: number;
  roundName: string;
  phase: CompetitionPhase;
  stageLabel: string;
  scheduledAt: string | null;
  venue: string | null;
  status: TournamentMatchStatus | "bye";
  homeTeamId: string | null;
  homeTeamName: string | null;
  homeTeamShortName: string | null;
  awayTeamId: string | null;
  awayTeamName: string | null;
  awayTeamShortName: string | null;
  homeScore: number | null;
  awayScore: number | null;
  penaltyHomeScore: number | null;
  penaltyAwayScore: number | null;
  winnerTeamId: string | null;
  byeKind: TournamentByeKind | null;
  byeTeamId: string | null;
  byeTeamName: string | null;
  byeTeamShortName: string | null;
};

export type TournamentTopScorerRow = {
  playerId: string | null;
  playerName: string;
  teamId: string;
  teamName: string;
  teamShortName: string | null;
  goals: number;
};

export type TournamentTopFigureRow = {
  playerId: string | null;
  playerName: string;
  teamId: string;
  teamName: string;
  teamShortName: string | null;
  mvpCount: number;
};

export type TournamentBestDefenseRow = {
  teamId: string;
  teamName: string;
  teamShortName: string | null;
  goalsAgainst: number;
  matchesPlayed: number;
};

export type TournamentMatchSheetInput = {
  homeScore: number;
  awayScore: number;
  penaltyHomeScore?: number | null;
  penaltyAwayScore?: number | null;
  notes?: string;
  mvpEntryKey?: string | null;
  stats: Array<{
    entryKey: string;
    teamId: string;
    playerId?: string | null;
    playerName: string;
    goals: number;
    yellowCards: number;
    redCards: number;
  }>;
};
