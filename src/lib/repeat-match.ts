import { getCurrentMatchDateTimeIso, matchIsoToDateInput } from "@/lib/match-datetime";

/** Match ISO values encode Buenos Aires wall-clock fields with a Z suffix. */
export function getNextWeeklyMatchDate(scheduledAt: string, now = getCurrentMatchDateTimeIso()) {
  const original = Date.parse(scheduledAt);
  const cutoff = Date.parse(now);
  if (!Number.isFinite(original) || !Number.isFinite(cutoff)) return matchIsoToDateInput(now);
  const week = 7 * 86_400_000;
  const weeks = Math.max(1, Math.floor((cutoff - original) / week) + 1);
  return matchIsoToDateInput(new Date(original + weeks * week).toISOString());
}
