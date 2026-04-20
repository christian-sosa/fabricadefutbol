import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  addDaysToIsoDate,
  addMonthsToIsoDate,
  getOrganizationTrialEndsAt,
  hasActiveOrganizationSubscription,
  resolveNextOrganizationBillingPeriod
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
});
