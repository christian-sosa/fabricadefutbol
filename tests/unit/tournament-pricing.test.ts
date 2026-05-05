import { afterEach, describe, expect, it, vi } from "vitest";

async function loadConstants() {
  vi.resetModules();
  return import("@/lib/constants");
}

describe("tournament pricing", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("usa el precio comercial de referencia cuando no hay override", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TOURNAMENT_MONTHLY_PRICE_ARS", "");
    vi.stubEnv("SKIP_TOURNAMENT_CHECKOUT", "false");

    const constants = await loadConstants();

    expect(constants.TOURNAMENT_MONTHLY_PRICE_ARS).toBe(50000);
    expect(constants.TOURNAMENT_MONTHLY_CHECKOUT_PRICE_ARS).toBe(50000);
  });

  it("permite configurar el precio mensual real por entorno", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TOURNAMENT_MONTHLY_PRICE_ARS", "72000");
    vi.stubEnv("SKIP_TOURNAMENT_CHECKOUT", "false");

    const constants = await loadConstants();

    expect(constants.TOURNAMENT_MONTHLY_PRICE_ARS).toBe(72000);
    expect(constants.TOURNAMENT_MONTHLY_CHECKOUT_PRICE_ARS).toBe(72000);
  });

  it("usa precio debug solo cuando el checkout de torneos esta salteado", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("TOURNAMENT_MONTHLY_PRICE_ARS", "72000");
    vi.stubEnv("SKIP_TOURNAMENT_CHECKOUT", "true");

    const constants = await loadConstants();

    expect(constants.TOURNAMENT_MONTHLY_PRICE_ARS).toBe(72000);
    expect(constants.TOURNAMENT_MONTHLY_CHECKOUT_PRICE_ARS).toBe(100);
  });
});
