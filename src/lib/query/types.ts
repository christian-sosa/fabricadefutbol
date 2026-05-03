import type { MatchModality, MatchStatus, PlayerComputedStats, WinnerTeam } from "@/types/domain";

export type OrganizationStandingsResponse = {
  organizationId: string;
  standings: PlayerComputedStats[];
};

export type SeasonFilterValue = "current" | "all" | string;

export type OrganizationSeasonOption = {
  id: string;
  label: string;
  durationMonths: number;
  startsAt: string;
  endsAt: string;
  status: "active" | "closed";
};

export type MatchHistoryItem = {
  id: string;
  scheduledAt: string;
  modality: MatchModality;
  status: MatchStatus;
  scoreA: number | null;
  scoreB: number | null;
  winnerTeam: WinnerTeam | null;
  seasonId?: string | null;
  mvpDisplayName?: string | null;
};

export type OrganizationMatchesResponse = {
  organizationId: string | null;
  matches: MatchHistoryItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export type UpdateMatchResultPayload = {
  scoreA: number;
  scoreB: number;
  notes?: string;
  mvpParticipantId?: string | null;
  lineup?: {
    assignments: Array<{
      participantId: string;
      team: "A" | "B" | "OUT";
    }>;
    newGuests?: Array<{
      clientId?: string;
      name: string;
      rating: number;
      team: "A" | "B";
    }>;
    newPlayers?: Array<{
      playerId: string;
      team: "A" | "B";
    }>;
    handicapTeam?: "A" | "B" | null;
  };
};

export type UpdateMatchResultResponse = {
  success: true;
  organizationId: string;
  matchId: string;
};
