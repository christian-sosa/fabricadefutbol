import type { MatchModality, MatchStatus, PlayerComputedStats, WinnerTeam } from "@/types/domain";

export type OrganizationStandingsResponse = {
  organizationId: string;
  standings: PlayerComputedStats[];
};

export type MatchHistoryItem = {
  id: string;
  scheduledAt: string;
  modality: MatchModality;
  status: MatchStatus;
  scoreA: number | null;
  scoreB: number | null;
  winnerTeam: WinnerTeam | null;
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
  lineup?: {
    assignments: Array<{
      participantId: string;
      team: "A" | "B" | "OUT";
    }>;
    newGuests?: Array<{
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
