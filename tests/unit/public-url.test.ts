import { describe, expect, it, vi } from "vitest";

import { buildAbsolutePublicUrl, getPublicAppUrl } from "@/lib/public-url";

function stubPublicUrlEnv(values?: Partial<Record<string, string>>) {
  vi.stubEnv("SUPABASE_TARGET_ENV", values?.SUPABASE_TARGET_ENV ?? "");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", values?.NEXT_PUBLIC_APP_URL ?? "");
  vi.stubEnv("APP_URL", values?.APP_URL ?? "");
  vi.stubEnv("NEXT_PUBLIC_APP_URL_DEV", values?.NEXT_PUBLIC_APP_URL_DEV ?? "");
  vi.stubEnv("APP_URL_DEV", values?.APP_URL_DEV ?? "");
  vi.stubEnv("NEXT_PUBLIC_APP_URL_PROD", values?.NEXT_PUBLIC_APP_URL_PROD ?? "");
  vi.stubEnv("APP_URL_PROD", values?.APP_URL_PROD ?? "");
}

describe("public URL helpers", () => {
  it("usa el dominio canonico por defecto", () => {
    stubPublicUrlEnv();

    expect(getPublicAppUrl()).toBe("https://fabricadefutbol.com.ar");
  });

  it("arma URLs absolutas preservando query string", () => {
    stubPublicUrlEnv();

    expect(buildAbsolutePublicUrl("/matches/abc-123?org=liga%20a")).toBe(
      "https://fabricadefutbol.com.ar/matches/abc-123?org=liga%20a"
    );
  });

  it("prioriza la URL publica configurada", () => {
    stubPublicUrlEnv({
      NEXT_PUBLIC_APP_URL: "https://example.com/"
    });

    expect(getPublicAppUrl()).toBe("https://example.com");
    expect(buildAbsolutePublicUrl("matches/abc-123")).toBe("https://example.com/matches/abc-123");
  });
});
