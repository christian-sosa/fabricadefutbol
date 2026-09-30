import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); });

function stubPublicUrlEnv(values?: Partial<Record<string, string>>) {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_TARGET_ENV", values?.NEXT_PUBLIC_SUPABASE_TARGET_ENV ?? "production");
  vi.stubEnv("SUPABASE_TARGET_ENV", values?.SUPABASE_TARGET_ENV ?? "");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", values?.NEXT_PUBLIC_APP_URL ?? "");
  vi.stubEnv("APP_URL", values?.APP_URL ?? "");
  vi.stubEnv("NEXT_PUBLIC_APP_URL_DEV", values?.NEXT_PUBLIC_APP_URL_DEV ?? "");
  vi.stubEnv("APP_URL_DEV", values?.APP_URL_DEV ?? "");
  vi.stubEnv("NEXT_PUBLIC_APP_URL_PROD", values?.NEXT_PUBLIC_APP_URL_PROD ?? "");
  vi.stubEnv("APP_URL_PROD", values?.APP_URL_PROD ?? "");
}

async function publicUrlHelpers() {
  vi.resetModules();
  return import("@/lib/public-url");
}

describe("public URL helpers", () => {
  it("usa el dominio canonico por defecto", async () => {
    stubPublicUrlEnv();
    const { getPublicAppUrl } = await publicUrlHelpers();

    expect(getPublicAppUrl()).toBe("https://fabricadefutbol.com.ar");
  });

  it("arma URLs absolutas preservando query string", async () => {
    stubPublicUrlEnv();
    const { buildAbsolutePublicUrl } = await publicUrlHelpers();

    expect(buildAbsolutePublicUrl("/matches/abc-123?org=liga%20a")).toBe(
      "https://fabricadefutbol.com.ar/matches/abc-123?org=liga%20a"
    );
  });

  it("prioriza la URL publica configurada", async () => {
    stubPublicUrlEnv({
      NEXT_PUBLIC_APP_URL: "https://example.com/"
    });
    const { getPublicAppUrl, buildAbsolutePublicUrl } = await publicUrlHelpers();

    expect(getPublicAppUrl()).toBe("https://example.com");
    expect(buildAbsolutePublicUrl("matches/abc-123")).toBe("https://example.com/matches/abc-123");
  });

  it("usa el selector compartido para development aunque NODE_ENV sea production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    stubPublicUrlEnv({ NEXT_PUBLIC_SUPABASE_TARGET_ENV: "development", SUPABASE_TARGET_ENV: "production", NEXT_PUBLIC_APP_URL_DEV: "https://dev.example/", NEXT_PUBLIC_APP_URL: "https://prod.example" });
    const { getPublicAppUrl } = await publicUrlHelpers();
    expect(getPublicAppUrl()).toBe("https://dev.example");
  });

  it("production ignora el selector antiguo y URLs DEV aun en un servidor development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    stubPublicUrlEnv({ SUPABASE_TARGET_ENV: "development", NEXT_PUBLIC_APP_URL_DEV: "https://dev.example/", APP_URL_DEV: "https://other-dev.example", NEXT_PUBLIC_APP_URL_PROD: "https://prod.example/" });
    const { getPublicAppUrl } = await publicUrlHelpers();
    expect(getPublicAppUrl()).toBe("https://prod.example");
  });

  it("production no cae a un dominio DEV si faltan URLs productivas", async () => {
    stubPublicUrlEnv({ NEXT_PUBLIC_APP_URL_DEV: "https://dev.example", APP_URL_DEV: "https://other-dev.example" });
    const { getPublicAppUrl } = await publicUrlHelpers();
    expect(getPublicAppUrl()).toBe("https://fabricadefutbol.com.ar");
  });

  it("rechaza un destino compartido inválido", async () => {
    stubPublicUrlEnv({ NEXT_PUBLIC_SUPABASE_TARGET_ENV: "prod", NEXT_PUBLIC_APP_URL: "https://prod.example" });
    const { getPublicAppUrl } = await publicUrlHelpers();
    expect(getPublicAppUrl).toThrow("NEXT_PUBLIC_SUPABASE_TARGET_ENV");
  });
});
