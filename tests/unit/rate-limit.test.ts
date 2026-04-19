import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { checkRateLimit, getClientIpFromHeaders } from "@/lib/rate-limit";

describe("rate-limit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("permite hasta el limite y luego bloquea", () => {
    const key = `ip-${Date.now()}`;

    expect(checkRateLimit({ key, limit: 2, windowMs: 1000 })).toEqual({
      allowed: true,
      remaining: 1,
      retryAfterMs: 0
    });
    expect(checkRateLimit({ key, limit: 2, windowMs: 1000 })).toEqual({
      allowed: true,
      remaining: 0,
      retryAfterMs: 0
    });

    const blocked = checkRateLimit({ key, limit: 2, windowMs: 1000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBe(1000);
  });

  it("reinicia la ventana cuando vence", () => {
    const key = `ip-reset-${Date.now()}`;

    checkRateLimit({ key, limit: 1, windowMs: 1000 });
    vi.advanceTimersByTime(1001);

    expect(checkRateLimit({ key, limit: 1, windowMs: 1000 })).toEqual({
      allowed: true,
      remaining: 0,
      retryAfterMs: 0
    });
  });

  it("extrae la IP priorizando x-forwarded-for", () => {
    expect(
      getClientIpFromHeaders({
        get(name: string) {
          if (name === "x-forwarded-for") return "1.1.1.1, 2.2.2.2";
          if (name === "x-real-ip") return "3.3.3.3";
          return null;
        }
      })
    ).toBe("1.1.1.1");

    expect(
      getClientIpFromHeaders({
        get(name: string) {
          if (name === "x-real-ip") return "3.3.3.3";
          return null;
        }
      })
    ).toBe("3.3.3.3");

    expect(
      getClientIpFromHeaders({
        get() {
          return null;
        }
      })
    ).toBe("unknown");
  });
});
