import { getCurrentMatchDateInput } from "@/lib/match-datetime";

const DAY_MS = 24 * 60 * 60 * 1000;

export function getSeasonClosing(now = new Date()) {
  const date = getCurrentMatchDateInput(now);
  const [year, month] = date.split("-").map(Number);
  // Compare calendar dates, so the count changes at Buenos Aires midnight
  // regardless of the browser/server timezone or the time of the visit.
  const daysRemaining = Math.round((Date.UTC(year + 1, 0, 1) - Date.parse(`${date}T00:00:00Z`)) / DAY_MS);

  return {
    year,
    date,
    isClosingPeriod: month >= 10,
    daysRemaining,
    fullWeeksRemaining: Math.floor(daysRemaining / 7)
  };
}
