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

import { bulkCreatePlayersAction, bulkUpdatePlayersAction } from "@/app/admin/(panel)/players/actions";
import { createFakeSupabase } from "../helpers/fake-supabase";

describe("admin players actions", () => {
  it("carga una lista sin duplicar jugadores existentes ni cambiar su nivel", async () => {
    const organizationId = "00000000-0000-4000-8000-000000000001";
    const fake = createFakeSupabase({ players: [{ id: "existing", organization_id: organizationId, full_name: "Juan Pérez", initial_rank: 3, display_order: 4, skill_level: 2 }] });
    createSupabaseServerClientMock.mockResolvedValue(fake.client);
    const form = new FormData();
    form.set("organizationId", organizationId);
    form.set("names", "juan pérez\nNico López\nNico López\nDiego Ruiz");
    await expect(bulkCreatePlayersAction({ error: null }, form)).rejects.toMatchObject({ digest: expect.stringContaining("view=edit") });
    expect(fake.table("players")).toHaveLength(3);
    expect(fake.find("players", (row) => row.id === "existing")?.skill_level).toBe(2);
    expect(fake.find("players", (row) => row.full_name === "Nico López")).toMatchObject({ organization_id: organizationId, initial_rank: 4, display_order: 5, skill_level: 5 });
  });
  it("rechaza toda la lista inválida antes de escribir", async () => {
    const fake = createFakeSupabase({ players: [] });
    createSupabaseServerClientMock.mockResolvedValue(fake.client);
    const form = new FormData();
    form.set("organizationId", "00000000-0000-4000-8000-000000000001");
    form.set("names", "Juan Pérez\nX");
    expect((await bulkCreatePlayersAction({ error: null }, form)).error).toBeTruthy();
    expect(fake.table("players")).toHaveLength(0);
  });
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
    formData.append("skillLevel", "7");

    await expect(bulkUpdatePlayersAction(formData)).rejects.toMatchObject({
      digest: expect.stringContaining("/admin/players?org=la-banda")
    });

    expect(fake.find("players", (row) => row.id === playerId)).toMatchObject({
      full_name: "Juan Perez actualizado",
      skill_level: 7,
      current_rating: 1175
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/players");
  });
});
