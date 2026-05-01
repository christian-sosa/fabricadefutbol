import { describe, expect, it } from "vitest";

import {
  buildGroupPaymentValueState,
  getDaysUntilAccessEnds
} from "@/lib/group-payment-value";

const NOW = new Date("2026-05-01T12:00:00.000Z");

describe("group payment value helpers", () => {
  it("calcula dias restantes redondeando hacia arriba", () => {
    expect(getDaysUntilAccessEnds("2026-05-04T11:00:00.000Z", NOW)).toBe(3);
  });

  it("marca como primeros pasos cuando aun no hay jugadores", () => {
    expect(
      buildGroupPaymentValueState({
        playersCount: 0,
        totalMatches: 0,
        finishedCount: 0,
        canWrite: true,
        subscriptionActive: false,
        accessValidUntil: "2026-05-20T00:00:00.000Z",
        now: NOW
      }).stage
    ).toBe("setup");
  });

  it("marca valor probado cuando ya hay resultados cargados", () => {
    const state = buildGroupPaymentValueState({
      playersCount: 16,
      totalMatches: 5,
      finishedCount: 3,
      canWrite: true,
      subscriptionActive: false,
      accessValidUntil: "2026-05-03T00:00:00.000Z",
      now: NOW
    });

    expect(state.stage).toBe("proven");
    expect(state.accessTone).toBe("trial_ending");
  });

  it("marca plan activo cuando hay suscripcion", () => {
    const state = buildGroupPaymentValueState({
      playersCount: 18,
      totalMatches: 8,
      finishedCount: 6,
      canWrite: true,
      subscriptionActive: true,
      accessValidUntil: "2026-06-01T00:00:00.000Z",
      now: NOW
    });

    expect(state.accessTone).toBe("paid");
  });

  it("marca acceso bloqueado cuando no se puede escribir", () => {
    const state = buildGroupPaymentValueState({
      playersCount: 12,
      totalMatches: 2,
      finishedCount: 1,
      canWrite: false,
      subscriptionActive: false,
      accessValidUntil: "2026-04-01T00:00:00.000Z",
      now: NOW
    });

    expect(state.accessTone).toBe("locked");
  });
});
