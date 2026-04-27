import { afterEach, describe, expect, it, vi } from "vitest";

import { logError, logInfo, logWarn, serializeError } from "@/lib/observability/log";

describe("observability logs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("emite logs info como JSON estructurado", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    logInfo("test.event", {
      organizationId: "org-1",
      nested: { ok: true }
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(spy.mock.calls[0]?.[0]));
    expect(payload).toMatchObject({
      level: "info",
      event: "test.event",
      organizationId: "org-1",
      nested: { ok: true }
    });
    expect(payload.timestamp).toEqual(expect.any(String));
  });

  it("emite warnings y errores en el canal correcto", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logWarn("test.warn", { reason: "soft" });
    logError("test.error", new Error("boom"), { area: "payments" });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(warnSpy.mock.calls[0]?.[0]))).toMatchObject({
      level: "warn",
      event: "test.warn",
      reason: "soft"
    });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(errorSpy.mock.calls[0]?.[0]))).toMatchObject({
      level: "error",
      event: "test.error",
      area: "payments",
      error: {
        name: "Error",
        message: "boom"
      }
    });
  });

  it("oculta stack traces serializados en produccion", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(serializeError(new Error("prod error"))).toEqual({
      name: "Error",
      message: "prod error",
      stack: undefined
    });
  });
});
