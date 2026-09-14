import { beforeEach, describe, expect, it, vi } from "vitest";
const { limit } = vi.hoisted(() => ({ limit: vi.fn() }));
vi.mock("@/lib/shared-rate-limit", () => ({ checkSharedRateLimit: limit }));
import { POST } from "@/app/api/security/csp-report/route";

describe("CSP reports", () => {
  beforeEach(() => { vi.restoreAllMocks(); limit.mockResolvedValue({ allowed: true }); });
  const request = (body: unknown, headers?: Record<string, string>) => new Request("https://fdf.example/api/security/csp-report", { method: "POST", headers, body: JSON.stringify(body) });
  it("retains only directive and origin, omitting URLs, tokens and script snippets", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const response = await POST(request({ "csp-report": { "effective-directive": "script-src-elem", "blocked-uri": "https://cdn.example/private?token=secret", "document-uri": "https://fdf.example/auth/recovery?code=private", "script-sample": "sensitive" } }));
    expect(response.status).toBe(204);
    expect(log).toHaveBeenCalledWith("[security] csp report", { directive: "script-src-elem", blockedOrigin: "https://cdn.example" });
  });
  it("bounds streaming bodies without relying on Content-Length", async () => {
    expect((await POST(request({ data: "x".repeat(9000) }))).status).toBe(413);
  });
  it("rejects untrusted origins, malformed reports and excess requests", async () => {
    expect((await POST(request({}, { origin: "https://evil.example" }))).status).toBe(403);
    expect((await POST(request({ "csp-report": { "effective-directive": "unsafe\nlog" } }))).status).toBe(400);
    limit.mockResolvedValue({ allowed: false });
    expect((await POST(request({}))).status).toBe(429);
  });
});
