import { afterEach, describe, expect, it, vi } from "vitest";

import { isTournamentsEnabled, shouldSkipTournamentCheckoutForDebug } from "@/lib/features";

describe("feature flags", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("habilita torneos por defecto en test/desarrollo", () => {
    expect(isTournamentsEnabled()).toBe(true);
  });

  it("permite apagar torneos con NEXT_PUBLIC_TOURNAMENTS_ENABLED", () => {
    vi.stubEnv("NEXT_PUBLIC_TOURNAMENTS_ENABLED", "false");

    expect(isTournamentsEnabled()).toBe(false);
  });

  it("permite prender torneos explicitamente con NEXT_PUBLIC_TOURNAMENTS_ENABLED", () => {
    vi.stubEnv("NEXT_PUBLIC_TOURNAMENTS_ENABLED", "true");

    expect(isTournamentsEnabled()).toBe(true);
  });

  it("saltea checkout de torneos solo en desarrollo local", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(shouldSkipTournamentCheckoutForDebug()).toBe(true);

    vi.stubEnv("NODE_ENV", "production");
    expect(shouldSkipTournamentCheckoutForDebug()).toBe(false);
  });
});
