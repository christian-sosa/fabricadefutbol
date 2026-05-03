import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseServerClientMock } = vi.hoisted(() => ({
  createSupabaseServerClientMock: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock
}));

import { insertOrganizationAuditEvent } from "@/lib/domain/organization-audit";
import { getSuperAdminDashboardMetrics } from "@/lib/queries/admin";
import { createFakeSupabase } from "../helpers/fake-supabase";

const ORG_ID = "00000000-0000-4000-8000-000000000001";

describe("organization audit", () => {
  beforeEach(() => {
    createSupabaseServerClientMock.mockReset();
  });

  it("registra un evento auditable de organizacion", async () => {
    const fake = createFakeSupabase({
      organizations: [{ id: ORG_ID, name: "La cantera de LQ", slug: "la-cantera-de-lq" }]
    });

    await expect(
      insertOrganizationAuditEvent(fake.client as never, {
        organizationId: ORG_ID,
        eventType: "organization.admin_invite.created",
        actorAdminId: "admin-1",
        actorEmail: "admin@example.com",
        targetEmail: "nuevo@example.com",
        entityType: "organization_invite",
        entityId: "00000000-0000-4000-8000-000000000010",
        details: { source: "admin-panel" }
      })
    ).resolves.toMatchObject({ recorded: true });

    expect(fake.table("organization_audit_events")).toEqual([
      expect.objectContaining({
        organization_id: ORG_ID,
        event_type: "organization.admin_invite.created",
        actor_admin_id: "admin-1",
        actor_email: "admin@example.com",
        target_email: "nuevo@example.com",
        entity_type: "organization_invite",
        entity_id: "00000000-0000-4000-8000-000000000010",
        details: { source: "admin-panel" }
      })
    ]);
  });

  it("incluye eventos recientes en el dashboard superadmin", async () => {
    const fake = createFakeSupabase({
      organizations: [{ id: ORG_ID, name: "La cantera de LQ", slug: "la-cantera-de-lq", created_at: "2026-04-04T00:00:00.000Z" }],
      organization_audit_events: [
        {
          id: "event-old",
          organization_id: ORG_ID,
          event_type: "organization.created",
          actor_email: "owner@example.com",
          target_email: null,
          created_at: "2026-04-04T10:00:00.000Z"
        },
        {
          id: "event-new",
          organization_id: ORG_ID,
          event_type: "organization.admin_invite.accepted",
          actor_email: "nuevo@example.com",
          target_email: "nuevo@example.com",
          created_at: "2026-04-30T17:56:39.000Z"
        }
      ]
    });
    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    const metrics = await getSuperAdminDashboardMetrics();

    expect(metrics.recentAuditEvents).toEqual([
      expect.objectContaining({
        id: "event-new",
        organizationName: "La cantera de LQ",
        organizationSlug: "la-cantera-de-lq",
        eventType: "organization.admin_invite.accepted",
        actorEmail: "nuevo@example.com",
        targetEmail: "nuevo@example.com"
      }),
      expect.objectContaining({
        id: "event-old",
        eventType: "organization.created"
      })
    ]);
  });
});
