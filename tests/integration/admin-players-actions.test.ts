import { describe, expect, it, vi } from "vitest";

const { createSupabaseServerClientMock, redirectMock, revalidatePathMock } = vi.hoisted(() => ({
  createSupabaseServerClientMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    const error = new Error(`NEXT_REDIRECT: ${url}`) as Error & { digest: string; url: string };
    error.digest = `NEXT_REDIRECT;replace;${url};false`;
    error.url = url;
    throw error;
  }),
  revalidatePathMock: vi.fn()
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
  refreshOrganizationPublicSnapshotSafe: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock
}));

import { bulkUpdatePlayersAction } from "@/app/admin/(panel)/players/actions";
import { createFakeSupabase } from "../helpers/fake-supabase";

describe("admin players actions", () => {
  it("permite guardar la planilla sin editar rendimiento", async () => {
    const organizationId = "00000000-0000-4000-8000-000000000001";
    const playerId = "00000000-0000-4000-8000-000000000002";
    const fake = createFakeSupabase({
      players: [
        {
          id: playerId,
          organization_id: organizationId,
          full_name: "Juan Perez",
          initial_rank: 1,
          skill_level: 3,
          current_rating: 1175,
          created_at: "2026-04-01T00:00:00.000Z"
        }
      ]
    });
    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    const formData = new FormData();
    formData.set("organizationId", organizationId);
    formData.append("playerId", playerId);
    formData.append("fullName", "Juan Perez actualizado");
    formData.append("skillLevel", "2");

    await expect(bulkUpdatePlayersAction(formData)).rejects.toMatchObject({
      digest: expect.stringContaining("/admin/players?org=la-banda")
    });

    expect(fake.find("players", (row) => row.id === playerId)).toMatchObject({
      full_name: "Juan Perez actualizado",
      skill_level: 2,
      current_rating: 1175
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/players");
  });
});
