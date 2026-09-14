import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "../helpers/fake-supabase";

const { factory, requiresMfa, accept, audit } = vi.hoisted(() => ({
  factory: vi.fn(), requiresMfa: vi.fn(), accept: vi.fn(), audit: vi.fn()
}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: factory }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: factory }));
vi.mock("@/lib/auth/mfa", () => ({ requiresMfaVerification: requiresMfa }));
vi.mock("@/lib/auth/admin", () => ({ getOrganizationQueryKeyById: async () => "grupo" }));
vi.mock("@/lib/action-rate-limit", () => ({ ACTION_RATE_LIMITS: { acceptInvite: {} }, checkActionRateLimit: async () => ({ allowed: true }), formatActionRateLimitMessage: () => "Esperá" }));
vi.mock("@/lib/domain/organization-workflow", () => ({ acceptOrganizationInvite: accept }));
vi.mock("@/lib/domain/organization-audit", () => ({ recordOrganizationAuditEvent: audit }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
import { acceptInviteAction } from "@/app/invite/[token]/actions";

const token = "00000000-0000-4000-8000-000000000001";
function fixture(archived = false) {
  const fake = createFakeSupabase({
    authUser: { id: "invited-user", email: "invited@example.test" },
    organizations: [{ id: "org", archived_at: archived ? "2026-09-14T00:00:00Z" : null }],
    organization_invites: [{ id: "invite", organization_id: "org", email: "invited@example.test", status: "pending", invite_token: token }]
  });
  factory.mockReturnValue(fake.client);
  const form = new FormData(); form.set("token", token);
  return { fake, form };
}

describe("invitaciones con sesión y cliente privilegiado", () => {
  beforeEach(() => { vi.clearAllMocks(); requiresMfa.mockResolvedValue(false); });
  it("no escribe perfiles ni consume la invitación con MFA pendiente", async () => {
    const { fake, form } = fixture(); requiresMfa.mockResolvedValue(true);
    await expect(acceptInviteAction(form)).rejects.toThrow("redirect:/admin/security");
    expect(fake.table("admins")).toEqual([]);
    expect(accept).not.toHaveBeenCalled(); expect(audit).not.toHaveBeenCalled();
  });
  it("no modifica un grupo archivado aunque el cliente sea service_role", async () => {
    const { fake, form } = fixture(true);
    await expect(acceptInviteAction(form)).rejects.toThrow(`redirect:/invite/${token}?error=`);
    expect(fake.table("admins")).toEqual([]);
    expect(accept).not.toHaveBeenCalled();
  });
  it("conserva la aceptación explícita con sesión verificada y grupo activo", async () => {
    const { fake, form } = fixture();
    await expect(acceptInviteAction(form)).rejects.toThrow("redirect:/admin?org=grupo");
    expect(fake.table("admins")).toHaveLength(1);
    expect(accept).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org", userId: "invited-user", invitedEmail: "invited@example.test" }));
    expect(audit).toHaveBeenCalledOnce();
  });
});
