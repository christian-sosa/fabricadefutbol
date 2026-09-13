import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { record, limit } = vi.hoisted(() => ({ record: vi.fn(async () => ({ recorded: true })), limit: vi.fn(() => ({ allowed: true })) }));
vi.mock("@/lib/analytics/server", () => ({ recordAnalyticsEvent: record }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: limit, getClientIpFromHeaders: () => "test-ip" }));
import { POST } from "@/app/api/analytics/events/route";
const sessionId = "00000000-0000-4000-8000-000000000001";
const request = (body: unknown, headers: Record<string, string> = {}) => new NextRequest("https://fdf.example/api/analytics/events", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", origin: "https://fdf.example", ...headers } });

describe("endpoint público de analytics", () => {
  beforeEach(() => { vi.clearAllMocks(); limit.mockReturnValue({ allowed: true }); });
  it("no permite falsificar hechos del servidor ni IDs de otros usuarios", async () => {
    for (const eventName of ["group_created", "match_created", "match_finished", "admin_login_succeeded", "payment_approved"]) expect((await POST(request({ eventName }))).status).toBe(400);
    expect((await POST(request({ eventName: "cta_clicked", adminId: sessionId }))).status).toBe(400);
    expect(record).not.toHaveBeenCalled();
  });
  it("acota el cuerpo aunque se declare un tamaño menor y limita antes de persistir", async () => {
    expect((await POST(request({ eventName: "cta_clicked", properties: { source: "x".repeat(9000) } }, { "content-length": "0" }))).status).toBe(413);
    limit.mockReturnValue({ allowed: false });
    expect((await POST(request({ eventName: "cta_clicked" }))).status).toBe(429);
    expect(record).not.toHaveBeenCalled();
  });
  it("rechaza solicitudes de otro origen", async () => {
    expect((await POST(request({ eventName: "cta_clicked" }, { origin: "https://other.example" }))).status).toBe(403);
    expect(record).not.toHaveBeenCalled();
  });
  it("registra referencias acotadas y conserva atribución sin tokens de URL", async () => {
    const response = await POST(request({ eventName: "referral_visit", sessionId, source: "server_action", path: "/ranking?token=private", properties: { content: "ranking", token: "private" } }));
    expect(response.status).toBe(200);
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ eventKey: `referral_visit:${sessionId}`, source: "client", path: "/ranking", properties: expect.objectContaining({ session_id: sessionId, referral_source: "whatsapp" }) }));
    expect(JSON.stringify(record.mock.calls)).not.toContain("private");
    expect(response.cookies.get("fdf_analytics_referral")?.httpOnly).toBe(true);
    expect(response.cookies.get("fdf_analytics_referral")?.maxAge).toBe(30 * 86400);
  });
});
