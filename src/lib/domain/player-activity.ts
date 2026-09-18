import type { MatchWithTeams } from "@/lib/domain/stats";
import { getCurrentMatchDateInput, getCurrentMatchDateTimeIso } from "@/lib/match-datetime";

export const ABSENT_MATCH_THRESHOLD = 8;

type ActivityPlayer = {
  id: string;
  organization_id: string;
  created_at: string;
  is_injured?: boolean;
};

export type PlayerActivity = {
  isInjured: boolean;
  lastPlayedAt: string | null;
  matchesSinceLastPlayed: number;
  isAbsent: boolean;
};

function getActivityBaseline(lastPlayedAt: string | null, createdAt: string | undefined) {
  if (lastPlayedAt) return Date.parse(lastPlayedAt);
  const registeredAt = new Date(createdAt ?? "");
  return Number.isFinite(registeredAt.getTime())
    ? Date.parse(getCurrentMatchDateTimeIso(registeredAt))
    : Number.NaN;
}

/** Match dates use court time; registration and the clock use actual UTC instants. */
export function isPlayerAbsent(activity: {
  isInjured: boolean;
  matchesSinceLastPlayed: number;
  lastPlayedAt: string | null;
  createdAt?: string;
}, now: Date = new Date()) {
  if (activity.isInjured) return false;
  if (activity.matchesSinceLastPlayed >= ABSENT_MATCH_THRESHOLD) return true;

  const baseline = new Date(getActivityBaseline(activity.lastPlayedAt, activity.createdAt));
  if (!Number.isFinite(baseline.getTime())) return false;

  // One calendar month, clamped to the last day of shorter months, from midnight BA.
  const year = baseline.getUTCFullYear();
  const month = baseline.getUTCMonth();
  const lastDayOfNextMonth = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();
  const absentFrom = Date.UTC(year, month + 1, Math.min(baseline.getUTCDate(), lastDayOfNextMonth));
  const today = Date.parse(`${getCurrentMatchDateInput(now)}T00:00:00Z`);
  return today >= absentFrom;
}

/** Uses the final teams, not invitations or absence penalties, to identify who played. */
export function calculatePlayerActivity(players: ActivityPlayer[], matches: MatchWithTeams[], now: Date = new Date()) {
  const matchesByOrganization = new Map<string, MatchWithTeams[]>();
  const seen = new Set<string>();
  for (const item of matches) {
    if (item.match.status !== "finished" || !item.result || seen.has(item.match.id)) continue;
    if (!Number.isFinite(Date.parse(item.match.scheduled_at))) continue;
    seen.add(item.match.id);
    const group = matchesByOrganization.get(item.match.organization_id) ?? [];
    group.push(item);
    matchesByOrganization.set(item.match.organization_id, group);
  }
  for (const group of matchesByOrganization.values()) {
    group.sort((a, b) => Date.parse(b.match.scheduled_at) - Date.parse(a.match.scheduled_at)
      || b.match.id.localeCompare(a.match.id));
  }

  return new Map(players.map((player) => {
    const group = matchesByOrganization.get(player.organization_id) ?? [];
    const lastPlayedIndex = group.findIndex((item) => item.teamAPlayerIds.includes(player.id) || item.teamBPlayerIds.includes(player.id));
    const lastPlayed = group[lastPlayedIndex];
    // A newly added player does not inherit the group's pre-registration absences.
    const lastPlayedAt = lastPlayed?.match.scheduled_at ?? null;
    const baseline = getActivityBaseline(lastPlayedAt, player.created_at);
    const matchesSinceLastPlayed = lastPlayedIndex >= 0
      ? lastPlayedIndex
      : Number.isFinite(baseline)
        ? group.filter((item) => Date.parse(item.match.scheduled_at) > baseline).length
        : 0;
    const isInjured = player.is_injured === true;
    return [player.id, {
      isInjured,
      lastPlayedAt,
      matchesSinceLastPlayed,
      isAbsent: isPlayerAbsent({ isInjured, matchesSinceLastPlayed, lastPlayedAt, createdAt: player.created_at }, now)
    } satisfies PlayerActivity];
  }));
}
