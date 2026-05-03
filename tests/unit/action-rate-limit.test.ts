import { describe, expect, it } from "vitest";

import {
  buildActionRateLimitKey,
  formatActionRateLimitMessage
} from "@/lib/action-rate-limit";

describe("action rate limit", () => {
  it("arma claves estables separando accion, usuario, grupo e ip", () => {
    expect(
      buildActionRateLimitKey({
        scope: "organization-admins:invite",
        actorId: "admin-1",
        organizationId: "org-1",
        clientIp: "1.1.1.1"
      })
    ).toBe("action:organization-admins_invite:admin-1:org-1:1.1.1.1");
  });

  it("normaliza valores vacios o con separadores raros", () => {
    expect(
      buildActionRateLimitKey({
        scope: "organizations/create",
        actorId: "",
        clientIp: "unknown:user"
      })
    ).toBe("action:organizations_create:anonymous:global:unknown_user");
  });

  it("formatea mensajes humanos con espera en minutos o segundos", () => {
    expect(formatActionRateLimitMessage({ retryAfterMs: 90_000 })).toBe(
      "Demasiados intentos seguidos. Volve a probar en 2 minutos."
    );
    expect(formatActionRateLimitMessage({ retryAfterMs: 20_000 })).toBe(
      "Demasiados intentos seguidos. Volve a probar en 20 segundos."
    );
  });
});
