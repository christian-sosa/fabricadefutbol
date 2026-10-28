import { describe, expect, it } from "vitest";

import { getSeasonClosing } from "@/lib/domain/season-closing";

describe("cierre anual de temporada", () => {
  it.each([
    ["2026-10-01T02:59:59Z", "2026-09-30", false],
    ["2026-10-01T03:00:00Z", "2026-10-01", true]
  ])("activa la recta final por fecha de Buenos Aires: %s", (now, date, isClosingPeriod) => {
    expect(getSeasonClosing(new Date(now))).toMatchObject({ date, isClosingPeriod });
  });

  it.each(["2026-11-06T03:00:00Z", "2026-11-07T02:59:59Z"])(
    "mantiene ocho semanas completas durante todo el 6 de noviembre: %s", (now) => {
      expect(getSeasonClosing(new Date(now))).toMatchObject({
        year: 2026, daysRemaining: 56, fullWeeksRemaining: 8, isClosingPeriod: true
      });
    }
  );

  it("conserva el último día hasta la medianoche local y reinicia el año sin números negativos", () => {
    expect(getSeasonClosing(new Date("2027-01-01T02:59:59Z"))).toMatchObject({
      year: 2026, daysRemaining: 1, fullWeeksRemaining: 0, isClosingPeriod: true
    });
    expect(getSeasonClosing(new Date("2027-01-01T03:00:00Z"))).toMatchObject({
      year: 2027, daysRemaining: 365, isClosingPeriod: false
    });
  });
});
