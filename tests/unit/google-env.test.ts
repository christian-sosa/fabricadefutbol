import { afterEach, describe, expect, it, vi } from "vitest";

describe("configuración opcional GA4", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
  it.each([undefined, "", "AW-123456", "G-<script>", "https://google.test/G-12345", "g-test12345"])("rechaza un ID ausente o inválido: %s", async (value) => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", value);
    vi.resetModules();
    const { getGoogleAnalyticsMeasurementId } = await import("@/lib/env");
    expect(getGoogleAnalyticsMeasurementId()).toBeNull();
  });
  it("acepta un ID GA4 con espacios exteriores sin expandir el valor a un script", async () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", " G-TEST12345 ");
    vi.resetModules();
    const { getGoogleAnalyticsMeasurementId } = await import("@/lib/env");
    expect(getGoogleAnalyticsMeasurementId()).toBe("G-TEST12345");
  });
});
