const DAY = 86_400_000;
type Group = { id: string; created_at: string };
type Match = { id: string; organization_id: string; status: string; finished_at: string | null };
const percent = (numerator: number, denominator: number) => denominator ? Math.round(numerator / denominator * 1000) / 10 : null;

export function calculateGroupActivation(groups: Group[], matches: Match[], now = Date.now()) {
  const resultsByGroup = new Map<string, number[]>();
  const seen = new Set<string>();
  const lastWeek = new Set<string>();
  const previousWeek = new Set<string>();
  for (const match of matches) {
    if (seen.has(match.id) || match.status !== "finished") continue;
    seen.add(match.id);
    const finished = Date.parse(match.finished_at ?? "");
    if (!Number.isFinite(finished) || finished > now) continue;
    const dates = resultsByGroup.get(match.organization_id) ?? [];
    dates.push(finished);
    resultsByGroup.set(match.organization_id, dates);
    if (finished >= now - 7 * DAY) lastWeek.add(match.organization_id);
    else if (finished >= now - 14 * DAY) previousWeek.add(match.organization_id);
  }
  let groupsWithFirstResult = 0, groupsWithSecondResult = 0, eligibleForActivation7d = 0, activatedWithin7d = 0, eligibleForRepeat14d = 0, repeatedWithin14d = 0;
  const firstResultHours: number[] = [];
  for (const group of groups) {
    const created = Date.parse(group.created_at);
    const results = (resultsByGroup.get(group.id) ?? []).sort((a, b) => a - b);
    const [first, second] = results;
    if (first !== undefined) groupsWithFirstResult++;
    if (second !== undefined) groupsWithSecondResult++;
    if (Number.isFinite(created) && first !== undefined && first >= created) firstResultHours.push((first - created) / 3_600_000);
    if (Number.isFinite(created) && created <= now - 7 * DAY) {
      eligibleForActivation7d++;
      if (first !== undefined && first >= created && first <= created + 7 * DAY) activatedWithin7d++;
    }
    if (first !== undefined && first <= now - 14 * DAY) {
      eligibleForRepeat14d++;
      if (second !== undefined && second <= first + 14 * DAY) repeatedWithin14d++;
    }
  }
  firstResultHours.sort((a, b) => a - b);
  const middle = Math.floor(firstResultHours.length / 2);
  const medianHoursToFirstResult = firstResultHours.length ? Math.round((firstResultHours.length % 2 ? firstResultHours[middle] : (firstResultHours[middle - 1] + firstResultHours[middle]) / 2) * 10) / 10 : null;
  const ids = new Set(groups.map((group) => group.id));
  const activeGroupsLast7d = [...lastWeek].filter((id) => ids.has(id)).length;
  const activeGroupsPrevious7d = [...previousWeek].filter((id) => ids.has(id)).length;
  const returnedGroups7d = [...previousWeek].filter((id) => ids.has(id) && lastWeek.has(id)).length;
  return { groupsWithFirstResult, groupsWithSecondResult, eligibleForActivation7d, activatedWithin7d, activation7dPercent: percent(activatedWithin7d, eligibleForActivation7d), eligibleForRepeat14d, repeatedWithin14d, repeat14dPercent: percent(repeatedWithin14d, eligibleForRepeat14d), medianHoursToFirstResult, activeGroupsLast7d, activeGroupsPrevious7d, returnedGroups7d, weeklyReturnPercent: percent(returnedGroups7d, activeGroupsPrevious7d) };
}
