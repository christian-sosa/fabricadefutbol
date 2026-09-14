import { describe, expect, it } from "vitest";

import {
  acceptOrganizationInvite,
  deleteOrganizationDeep,
  revokeOrganizationInvite
} from "@/lib/domain/organization-workflow";
import { createFakeSupabase } from "../helpers/fake-supabase";

const ORG_ID = "org-1";

describe("organization workflow", () => {
  it("acepta una invitacion conservando quien invito al nuevo admin", async () => {
    const fake = createFakeSupabase({
      admins: [
        { id: "admin-owner", display_name: "Admin Owner" },
        { id: "admin-invited", display_name: "Admin Invitado" }
      ],
      organizations: [{ id: ORG_ID, name: "LQ1", slug: "lq1", created_by: "admin-owner" }],
      organization_invites: [
        {
          id: "invite-1",
          organization_id: ORG_ID,
          email: "nuevo@example.com",
          invited_by: "admin-owner",
          status: "pending",
          accepted_by: null,
          accepted_at: null
        }
      ]
    });

    await expect(
      acceptOrganizationInvite({
        supabase: fake.client as never,
        inviteId: "invite-1",
        organizationId: ORG_ID,
        invitedEmail: "nuevo@example.com",
        userId: "admin-invited"
      })
    ).resolves.toEqual({ acceptedInviteId: "invite-1" });

    expect(fake.table("organization_admins")).toEqual([
      expect.objectContaining({
        organization_id: ORG_ID,
        admin_id: "admin-invited",
        created_by: "admin-invited"
      })
    ]);
    expect(fake.table("organization_invites")).toEqual([
      expect.objectContaining({
        id: "invite-1",
        organization_id: ORG_ID,
        email: "nuevo@example.com",
        invited_by: "admin-owner",
        status: "accepted",
        accepted_by: "admin-invited",
        accepted_at: expect.any(String)
      })
    ]);
  });

  it("permite aceptar una invitacion cuando sera el cuarto admin activo", async () => {
    const fake = createFakeSupabase({
      admins: [
        { id: "admin-owner", display_name: "Admin Owner" },
        { id: "admin-2", display_name: "Admin 2" },
        { id: "admin-3", display_name: "Admin 3" },
        { id: "admin-invited", display_name: "Admin Invitado" }
      ],
      organizations: [{ id: ORG_ID, name: "LQ1", slug: "lq1", created_by: "admin-owner" }],
      organization_admins: [
        { id: "org-admin-1", organization_id: ORG_ID, admin_id: "admin-owner", created_by: "admin-owner" },
        { id: "org-admin-2", organization_id: ORG_ID, admin_id: "admin-2", created_by: "admin-owner" },
        { id: "org-admin-3", organization_id: ORG_ID, admin_id: "admin-3", created_by: "admin-owner" }
      ],
      organization_invites: [
        {
          id: "invite-1",
          organization_id: ORG_ID,
          email: "nuevo@example.com",
          invited_by: "admin-owner",
          status: "pending",
          accepted_by: null,
          accepted_at: null
        }
      ]
    });

    await expect(
      acceptOrganizationInvite({
        supabase: fake.client as never,
        inviteId: "invite-1",
        organizationId: ORG_ID,
        invitedEmail: "nuevo@example.com",
        userId: "admin-invited"
      })
    ).resolves.toEqual({ acceptedInviteId: "invite-1" });

    expect(fake.table("organization_admins")).toHaveLength(4);
    expect(fake.find("organization_admins", (row) => row.admin_id === "admin-invited")).toMatchObject({
      organization_id: ORG_ID,
      admin_id: "admin-invited"
    });
  });

  it("rechaza aceptar una invitacion si el grupo ya tiene 4 admins activos", async () => {
    const fake = createFakeSupabase({
      admins: [
        { id: "admin-owner", display_name: "Admin Owner" },
        { id: "admin-2", display_name: "Admin 2" },
        { id: "admin-3", display_name: "Admin 3" },
        { id: "admin-4", display_name: "Admin 4" },
        { id: "admin-invited", display_name: "Admin Invitado" }
      ],
      organizations: [{ id: ORG_ID, name: "LQ1", slug: "lq1", created_by: "admin-owner" }],
      organization_admins: [
        { id: "org-admin-1", organization_id: ORG_ID, admin_id: "admin-owner", created_by: "admin-owner" },
        { id: "org-admin-2", organization_id: ORG_ID, admin_id: "admin-2", created_by: "admin-owner" },
        { id: "org-admin-3", organization_id: ORG_ID, admin_id: "admin-3", created_by: "admin-owner" },
        { id: "org-admin-4", organization_id: ORG_ID, admin_id: "admin-4", created_by: "admin-owner" }
      ],
      organization_invites: [
        {
          id: "invite-1",
          organization_id: ORG_ID,
          email: "nuevo@example.com",
          invited_by: "admin-owner",
          status: "pending",
          accepted_by: null,
          accepted_at: null
        }
      ]
    });

    await expect(
      acceptOrganizationInvite({
        supabase: fake.client as never,
        inviteId: "invite-1",
        organizationId: ORG_ID,
        invitedEmail: "nuevo@example.com",
        userId: "admin-invited"
      })
    ).rejects.toThrow("Este grupo ya alcanzo el maximo de 4 administradores.");

    expect(fake.table("organization_admins")).toHaveLength(4);
    expect(fake.find("organization_admins", (row) => row.admin_id === "admin-invited")).toBeNull();
    expect(fake.find("organization_invites", (row) => row.id === "invite-1")).toMatchObject({
      status: "pending",
      accepted_by: null,
      accepted_at: null
    });
  });

  it("revoca una invitacion pendiente sin borrar quien la envio", async () => {
    const fake = createFakeSupabase({
      admins: [{ id: "admin-owner", display_name: "Admin Owner" }],
      organizations: [{ id: ORG_ID, name: "LQ1", slug: "lq1", created_by: "admin-owner" }],
      organization_invites: [
        {
          id: "invite-1",
          organization_id: ORG_ID,
          email: "nuevo@example.com",
          invited_by: "admin-owner",
          status: "pending"
        }
      ]
    });

    await expect(
      revokeOrganizationInvite({
        supabase: fake.client as never,
        inviteId: "invite-1",
        organizationId: ORG_ID
      })
    ).resolves.toEqual({ revokedInviteId: "invite-1" });

    expect(fake.table("organization_invites")).toEqual([
      expect.objectContaining({
        id: "invite-1",
        organization_id: ORG_ID,
        email: "nuevo@example.com",
        invited_by: "admin-owner",
        status: "revoked"
      })
    ]);
  });

  it("delega la purga completa a una sola transaccion RPC", async () => {
    const calls: unknown[] = [];
    const client = { rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });
      return { data: { deletedOrganizationId: ORG_ID }, error: null };
    } };
    await expect(deleteOrganizationDeep({ supabase: client as never, organizationId: ORG_ID }))
      .resolves.toEqual({ deletedOrganizationId: ORG_ID });
    expect(calls).toEqual([{ name: "purge_group", args: { p_organization_id: ORG_ID } }]);
  });
  it("propaga un rechazo de la transaccion sin intentar borrar tablas por separado", async () => {
    const client = { rpc: async () => ({ data: null, error: { message: "Requiere MFA" } }) };
    await expect(deleteOrganizationDeep({ supabase: client as never, organizationId: ORG_ID })).rejects.toThrow("Requiere MFA");
  });
});
