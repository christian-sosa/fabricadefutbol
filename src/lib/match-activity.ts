import { matchIsoToDateInput } from "@/lib/match-datetime";

export type CalendarMatch = { id: string; scheduledAt: string; modality: string };

const DAY_MS = 86_400_000;
export const ACTIVITY_WEEKDAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

function dateValue(day: string) {
  return new Date(`${day}T00:00:00.000Z`);
}

export function isActivityDate(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const parsed = dateValue(day);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day;
}

export function shiftActivityDate(day: string, days: number) {
  return new Date(dateValue(day).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

export function formatActivityDate(day: string, options?: Intl.DateTimeFormatOptions) {
  return dateValue(day).toLocaleDateString("es-AR", {
    day: "numeric", month: "long", year: "numeric", ...options, timeZone: "UTC"
  });
}

export function getActivityMonthDays(month: string) {
  const first = dateValue(`${month}-01`);
  const offset = (first.getUTCDay() + 6) % 7;
  const last = new Date(first);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  const length = Math.ceil((offset + last.getUTCDate()) / 7) * 7;
  return Array.from({ length }, (_, index) => {
    const day = index - offset + 1;
    return day > 0 && day <= last.getUTCDate() ? `${month}-${String(day).padStart(2, "0")}` : null;
  });
}

export function shiftActivityMonth(month: string, amount: number) {
  const value = dateValue(`${month}-01`);
  value.setUTCMonth(value.getUTCMonth() + amount);
  return value.toISOString().slice(0, 7);
}

export function summarizeMatchActivity(matches: CalendarMatch[], from: string, to: string) {
  const byDay = new Map<string, CalendarMatch[]>();
  const weekdayCounts = ACTIVITY_WEEKDAYS.map(() => 0);
  const validRange = isActivityDate(from) && isActivityDate(to) && from <= to;
  if (validRange) {
    for (const match of matches) {
      // Match timestamps encode the scheduled local wall clock as UTC throughout the app.
      const day = matchIsoToDateInput(match.scheduledAt);
      if (!isActivityDate(day) || day < from || day > to) continue;
      const entries = byDay.get(day) ?? [];
      entries.push(match);
      byDay.set(day, entries);
      weekdayCounts[(dateValue(day).getUTCDay() + 6) % 7] += 1;
    }
  }
  const totalMatches = weekdayCounts.reduce((total, count) => total + count, 0);
  const days = validRange ? Math.round((dateValue(to).getTime() - dateValue(from).getTime()) / DAY_MS) + 1 : 0;
  const busiestCount = Math.max(...weekdayCounts);
  return {
    byDay,
    totalMatches,
    playedDays: byDay.size,
    days,
    weeklyAverage: days >= 7 ? totalMatches * 7 / days : null,
    favoriteWeekdays: busiestCount ? ACTIVITY_WEEKDAYS.filter((_, index) => weekdayCounts[index] === busiestCount) : []
  };
}
