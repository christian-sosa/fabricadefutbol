import { describe, expect, it } from "vitest";
import { calculateGroupActivation } from "@/lib/analytics/group-activation";
const now = Date.parse("2026-09-30T00:00:00Z");
const group = (id: string, day: string) => ({ id, created_at: `2026-09-${day}T00:00:00Z` });
const match = (id: string, organization_id: string, day: string) => ({ id, organization_id, status: "finished", finished_at: `2026-09-${day}T00:00:00Z` });

describe("activación y repetición por grupos", () => {
  it("usa cohortes maduras y no cuenta grupos nuevos como abandonos", () => {
    const result = calculateGroupActivation([group("fast", "01"), group("slow", "01"), group("new", "29")], [match("a", "fast", "02"), match("b", "fast", "08"), match("c", "slow", "11"), match("d", "slow", "29")], now);
    expect(result).toMatchObject({ eligibleForActivation7d: 2, activatedWithin7d: 1, activation7dPercent: 50, eligibleForRepeat14d: 2, repeatedWithin14d: 1, repeat14dPercent: 50, medianHoursToFirstResult: 132 });
  });
  it("compara ventanas semanales sin contar edición/repetición del mismo partido", () => {
    const rows = [match("a", "one", "20"), match("b", "one", "28"), match("b", "one", "28"), match("c", "two", "21"), match("d", "three", "29")];
    expect(calculateGroupActivation([group("one", "01"), group("two", "01"), group("three", "01")], rows, now)).toMatchObject({ activeGroupsPrevious7d: 2, activeGroupsLast7d: 2, returnedGroups7d: 1, weeklyReturnPercent: 50, groupsWithSecondResult: 1 });
  });
  it("no inventa porcentajes cuando no hay denominador", () => {
    expect(calculateGroupActivation([], [], now)).toMatchObject({ activation7dPercent: null, repeat14dPercent: null, weeklyReturnPercent: null, medianHoursToFirstResult: null });
  });
});
