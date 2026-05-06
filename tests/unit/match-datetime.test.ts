import { describe, expect, it } from "vitest";

import {
  datetimeLocalToMatchIso,
  formatMatchDateTime,
  getCurrentMatchDateInput,
  getCurrentMatchDateTimeIso,
  matchDateAndTimeToIso,
  matchIsoToDateInput,
  matchIsoToDatetimeLocal,
  matchIsoToTimeInput,
  optionalMatchDateAndTimeToIso
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

  it("prepara valores separados para fecha y hora", () => {
    expect(matchIsoToDateInput("2026-04-30T20:15:00.000Z")).toBe("2026-04-30");
    expect(matchIsoToTimeInput("2026-04-30T20:15:00.000Z")).toBe("20:15");
    expect(matchIsoToDateInput(null)).toBe("");
    expect(matchIsoToTimeInput(null)).toBe("");
  });

  it("combina fecha y hora sin aplicar offset local", () => {
    expect(matchDateAndTimeToIso("2026-05-05", "21:30")).toBe("2026-05-05T21:30:00.000Z");
    expect(matchDateAndTimeToIso("", "21:30", "2026-05-06")).toBe("2026-05-06T21:30:00.000Z");
    expect(optionalMatchDateAndTimeToIso("2026-05-05", "")).toBeNull();
    expect(() => matchDateAndTimeToIso("2026-05-05", "")).toThrow("La hora es obligatoria.");
  });

  it("calcula el ahora contra el horario de cancha de Argentina", () => {
    expect(getCurrentMatchDateTimeIso(new Date("2026-04-27T21:00:00.000Z"))).toBe("2026-04-27T18:00:00.000Z");
    expect(getCurrentMatchDateInput(new Date("2026-04-28T02:00:00.000Z"))).toBe("2026-04-27");
  });
});
