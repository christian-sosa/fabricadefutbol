import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseServerClientMock } = vi.hoisted(() => ({
  createSupabaseServerClientMock: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock
}));

import { getAdminOrganizationCreationAccess } from "@/lib/auth/admin";
import { createFakeSupabase } from "../helpers/fake-supabase";

const ADMIN_SESSION = {
  userId: "admin-1",
  email: "admin@example.com",
  displayName: "Admin",
  isSuperAdmin: false
} as const;

describe("admin organization creation access", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T12:00:00.000Z"));
    createSupabaseServerClientMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("permite crear la primera organizacion free si no administra ninguna", async () => {
    const fake = createFakeSupabase();
    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    await expect(getAdminOrganizationCreationAccess(ADMIN_SESSION)).resolves.toEqual({
      canCreateOrganization: true,
      reason: null
    });
  });

  it("bloquea la organizacion free si ya creo una organizacion", async () => {
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
        "Ya consumiste tu organizacion free. Para crear una nueva vas a necesitar activar el plan pago."
    });
  });

  it("bloquea la organizacion free si ya administra una organizacion por invitacion", async () => {
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
        "Ya administras una organizacion. Para crear una nueva vas a necesitar activar el plan pago."
    });
  });
});
