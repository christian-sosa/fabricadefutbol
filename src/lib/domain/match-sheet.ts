import type { ResultAssignmentTeam } from "@/types/domain";

export type MatchSheetParticipant = {
  participantId: string;
  fullName: string;
  source: "player" | "guest";
  team: ResultAssignmentTeam;
  penalized: boolean;
};

export function readMatchLineupSnapshot(value: unknown): MatchSheetParticipant[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is MatchSheetParticipant => {
    if (!row || typeof row !== "object") return false;
    return typeof row.participantId === "string" && typeof row.fullName === "string" &&
      (row.source === "player" || row.source === "guest") &&
      (row.team === "A" || row.team === "B" || row.team === "OUT") && typeof row.penalized === "boolean";
  });
}
