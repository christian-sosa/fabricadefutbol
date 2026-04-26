import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  addDaysToIsoDate,
  addMonthsToIsoDate,
  getOrganizationTrialEndsAt,
  hasActiveLeagueSubscription,
  hasActiveOrganizationSubscription,
  isIsoDateExpired,
  resolveLeagueWriteWindow,
  resolveNextLeagueBillingPeriod,
  resolveOrganizationVisibleAccessValidUntil,
  resolveOrganizationWriteWindow,
  resolveNextOrganizationBillingPeriod,
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

  it("calcula el fin de trial desde la fecha de alta", () => {
    const createdAt = "2026-04-01T00:00:00.000Z";

    expect(addDaysToIsoDate(createdAt, 30)).toBe("2026-05-01T00:00:00.000Z");
    expect(getOrganizationTrialEndsAt(createdAt)).toBe("2026-05-01T00:00:00.000Z");
  });

  it("suma meses en UTC sin depender del timezone de la maquina", () => {
    expect(addMonthsToIsoDate("2026-05-01T00:00:00.000Z", 1)).toBe("2026-06-01T00:00:00.000Z");
    expect(addMonthsToIsoDate("2026-04-19T12:00:00.000Z", 1)).toBe("2026-05-19T12:00:00.000Z");
  });

  it("detecta una suscripcion activa solo si sigue vigente", () => {
    expect(
      hasActiveOrganizationSubscription({
        status: "active",
        current_period_end: "2026-05-10T00:00:00.000Z"
      })
    ).toBe(true);

    expect(
      hasActiveOrganizationSubscription({
        status: "paused",
        current_period_end: "2026-05-10T00:00:00.000Z"
      })
    ).toBe(false);

    expect(
      hasActiveOrganizationSubscription({
        status: "active",
        current_period_end: "2026-04-01T00:00:00.000Z"
      })
    ).toBe(false);
  });

  it("detecta fechas vencidas contra el reloj actual", () => {
    expect(isIsoDateExpired("2026-04-18T12:00:00.000Z")).toBe(true);
    expect(isIsoDateExpired("2026-04-20T12:00:00.000Z")).toBe(false);
  });

  it("usa el fin del periodo previo si todavia no vencio", () => {
    const period = resolveNextOrganizationBillingPeriod("2026-05-01T00:00:00.000Z");

    expect(period.periodStart).toBe("2026-05-01T00:00:00.000Z");
    expect(period.periodEnd).toBe("2026-06-01T00:00:00.000Z");
  });

  it("arranca desde ahora si no habia periodo o ya vencio", () => {
    const period = resolveNextOrganizationBillingPeriod("2026-04-01T00:00:00.000Z");

    expect(period.periodStart).toBe("2026-04-19T12:00:00.000Z");
    expect(period.periodEnd).toBe("2026-05-19T12:00:00.000Z");
  });

  it("si el trial sigue vigente usa ese fin como inicio del mes pago", () => {
    const period = resolveNextOrganizationBillingPeriod(null, "2026-05-01T00:00:00.000Z");

    expect(period.periodStart).toBe("2026-05-01T00:00:00.000Z");
    expect(period.periodEnd).toBe("2026-06-01T00:00:00.000Z");
  });

  it("prioriza la fecha mas lejana entre suscripcion activa y trial", () => {
    const period = resolveNextOrganizationBillingPeriod(
      "2026-06-10T00:00:00.000Z",
      "2026-05-01T00:00:00.000Z"
    );

    expect(period.periodStart).toBe("2026-06-10T00:00:00.000Z");
    expect(period.periodEnd).toBe("2026-07-10T00:00:00.000Z");
  });

  it("si el trial vencio y no hay plan inicia la retencion de fotos desde ese vencimiento", () => {
    const window = resolveOrganizationWriteWindow({
      organizationCreatedAt: "2026-02-01T00:00:00.000Z",
      subscription: null
    });

    expect(window.canWrite).toBe(false);
    expect(window.writeLockedAt).toBe("2026-03-03T00:00:00.000Z");
    expect(window.playerPhotosPurgeAt).toBe("2026-06-01T00:00:00.000Z");
    expect(window.playerPhotosRetentionExpired).toBe(false);
  });

  it("si hubo suscripcion, la retencion corre desde el fin del ultimo periodo pago", () => {
    const window = resolveOrganizationWriteWindow({
      organizationCreatedAt: "2026-02-01T00:00:00.000Z",
      subscription: {
        status: "active",
        current_period_end: "2026-04-10T00:00:00.000Z"
      }
    });

    expect(window.canWrite).toBe(false);
    expect(window.accessValidUntil).toBe("2026-04-10T00:00:00.000Z");
    expect(window.writeLockedAt).toBe("2026-04-10T00:00:00.000Z");
    expect(window.playerPhotosPurgeAt).toBe("2026-07-09T00:00:00.000Z");
    expect(window.playerPhotosRetentionExpired).toBe(false);
  });

  it("muestra el periodo de suscripcion aunque el acceso tecnico no tenga fecha", () => {
    expect(
      resolveOrganizationVisibleAccessValidUntil({
        subscription: {
          status: "active",
          current_period_end: "2026-05-20T00:00:00.000Z"
        },
        payments: [],
        fallbackAccessValidUntil: null
      })
    ).toBe("2026-05-20T00:00:00.000Z");
  });

  it("usa el ultimo pago aprobado como fallback visual del periodo", () => {
    expect(
      resolveOrganizationVisibleAccessValidUntil({
        subscription: null,
        payments: [
          {
            status: "pending",
            period_end: "2026-07-01T00:00:00.000Z"
          },
          {
            status: "approved",
            period_end: "2026-06-01T00:00:00.000Z"
          },
          {
            status: "approved",
            period_end: "2026-06-15T00:00:00.000Z"
          }
        ],
        fallbackAccessValidUntil: "2026-05-01T00:00:00.000Z"
      })
    ).toBe("2026-06-15T00:00:00.000Z");
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
