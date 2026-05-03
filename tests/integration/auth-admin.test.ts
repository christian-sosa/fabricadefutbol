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
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T12:00:00.000Z"));
    createSupabaseServerClientMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("permite crear el primer grupo free si no administra ninguno", async () => {
    const fake = createFakeSupabase();
    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    await expect(getAdminOrganizationCreationAccess(ADMIN_SESSION)).resolves.toEqual({
      canCreateOrganization: true,
      reason: null
    });
  });

  it("bloquea el grupo free si ya creo un grupo", async () => {
    const fake = createFakeSupabase({
      organizations: [
        {
          id: "org-1",
          name: "Liga A",
          slug: "liga-a",
          created_by: ADMIN_SESSION.userId,
          created_at: "2026-04-10T00:00:00.000Z"
        }
      ]
    });
    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    await expect(getAdminOrganizationCreationAccess(ADMIN_SESSION)).resolves.toEqual({
      canCreateOrganization: false,
      reason:
        "Ya tenés un grupo para administrar. Si querés sumar otro, escribinos y lo habilitamos manualmente."
    });
  });

  it("bloquea el grupo free si ya administra un grupo por invitacion", async () => {
    const fake = createFakeSupabase({
      organizations: [
        {
          id: "org-1",
          name: "Liga A",
          slug: "liga-a",
          created_by: "other-admin",
          created_at: "2026-04-10T00:00:00.000Z"
        }
      ],
      organization_admins: [
        {
          id: "org-admin-1",
          organization_id: "org-1",
          admin_id: ADMIN_SESSION.userId
        }
      ]
    });
    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    await expect(getAdminOrganizationCreationAccess(ADMIN_SESSION)).resolves.toEqual({
      canCreateOrganization: false,
      reason:
        "Ya administrás un grupo. Si querés sumar otro, escribinos y lo habilitamos manualmente."
    });
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
      reason: null,
      accessValidUntil: null,
      writeLockedAt: null,
      organizationTrialEndsAt: null,
      organizationTrialExpired: false,
      adminTrialEndsAt: null,
      adminTrialExpired: false,
      subscriptionStatus: null,
      subscriptionCurrentPeriodEnd: null,
      subscriptionActive: false,
      playerPhotosPurgeAt: null,
      playerPhotosRetentionExpired: false,
      playerPhotosPurgedAt: null
    });
  });
});
