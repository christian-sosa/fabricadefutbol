import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

async function loadNextConfig(caseName: string) {
  const configUrl = pathToFileURL(path.join(process.cwd(), "next.config.mjs"));
  return (await import(`${configUrl.href}?case=${caseName}-${Date.now()}`)).default;
}

describe("next config security", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("no permite origins de desarrollo para Server Actions en produccion", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MERCADOPAGO_WEBHOOK_BASE_URL", "https://fabricadefutbol.com.ar");
    vi.stubEnv("MERCADOPAGO_WEBHOOK_BASE_URL_DEV", "https://dev-tunnel.ngrok-free.app");
    vi.stubEnv("NGROK_URL", "https://local-tunnel.ngrok-free.app");

    const config = await loadNextConfig("production-origins");

    expect(config.allowedDevOrigins).toBeUndefined();
    expect(config.experimental?.serverActions?.allowedOrigins).toBeUndefined();
  });

  it("mantiene origins de desarrollo fuera de produccion", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("MERCADOPAGO_WEBHOOK_BASE_URL_DEV", "https://dev-tunnel.ngrok-free.app/hook");
    vi.stubEnv("NGROK_URL", "https://local-tunnel.ngrok-free.app");

    const config = await loadNextConfig("development-origins");

    expect(config.allowedDevOrigins).toEqual([
      "dev-tunnel.ngrok-free.app",
      "local-tunnel.ngrok-free.app"
    ]);
    expect(config.experimental?.serverActions?.allowedOrigins).toEqual(config.allowedDevOrigins);
  });

  it("permite Server Actions con imagenes optimizadas del admin", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const config = await loadNextConfig("server-action-body-size");

    expect(config.experimental?.serverActions?.bodySizeLimit).toBe("30mb");
  });

  it("declara headers de seguridad globales que no rompen scripts de Next", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const config = await loadNextConfig("headers");
    const headers = await config.headers();

    expect(headers).toEqual([
      {
        source: "/:path*",
        headers: expect.arrayContaining([
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }
        ])
      }
    ]);
  });
});
