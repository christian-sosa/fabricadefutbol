import { afterEach, describe, expect, it, vi } from "vitest";

import {
  TOURNAMENTS_PRODUCT_STAGE,
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
});
