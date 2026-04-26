import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

describe("disabled tournament routing", () => {
  it("devuelve 404 para rutas publicas de torneos cuando la flag esta apagada", async () => {
    vi.stubEnv("NEXT_PUBLIC_TOURNAMENTS_ENABLED", "false");
    const { proxy } = await import("../../proxy");

    const response = await proxy(new NextRequest("https://fabricadefutbol.test/tournaments/la-liga"));

    expect(response.status).toBe(404);
  });

  it("redirige el admin de torneos al panel cuando la flag esta apagada", async () => {
    vi.stubEnv("NEXT_PUBLIC_TOURNAMENTS_ENABLED", "false");
    const { proxy } = await import("../../proxy");

    const response = await proxy(new NextRequest("https://fabricadefutbol.test/admin/tournaments"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/admin?error=");
  });
});
