import { describe, expect, it } from "vitest";

import {
  datetimeLocalToMatchIso,
  formatMatchDateTime,
  matchIsoToDatetimeLocal
} from "@/lib/match-datetime";

describe("match datetime helpers", () => {
  it("guarda el horario de cancha sin aplicar offset local", () => {
    expect(datetimeLocalToMatchIso("2026-04-30T20:00")).toBe("2026-04-30T20:00:00.000Z");
    expect(datetimeLocalToMatchIso("2026-04-30T20:15:30")).toBe("2026-04-30T20:15:30.000Z");
  });

  it("muestra el horario registrado sin moverlo por zona horaria", () => {
    expect(formatMatchDateTime("2026-04-30T20:00:00.000Z")).toBe("30/04/2026 20:00");
    expect(formatMatchDateTime(new Date("2026-04-30T20:00:00.000Z"))).toBe("30/04/2026 20:00");
  });

  it("prepara valores para datetime-local sin restar horas", () => {
    expect(matchIsoToDatetimeLocal("2026-04-30T20:00:00.000Z")).toBe("2026-04-30T20:00");
    expect(matchIsoToDatetimeLocal(null)).toBe("");
  });
});
