import { describe, expect, it } from "vitest";
import { buildMatchHistoryHref, parseMatchHistoryPage, parseMatchHistorySeason } from "@/lib/match-history-navigation";

describe("match history navigation", () => {
  it.each([undefined, null, "", "0", "-1", "1.5", "2e3", "Infinity", "100001", "//example.com", "9007199254740992"])("defaults an invalid page %s to the first page", (page) => {
    expect(parseMatchHistoryPage(page)).toBe(1);
  });

  it("preserves only a bounded positive page and a valid season", () => {
    const season = "00000000-0000-4000-8000-000000000001";
    expect(parseMatchHistoryPage("2")).toBe(2);
    expect(parseMatchHistorySeason(season)).toBe(season);
    expect(buildMatchHistoryHref({ organizationSlug: "la banda", season, page: 2, matchId: "match-1" }))
      .toBe(`/matches/match-1?org=la+banda&season=${season}&page=2`);
    expect(buildMatchHistoryHref({ organizationSlug: "grupo", season: "all", page: 3 }))
      .toBe("/matches?org=grupo&season=all&page=3");
  });

  it("keeps invalid return context local and defaults to the current first page", () => {
    expect(buildMatchHistoryHref({ organizationSlug: "grupo", season: "https://example.com", page: -1 }))
      .toBe("/matches?org=grupo");
    expect(buildMatchHistoryHref({})).toBe("/matches");
  });
});
