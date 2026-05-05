import { afterEach, describe, expect, it, vi } from "vitest";

import { shouldSkipTournamentCheckoutForDebug } from "@/lib/features";

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
});
