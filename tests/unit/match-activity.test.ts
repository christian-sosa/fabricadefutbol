import { describe, expect, it } from "vitest";

import {
  formatActivityDate,
  getActivityMonthDays,
  isActivityDate,
  shiftActivityDate,
  shiftActivityMonth,
  summarizeMatchActivity,
  type CalendarMatch
} from "@/lib/match-activity";

function match(id: string, scheduledAt: string): CalendarMatch {
  return { id, scheduledAt, modality: "6v6" };
}

describe("match activity summary", () => {
  it("includes both range boundaries and idle weeks in the weekly average", () => {
    const result = summarizeMatchActivity([
      match("before", "2026-08-31T23:59:00.000Z"),
      match("first", "2026-09-01T00:00:00.000Z"),
      match("last", "2026-09-28T23:59:00.000Z"),
      match("after", "2026-09-29T00:00:00.000Z")
    ], "2026-09-01", "2026-09-28");

    expect(result.days).toBe(28);
    expect(result.totalMatches).toBe(2);
    expect(result.playedDays).toBe(2);
    expect(result.weeklyAverage).toBe(0.5);
    expect([...result.byDay.keys()]).toEqual(["2026-09-01", "2026-09-28"]);
  });

  it("counts multiple matches on one day while preserving each match for the calendar", () => {
    const first = match("first", "2026-09-14T19:00:00.000Z");
    const second = match("second", "2026-09-14T21:00:00.000Z");
    const result = summarizeMatchActivity([first, second], "2026-09-14", "2026-09-20");

    expect(result.totalMatches).toBe(2);
    expect(result.playedDays).toBe(1);
    expect(result.weeklyAverage).toBe(2);
    expect(result.byDay.get("2026-09-14")).toEqual([first, second]);
    expect(result.favoriteWeekdays).toEqual(["lunes"]);
  });

  it("keeps the scheduled wall-clock day near midnight without applying a timezone offset", () => {
    const result = summarizeMatchActivity([
      match("early", "2026-09-14T00:15:00.000Z"),
      match("late", "2026-09-14T23:45:00.000Z")
    ], "2026-09-14", "2026-09-14");

    expect(result.days).toBe(1);
    expect(result.byDay.get("2026-09-14")?.map(({ id }) => id)).toEqual(["early", "late"]);
    expect(result.favoriteWeekdays).toEqual(["lunes"]);
    expect(result.byDay.has("2026-09-13")).toBe(false);
    expect(result.byDay.has("2026-09-15")).toBe(false);
  });

  it.each(["2026-09-14", "2026-09-19"])("withholds a weekly rate for a range shorter than seven days ending %s", (to) => {
    const result = summarizeMatchActivity([match("one", "2026-09-14T21:00:00.000Z")], "2026-09-14", to);
    expect(result.totalMatches).toBe(1);
    expect(result.weeklyAverage).toBeNull();
  });

  it("returns every tied favorite weekday in Monday-first order", () => {
    const result = summarizeMatchActivity([
      match("friday", "2026-09-18T21:00:00.000Z"),
      match("monday", "2026-09-14T21:00:00.000Z"),
      match("next-friday", "2026-09-25T21:00:00.000Z"),
      match("next-monday", "2026-09-21T21:00:00.000Z"),
      match("wednesday", "2026-09-16T21:00:00.000Z")
    ], "2026-09-14", "2026-09-27");

    expect(result.favoriteWeekdays).toEqual(["lunes", "viernes"]);
    expect(result.weeklyAverage).toBe(2.5);
  });

  it("reports zero activity for an empty valid range without inventing a favorite day", () => {
    const result = summarizeMatchActivity([], "2026-09-01", "2026-09-30");
    expect(result).toEqual({
      byDay: new Map(), totalMatches: 0, playedDays: 0, days: 30,
      weeklyAverage: 0, favoriteWeekdays: []
    });
  });

  it.each([
    ["2026-09-20", "2026-09-14"],
    ["", "2026-09-20"],
    ["2026-09-14", "invalid"],
    ["2026-02-30", "2026-03-14"]
  ])("rejects invalid or reversed range %s to %s", (from, to) => {
    const result = summarizeMatchActivity([match("one", "2026-09-14T21:00:00.000Z")], from, to);
    expect(result).toEqual({
      byDay: new Map(), totalMatches: 0, playedDays: 0, days: 0,
      weeklyAverage: null, favoriteWeekdays: []
    });
  });

  it("ignores invalid match dates instead of marking another day", () => {
    const result = summarizeMatchActivity([
      match("invalid", "not-a-date"),
      match("impossible", "2026-02-30T21:00:00.000Z"),
      match("valid", "2026-03-02T21:00:00.000Z")
    ], "2026-02-01", "2026-03-31");
    expect(result.totalMatches).toBe(1);
    expect([...result.byDay.keys()]).toEqual(["2026-03-02"]);
  });
});

describe("activity calendar dates", () => {
  it("validates leap years and requires a complete real calendar date", () => {
    expect(isActivityDate("2024-02-29")).toBe(true);
    for (const day of ["2026-02-29", "2026-04-31", "2026-00-01", "2026-13-01", "2026-9-01", "invalid", ""]) {
      expect(isActivityDate(day)).toBe(false);
    }
  });

  it("lays out leap February with Monday-first leading and trailing empty cells", () => {
    const days = getActivityMonthDays("2024-02");
    expect(days).toHaveLength(35);
    expect(days.slice(0, 5)).toEqual([null, null, null, "2024-02-01", "2024-02-02"]);
    expect(days.slice(-4)).toEqual(["2024-02-29", null, null, null]);
    expect(days.filter(Boolean)).toHaveLength(29);
  });

  it("uses exactly four calendar rows for a non-leap February starting on Monday", () => {
    const days = getActivityMonthDays("2021-02");
    expect(days).toHaveLength(28);
    expect(days[0]).toBe("2021-02-01");
    expect(days[27]).toBe("2021-02-28");
    expect(days).not.toContain(null);
  });

  it("places a Sunday start in the seventh column and expands to six rows when needed", () => {
    const days = getActivityMonthDays("2026-03");
    expect(days).toHaveLength(42);
    expect(days.slice(0, 7)).toEqual([null, null, null, null, null, null, "2026-03-01"]);
    expect(days[36]).toBe("2026-03-31");
    expect(days.slice(37)).toEqual([null, null, null, null, null]);
  });

  it("shifts months across year boundaries in both directions", () => {
    expect(shiftActivityMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftActivityMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftActivityMonth("2026-09", 0)).toBe("2026-09");
  });

  it("shifts days across leap-day and year boundaries", () => {
    expect(shiftActivityDate("2024-03-01", -1)).toBe("2024-02-29");
    expect(shiftActivityDate("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftActivityDate("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("formats the selected day in Spanish without changing it for the runtime timezone", () => {
    expect(formatActivityDate("2026-09-14")).toBe("14 de septiembre de 2026");
    expect(formatActivityDate("2026-09-14", { weekday: "long", year: undefined, month: undefined, day: undefined })).toBe("lunes");
  });
});
