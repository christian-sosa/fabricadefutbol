import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  addMonthsToIsoDate,
  hasActiveLeagueSubscription,
  isIsoDateExpired,
  resolveLeagueWriteWindow,
  resolveNextLeagueBillingPeriod,
  toShortDate
} from "@/lib/domain/billing";

describe("billing helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("suma meses en UTC sin depender del timezone de la maquina", () => {
    expect(addMonthsToIsoDate("2026-05-01T00:00:00.000Z", 1)).toBe("2026-06-01T00:00:00.000Z");
    expect(addMonthsToIsoDate("2026-04-19T12:00:00.000Z", 1)).toBe("2026-05-19T12:00:00.000Z");
  });

  it("detecta fechas vencidas contra el reloj actual", () => {
    expect(isIsoDateExpired("2026-04-18T12:00:00.000Z")).toBe(true);
    expect(isIsoDateExpired("2026-04-20T12:00:00.000Z")).toBe(false);
  });

  it("detecta una suscripcion activa de liga solo si esta vigente", () => {
    expect(
      hasActiveLeagueSubscription({
        status: "active",
        current_period_end: "2026-05-01T00:00:00.000Z"
      })
    ).toBe(true);

    expect(
      hasActiveLeagueSubscription({
        status: "cancelled",
        current_period_end: "2026-05-01T00:00:00.000Z"
      })
    ).toBe(false);

    expect(hasActiveLeagueSubscription(null)).toBe(false);
  });

  it("resuelve la ventana de escritura para ligas segun la suscripcion", () => {
    expect(
      resolveLeagueWriteWindow({
        subscription: {
          status: "active",
          current_period_end: "2026-05-01T00:00:00.000Z"
        }
      })
    ).toEqual({
      canWrite: true,
      subscriptionActive: true,
      accessValidUntil: "2026-05-01T00:00:00.000Z",
      writeLockedAt: null
    });

    expect(resolveLeagueWriteWindow({ subscription: null })).toEqual({
      canWrite: false,
      subscriptionActive: false,
      accessValidUntil: null,
      writeLockedAt: null
    });
  });

  it("calcula el proximo periodo de facturacion de liga", () => {
    expect(resolveNextLeagueBillingPeriod("2026-05-10T00:00:00.000Z")).toEqual({
      periodStart: "2026-05-10T00:00:00.000Z",
      periodEnd: "2026-06-10T00:00:00.000Z"
    });

    expect(resolveNextLeagueBillingPeriod("2026-04-01T00:00:00.000Z")).toEqual({
      periodStart: "2026-04-19T12:00:00.000Z",
      periodEnd: "2026-05-19T12:00:00.000Z"
    });
  });

  it("formatea fechas cortas en espanol argentino", () => {
    expect(toShortDate("2026-04-19T12:00:00.000Z")).toBe("19/4/2026");
  });
});
