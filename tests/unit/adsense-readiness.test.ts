import { afterEach, describe, expect, it, vi } from "vitest";

describe("adsense readiness env", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("no habilita ads si falta el client id aunque el flag este activo", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_ADS", "true");
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT_ID", "");
    const { getAdsenseClientId, shouldRenderAds } = await import("@/lib/env");

    expect(shouldRenderAds()).toBe(true);
    expect(getAdsenseClientId()).toBeNull();
  });

  it("lee el publisher publico cuando esta configurado", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_ADS", "true");
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT_ID", "ca-pub-7913239873831344");
    const { getAdsenseClientId } = await import("@/lib/env");

    expect(getAdsenseClientId()).toBe("ca-pub-7913239873831344");
  });
});
