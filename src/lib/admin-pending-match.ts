import { getCurrentMatchDateTimeIso } from "@/lib/match-datetime";

export function getPastPendingResultMatch<T extends { id: string; status: string; scheduled_at: string }>(matches: T[], now = getCurrentMatchDateTimeIso()): T | null {
  const cutoff = Date.parse(now);
  return matches.filter((match) => match.status === "confirmed" && Date.parse(match.scheduled_at) <= cutoff)
    .sort((left, right) => Date.parse(left.scheduled_at) - Date.parse(right.scheduled_at) || left.id.localeCompare(right.id))[0] ?? null;
}
