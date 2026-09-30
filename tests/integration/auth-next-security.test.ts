import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { exchangeCodeForSession, verifyOtp } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(), verifyOtp: vi.fn()
}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { exchangeCodeForSession, verifyOtp } }) }));

import { GET as oauthCallback } from "@/app/auth/callback/route";
import { GET as emailConfirmation } from "@/app/auth/confirm/route";

const origin = "https://fabricadefutbol.com.ar";
beforeEach(() => { exchangeCodeForSession.mockResolvedValue({ error: null }); verifyOtp.mockResolvedValue({ error: null }); });

describe("authentication redirect destinations", () => {
  it.each(["/\n/evil.example", "/\r/evil.example", "/\t\\evil.example", "/admin/..//evil.example"])("keeps authenticated callback and confirmation local for %j", async (next) => {
    const callback = await oauthCallback(new NextRequest(`${origin}/auth/callback?code=test-code&next=${encodeURIComponent(next)}`));
    const confirmation = await emailConfirmation(new NextRequest(`${origin}/auth/confirm?token_hash=test-token&type=signup&next=${encodeURIComponent(next)}`));
    expect(callback.headers.get("location")).toBe(`${origin}/admin`);
    expect(confirmation.headers.get("location")).toBe(`${origin}/admin/login?confirmed=1`);
  });

  it("preserves invitation paths, query parameters and fragments after login or signup", async () => {
    const next = "/invite/fixture-token?org=la%20banda#accept";
    const callback = await oauthCallback(new NextRequest(`${origin}/auth/callback?code=test-code&next=${encodeURIComponent(next)}`));
    const confirmation = await emailConfirmation(new NextRequest(`${origin}/auth/confirm?code=test-code&next=${encodeURIComponent(next)}`));
    expect(callback.headers.get("location")).toBe(`${origin}${next}`);
    expect(confirmation.headers.get("location")).toBe(`${origin}/invite/fixture-token?org=la+banda&confirmed=1#accept`);
  });

  it("keeps recovery on reset-password regardless of the optional next destination", async () => {
    const confirmation = await emailConfirmation(new NextRequest(`${origin}/auth/confirm?token_hash=test-token&type=recovery&next=${encodeURIComponent("/\n/evil.example")}`));
    expect(confirmation.headers.get("location")).toBe(`${origin}/admin/reset-password`);
  });
});
