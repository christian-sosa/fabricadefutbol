import { describe, expect, it } from "vitest";
import { getNextWeeklyMatchDate } from "@/lib/repeat-match";

describe("repetición semanal", () => {
  it.each([
    ["2026-09-25T21:00:00Z", "2026-09-30T10:00:00Z", "2026-10-02"],
    ["2026-08-28T21:00:00Z", "2026-09-30T10:00:00Z", "2026-10-02"],
    ["2026-09-25T21:00:00Z", "2026-10-02T21:00:00Z", "2026-10-09"],
    ["2026-09-25T21:00:00Z", "2026-10-02T20:59:59Z", "2026-10-02"],
    ["2026-12-25T21:00:00Z", "2026-12-31T12:00:00Z", "2027-01-01"],
    ["2028-02-25T21:00:00Z", "2028-02-29T12:00:00Z", "2028-03-03"]
  ])("propone fecha futura semanal desde %s al %s", (original, now, expected) => {
    expect(getNextWeeklyMatchDate(original, now)).toBe(expected);
  });
});
