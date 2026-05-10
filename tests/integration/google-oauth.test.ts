import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { createSupabaseServerClientMock, redirectMock } = vi.hoisted(() => ({
  createSupabaseServerClientMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    const error = new Error(`NEXT_REDIRECT: ${url}`) as Error & { digest: string; url: string };
    error.digest = `NEXT_REDIRECT;replace;${url};false`;
    error.url = url;
    throw error;
  })
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock
}));

import { loginWithGoogleAction } from "@/app/admin/(auth)/login/actions";
import { GET as googleOAuthCallback } from "@/app/auth/callback/route";

describe("google oauth login", () => {
  beforeEach(() => {
    createSupabaseServerClientMock.mockReset();
    redirectMock.mockClear();
    process.env.APP_URL = "https://fabricadefutbol.com.ar";
    process.env.NEXT_PUBLIC_APP_URL = "https://fabricadefutbol.com.ar";
  });

  it("starts Google OAuth with a safe callback redirect", async () => {
    const signInWithOAuth = vi.fn(async () => ({
      data: {
        url: "https://supabase.example/auth/v1/authorize?provider=google"
      },
      error: null
    }));
    createSupabaseServerClientMock.mockResolvedValue({
      auth: {
        signInWithOAuth
      }
    });

    const formData = new FormData();
    formData.set("next", "/admin/clubs");

    await expect(loginWithGoogleAction(formData)).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT")
    });

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "https://fabricadefutbol.com.ar/auth/callback?next=%2Fadmin%2Fclubs"
      }
    });
    expect(redirectMock).toHaveBeenLastCalledWith(
      "https://supabase.example/auth/v1/authorize?provider=google"
    );
  });

  it("falls back to /admin when OAuth next is unsafe", async () => {
    const signInWithOAuth = vi.fn(async () => ({
      data: {
        url: "https://supabase.example/auth/v1/authorize?provider=google"
      },
      error: null
    }));
    createSupabaseServerClientMock.mockResolvedValue({
      auth: {
        signInWithOAuth
      }
    });

    const formData = new FormData();
    formData.set("next", "https://evil.example/admin");

    await expect(loginWithGoogleAction(formData)).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT")
    });

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "https://fabricadefutbol.com.ar/auth/callback?next=%2Fadmin"
      }
    });
  });

  it("exchanges the OAuth code and redirects to the requested admin path", async () => {
    const exchangeCodeForSession = vi.fn(async () => ({ error: null }));
    createSupabaseServerClientMock.mockResolvedValue({
      auth: {
        exchangeCodeForSession
      }
    });

    const response = await googleOAuthCallback(
      new NextRequest("https://fabricadefutbol.com.ar/auth/callback?code=oauth-code&next=%2Fadmin%2Fclubs")
    );

    expect(exchangeCodeForSession).toHaveBeenCalledWith("oauth-code");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://fabricadefutbol.com.ar/admin/clubs");
  });

  it("preserves query params in safe OAuth next paths", async () => {
    const exchangeCodeForSession = vi.fn(async () => ({ error: null }));
    createSupabaseServerClientMock.mockResolvedValue({
      auth: {
        exchangeCodeForSession
      }
    });

    const response = await googleOAuthCallback(
      new NextRequest(
        "https://fabricadefutbol.com.ar/auth/callback?code=oauth-code&next=%2Fadmin%3Forg%3Dliga-a"
      )
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://fabricadefutbol.com.ar/admin?org=liga-a");
  });

  it("rejects callback requests without a code", async () => {
    const response = await googleOAuthCallback(
      new NextRequest("https://fabricadefutbol.com.ar/auth/callback?next=%2Fadmin%2Fclubs")
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("https://fabricadefutbol.com.ar/admin/login");
    expect(response.headers.get("location")).toContain("error=");
  });
});
