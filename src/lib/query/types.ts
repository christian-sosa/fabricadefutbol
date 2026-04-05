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
  organizationId: string;
  matches: MatchHistoryItem[];
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
    handicapTeam?: "A" | "B" | null;
  };
};

export type UpdateMatchResultResponse = {
  success: true;
  organizationId: string;
  matchId: string;
};
