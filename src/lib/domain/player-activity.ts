import type { MatchWithTeams } from "@/lib/domain/stats";
import { getCurrentMatchDateTimeIso } from "@/lib/match-datetime";

export const ABSENT_MATCH_THRESHOLD = 5;

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

/** Uses the final teams, not invitations or absence penalties, to identify who played. */
export function calculatePlayerActivity(players: ActivityPlayer[], matches: MatchWithTeams[]) {
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
    const registeredAt = new Date(player.created_at);
    const baseline = lastPlayed
      ? Date.parse(lastPlayed.match.scheduled_at)
      : Number.isFinite(registeredAt.getTime())
        ? Date.parse(getCurrentMatchDateTimeIso(registeredAt))
        : Number.NaN;
    const matchesSinceLastPlayed = lastPlayedIndex >= 0
      ? lastPlayedIndex
      : Number.isFinite(baseline)
        ? group.filter((item) => Date.parse(item.match.scheduled_at) > baseline).length
        : 0;
    const isInjured = player.is_injured === true;
    return [player.id, {
      isInjured,
      lastPlayedAt: lastPlayed?.match.scheduled_at ?? null,
      matchesSinceLastPlayed,
      isAbsent: !isInjured && matchesSinceLastPlayed >= ABSENT_MATCH_THRESHOLD
    } satisfies PlayerActivity];
  }));
}
