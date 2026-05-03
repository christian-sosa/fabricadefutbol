import type { MatchStatus } from "@/types/domain";

export function getAdminMatchListActions(status: MatchStatus) {
  return {
    canLoadResult: status === "confirmed"
  };
}
