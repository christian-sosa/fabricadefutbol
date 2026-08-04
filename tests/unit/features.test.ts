import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CLUBS_PRODUCT_STAGE,
  TOURNAMENTS_PRODUCT_STAGE,
  canAccessClubsProduct,
  canAccessTournamentsProduct,
  shouldSkipTournamentCheckoutForDebug
} from "@/lib/features";

describe("feature flags", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("saltea checkout de torneos solo en desarrollo local", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(shouldSkipTournamentCheckoutForDebug()).toBe(true);

    vi.stubEnv("NODE_ENV", "production");
    expect(shouldSkipTournamentCheckoutForDebug()).toBe(false);
  });

  it("mantiene Torneos como producto futuro interno para super admin", () => {
    expect(TOURNAMENTS_PRODUCT_STAGE).toBe("future-internal");
    expect(canAccessTournamentsProduct({ isSuperAdmin: true })).toBe(true);
    expect(canAccessTournamentsProduct({ isSuperAdmin: false })).toBe(false);
  });

  it("mantiene Clubes disponible para desarrollo pero apagado en produccion", () => {
    expect(CLUBS_PRODUCT_STAGE).toBe("development-only");
    expect(canAccessClubsProduct("development")).toBe(true);
    expect(canAccessClubsProduct("test")).toBe(true);
    expect(canAccessClubsProduct("production")).toBe(false);
  });
});
