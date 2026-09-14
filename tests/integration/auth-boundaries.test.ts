import { beforeEach, describe, expect, it, vi } from "vitest";
const {serverFactory, adminFactory} = vi.hoisted(() => ({serverFactory: vi.fn(), adminFactory: vi.fn()}));
vi.mock("@/lib/supabase/server", () => ({createSupabaseServerClient: serverFactory}));
vi.mock("@/lib/supabase/admin", () => ({createSupabaseAdminClient: adminFactory}));
vi.mock("next/navigation", () => ({redirect: (path: string) => {throw new Error(`Redirect ${path}`);}}));
import { assertAdminAction, assertOrganizationAdminAction, assertOrganizationMembershipAction, getAdminSession, getAdminOrganizations, requireAdminSession, requireAdminOrganization, getOrganizationQueryKeyById } from "@/lib/auth/admin";
import { getCurrentUserIsSuperAdmin } from "@/lib/auth/super-admin";
import { createFakeSupabase } from "../helpers/fake-supabase";

const user = {id: "admin-1", email: "Admin@Example.Test", user_metadata: {name: "Owner"}, factors: [] as Array<{status: string}>};
const session = {userId: user.id, email: "admin@example.test", displayName: "Owner", isSuperAdmin: false};
const group = {id: "group-1", created_by: user.id, name: "One", slug: "one", is_public: true, archived_at: null};
function clientFor(options: {user?: typeof user | null; groups?: Array<Record<string, unknown>>; memberships?: Array<Record<string, unknown>>; superadmin?: boolean; aal?: string; authError?: boolean} = {}) {
  const fake = createFakeSupabase({admins: [{id: user.id, display_name: "Owner"}], organizations: options.groups ?? [group], organization_admins: options.memberships ?? []});
  const client = {...fake.client, rpc: vi.fn().mockResolvedValue({data: options.superadmin ?? false, error: options.authError ? {message: "offline"} : null}), auth: {
    getUser: vi.fn().mockResolvedValue({data: {user: options.user === undefined ? user : options.user}, error: null}),
    mfa: {getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({data: {currentLevel: options.aal ?? "aal1"}, error: null})}
  }};
  serverFactory.mockResolvedValue(client);
  adminFactory.mockReturnValue(null);
  return {client, fake};
}
beforeEach(() => {vi.clearAllMocks();});
describe("server authorization behavior", () => {
  it("rejects anonymous mutations and redirects protected pages", async () => {
    clientFor({user: null});
    await expect(getAdminSession()).resolves.toBeNull();
    await expect(assertAdminAction()).rejects.toThrow("iniciar sesion");
    await expect(requireAdminSession()).rejects.toThrow("Redirect /admin/login");
    await expect(getCurrentUserIsSuperAdmin()).resolves.toBe(false);
  });
  it("checks MFA on a verified session before allowing a mutation", async () => {
    clientFor({user: {...user, factors: [{status: "verified"}]}, aal: "aal1"});
    await expect(assertAdminAction()).rejects.toThrow("segundo factor");
    await expect(requireAdminSession()).rejects.toThrow("Redirect /admin/security");
    clientFor({user: {...user, factors: [{status: "verified"}]}, aal: "aal2"});
    await expect(assertAdminAction()).resolves.toMatchObject({userId: user.id, requiresMfa: false});
  });
  it("does not grant superadmin from the email or caller metadata when database authority fails", async () => {
    clientFor({authError: true});
    await expect(assertOrganizationAdminAction(group.id)).rejects.toThrow("permisos");
    clientFor({superadmin: true});
    await expect(getCurrentUserIsSuperAdmin()).resolves.toBe(true);
  });
  it("permits creator and invited admin, rejects a different group, and prevents archived writes", async () => {
    clientFor({groups: [group, {...group, id: "other", slug: "other", created_by: "another-owner"}]});
    await expect(assertOrganizationAdminAction(group.id)).resolves.toMatchObject({userId: user.id});
    await expect(assertOrganizationAdminAction("other")).rejects.toThrow("No autorizado");
    clientFor({groups: [{...group, created_by: "another-owner"}], memberships: [{id: "membership", organization_id: group.id, admin_id: user.id}]});
    await expect(assertOrganizationMembershipAction(group.id)).resolves.toMatchObject({userId: user.id});
    clientFor({superadmin: true, groups: [{...group, archived_at: "2026-01-01"}]});
    await expect(assertOrganizationAdminAction(group.id)).rejects.toThrow("archivado");
  });
  it("selects authorized groups by slug or ID and falls back without granting access to another group", async () => {
    clientFor({groups: [group, {...group, id: "group-2", slug: "two", name: "Two"}]});
    await expect(requireAdminOrganization("TWO")).resolves.toMatchObject({selectedOrganization: {id: "group-2"}});
    await expect(requireAdminOrganization(group.id)).resolves.toMatchObject({selectedOrganization: {id: group.id}});
    await expect(requireAdminOrganization("unknown")).resolves.toMatchObject({selectedOrganization: {id: group.id}});
    await expect(getOrganizationQueryKeyById(group.id)).resolves.toBe("one");
    await expect(getOrganizationQueryKeyById("missing")).resolves.toBe("missing");
    clientFor({groups: []});
    await expect(requireAdminOrganization()).rejects.toThrow("Redirect /admin");
  });
  it("excludes archived groups from the active group chooser even for a superadmin", async () => {
    clientFor({groups: [group, {...group, id: "archived", archived_at: "2026-01-01"}], superadmin: true});
    expect((await getAdminOrganizations({...session, isSuperAdmin: true})).map((item) => item.id)).toEqual([group.id]);
  });
});
