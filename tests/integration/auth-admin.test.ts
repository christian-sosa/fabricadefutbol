import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseServerClientMock } = vi.hoisted(() => ({
  createSupabaseServerClientMock: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock
}));

import { getAdminOrganizationCreationAccess, getOrganizationWriteAccess } from "@/lib/auth/admin";
import { createFakeSupabase } from "../helpers/fake-supabase";

const ADMIN_SESSION = {
  userId: "admin-1",
  email: "admin@example.com",
  displayName: "Admin",
  isSuperAdmin: false
} as const;

describe("admin group creation access", () => {
  it("an archived group remains read-only even for a superadmin", async () => {
    const fake = createFakeSupabase({ organizations: [{ id: "archived", archived_at: "2026-09-14T00:00:00Z" }] });
    createSupabaseServerClientMock.mockResolvedValue(fake.client);
    await expect(getOrganizationWriteAccess({ ...ADMIN_SESSION, isSuperAdmin: true }, "archived"))
      .resolves.toEqual({ canWrite: false, reason: expect.stringContaining("archivado") });
  });
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T12:00:00.000Z"));
    createSupabaseServerClientMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["permite crear cuando SQL lo autoriza", true],
    ["cuenta un grupo archivado aunque RLS no lo liste", false]
  ])("%s", async (_name, allowed) => {
    const rpc = vi.fn(async () => ({ data: allowed, error: null }));
    createSupabaseServerClientMock.mockResolvedValue({ rpc });
    const result = await getAdminOrganizationCreationAccess(ADMIN_SESSION);
    expect(result.canCreateOrganization).toBe(allowed);
    expect(rpc).toHaveBeenCalledWith("can_create_organization");
    expect(result.reason).toEqual(allowed ? null : expect.stringContaining("Ya tenés un grupo"));
  });

  it("usa también la autoridad SQL para la excepción del superadmin", async () => {
    createSupabaseServerClientMock.mockResolvedValue({ rpc: vi.fn(async () => ({ data: true, error: null })) });
    expect((await getAdminOrganizationCreationAccess({ ...ADMIN_SESSION, isSuperAdmin: true })).canCreateOrganization).toBe(true);
  });

  it("no habilita crear si no pudo comprobar la política", async () => {
    createSupabaseServerClientMock.mockResolvedValue({ rpc: vi.fn(async () => ({ data: null, error: { message: "offline" } })) });
    await expect(getAdminOrganizationCreationAccess(ADMIN_SESSION)).rejects.toThrow("No se pudo verificar");
  });

  it("habilita escritura en grupos existentes aunque ya no haya trial o suscripcion activa", async () => {
    const fake = createFakeSupabase({
      organizations: [
        {
          id: "org-1",
          name: "Liga A",
          slug: "liga-a",
          created_by: ADMIN_SESSION.userId,
          created_at: "2025-01-01T00:00:00.000Z",
          player_photos_purge_at: "2025-08-01T00:00:00.000Z",
          player_photos_purged_at: "2025-08-02T00:00:00.000Z"
        }
      ]
    });
    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    await expect(getOrganizationWriteAccess(ADMIN_SESSION, "org-1")).resolves.toMatchObject({
      canWrite: true,
      reason: null
    });
  });
});
