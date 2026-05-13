import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createSupabaseServerClientMock,
  redirectMock,
  revalidatePathMock,
  refreshOrganizationPublicSnapshotSafeMock,
  saveMatchResultMock
} = vi.hoisted(() => ({
  createSupabaseServerClientMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    const error = new Error(`NEXT_REDIRECT: ${url}`) as Error & { digest: string; url: string };
    error.digest = `NEXT_REDIRECT;replace;${url};false`;
    error.url = url;
    throw error;
  }),
  revalidatePathMock: vi.fn(),
  refreshOrganizationPublicSnapshotSafeMock: vi.fn(),
  saveMatchResultMock: vi.fn()
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

vi.mock("@/lib/next-redirect", () => ({
  isNextRedirectError: (error: unknown) =>
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
}));

vi.mock("@/lib/auth/admin", () => ({
  assertOrganizationAdminAction: vi.fn(async () => ({
    userId: "admin-1",
    email: "admin@example.com",
    displayName: "Admin",
    isSuperAdmin: false
  })),
  getOrganizationQueryKeyById: vi.fn(async () => "la-banda")
}));

vi.mock("@/lib/queries/public", () => ({
  refreshOrganizationPublicSnapshotSafe: refreshOrganizationPublicSnapshotSafeMock
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock
}));

vi.mock("@/lib/domain/match-workflow", () => ({
  confirmTeamOption: vi.fn(),
  regenerateDraftTeamOptions: vi.fn(),
  saveConfirmedMatchLineup: vi.fn(),
  saveMatchResult: saveMatchResultMock
}));

import { saveResultAction } from "@/app/admin/(panel)/matches/[id]/actions";

describe("admin match result actions", () => {
  beforeEach(() => {
    createSupabaseServerClientMock.mockResolvedValue({ from: vi.fn() });
    redirectMock.mockClear();
    revalidatePathMock.mockClear();
    refreshOrganizationPublicSnapshotSafeMock.mockClear();
    saveMatchResultMock.mockClear();
    saveMatchResultMock.mockResolvedValue(undefined);
  });

  it("vuelve al listado editable de partidos despues de cargar un resultado", async () => {
    const formData = new FormData();
    formData.set("scoreA", "3");
    formData.set("scoreB", "2");
    formData.set("notes", "");
    formData.set("mvpParticipantId", "");
    formData.set("lineupPayload", "");

    await expect(saveResultAction("match-1", "org-1", formData)).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT")
    });

    const redirectedTo = redirectMock.mock.calls.at(-1)?.[0];
    expect(typeof redirectedTo).toBe("string");
    const redirectUrl = new URL(String(redirectedTo), "http://localhost");

    expect(redirectUrl.pathname).toBe("/admin/matches");
    expect(redirectUrl.searchParams.get("org")).toBe("la-banda");
    expect(redirectUrl.searchParams.get("view")).toBe("edit");
    expect(redirectUrl.searchParams.get("success")).toBe("Resultado guardado.");
    expect(String(redirectedTo)).not.toContain("/admin/matches/match-1");
    expect(saveMatchResultMock).toHaveBeenCalledWith(
      expect.objectContaining({
        matchId: "match-1",
        organizationId: "org-1"
      })
    );
    expect(refreshOrganizationPublicSnapshotSafeMock).toHaveBeenCalledWith("org-1");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/matches");
  });
});
