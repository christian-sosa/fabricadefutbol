import type { User } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { E2E_AUTH_MARKER, resolveFixtureUser, type createFixtureClient } from "../helpers/e2e-fixture-identity";
import { E2E_ORGANIZATION_ID, E2E_PLAYER_IDS } from "../e2e/test-data";

const userId = "00000000-0000-4000-8000-000000000001";
const env = {E2E_ADMIN_USER_ID: userId, E2E_ADMIN_EMAIL: "fixture@example.test", E2E_ADMIN_PASSWORD: "unchanged-test-password", E2E_ORG_SLUG: "e2e-tests"};
const user: User = {id: userId, email: env.E2E_ADMIN_EMAIL, aud: "authenticated", created_at: "2026-01-01T00:00:00Z", app_metadata: {fdf_e2e_fixture: E2E_AUTH_MARKER, fdf_e2e_organization_id: E2E_ORGANIZATION_ID}, user_metadata: {}};
type Row = Record<string, unknown>;
function fixture(options: {user?: User; tables?: Record<string, Row[] | undefined>; readError?: string; pages?: User[][]} = {}) {
  const admin = {
    getUserById: vi.fn().mockResolvedValue({data: {user: options.user ?? structuredClone(user)}, error: null}),
    listUsers: vi.fn().mockImplementation(({page}: {page: number}) => Promise.resolve({data: {users: options.pages?.[page - 1] ?? []}, error: null})),
    createUser: vi.fn().mockResolvedValue({data: {user}, error: null}),
    updateUserById: vi.fn(() => { throw new Error("Auth updates are forbidden"); })
  };
  const reads: string[] = [];
  function from(schema: string, table: string) {
    const key = `${schema}.${table}`;
    reads.push(key);
    let rows = options.tables?.[key] ?? [];
    let single = false;
    const result = () => ({data: single ? rows[0] ?? null : rows, error: options.readError === key ? {message: "read denied"} : null});
    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => { rows = rows.filter((row) => row[column] === value); return builder; },
      ilike: (column: string, value: string) => { rows = rows.filter((row) => String(row[column]).toLowerCase() === value.toLowerCase()); return builder; },
      in: (column: string, values: unknown[]) => {rows = rows.filter((row) => values.includes(row[column])); return builder;},
      limit: (count: number) => { rows = rows.slice(0, count); return builder; },
      maybeSingle: () => {single = true; return builder;},
      then: (fulfilled: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(fulfilled)
    };
    return builder;
  }
  const client = {auth: {admin}, from: (table: string) => from("app_dev", table), schema: (schema: string) => ({from: (table: string) => from(schema, table)})} as unknown as ReturnType<typeof createFixtureClient>;
  return {client, admin, reads};
}
describe("E2E identity boundary", () => {
  it("reuses only the explicitly accredited identity without modifying Auth", async () => {
    const f = fixture({tables: {"app_dev.organizations": [{id: E2E_ORGANIZATION_ID, slug: env.E2E_ORG_SLUG, created_by: userId}]}});
    expect((await resolveFixtureUser(f.client, env)).id).toBe(userId);
    expect(f.admin.getUserById).toHaveBeenCalledWith(userId);
    expect(f.admin.listUsers).not.toHaveBeenCalled();
    expect(f.admin.createUser).not.toHaveBeenCalled();
    expect(f.admin.updateUserById).not.toHaveBeenCalled();
    expect(f.reads).toEqual(expect.arrayContaining(["app_prod.admins", "app_prod.organization_admins", "app_prod.organizations", "app_prod.super_admin_emails"]));
  });
  it.each([
    {...user, app_metadata: {}, user_metadata: user.app_metadata},
    {...user, email: "someone-else@example.test"},
    {...user, app_metadata: {...user.app_metadata, fdf_e2e_organization_id: "another-org"}}
  ])("rejects an existing identity without trusted app metadata or exact identity", async (unsafeUser) => {
    const f = fixture({user: unsafeUser});
    await expect(resolveFixtureUser(f.client, env)).rejects.toThrow("acreditado");
    expect(f.admin.createUser).not.toHaveBeenCalled();
    expect(f.admin.updateUserById).not.toHaveBeenCalled();
  });
  it.each([
    ["app_prod.admins", {id: userId}], ["app_prod.organization_admins", {admin_id: userId}],
    ["app_prod.organizations", {created_by: userId}], ["app_prod.super_admin_emails", {email: env.E2E_ADMIN_EMAIL}]
  ] as const)("rejects production affiliation in %s", async (table, row) => {
    const f = fixture({tables: {[table]: [row]}});
    await expect(resolveFixtureUser(f.client, env)).rejects.toThrow(/productiv/);
    expect(f.admin.createUser).not.toHaveBeenCalled();
    expect(f.admin.updateUserById).not.toHaveBeenCalled();
  });
  it("fails closed when production affiliation cannot be read", async () => {
    const f = fixture({readError: "app_prod.organization_admins"});
    await expect(resolveFixtureUser(f.client, env)).rejects.toThrow("descartar");
    expect(f.admin.updateUserById).not.toHaveBeenCalled();
  });
  it.each([
    {"app_dev.organizations": [{id: E2E_ORGANIZATION_ID, slug: "different-slug", created_by: userId}]},
    {"app_dev.organizations": [{id: "different-id", slug: env.E2E_ORG_SLUG, created_by: userId}]},
    {"app_dev.organizations": [{id: E2E_ORGANIZATION_ID, slug: env.E2E_ORG_SLUG, created_by: "another-owner"}]},
    {"app_dev.players": [{id: E2E_PLAYER_IDS[0], organization_id: "another-group"}]}
  ])("validates both fixed org ID, slug and player ownership before Auth creation", async (tables) => {
    const f = fixture({tables});
    await expect(resolveFixtureUser(f.client, {...env, E2E_ADMIN_USER_ID: undefined, E2E_CREATE_FIXTURE_USER: "1"})).rejects.toThrow();
    expect(f.admin.createUser).not.toHaveBeenCalled();
    expect(f.admin.updateUserById).not.toHaveBeenCalled();
  });
  it("does not miss an existing email beyond the first page or reset its password", async () => {
    const f = fixture({pages: [Array.from({length: 200}, (_, i) => ({...user, email: `${i}@example.test`})), [user]]});
    await expect(resolveFixtureUser(f.client, {...env, E2E_ADMIN_USER_ID: undefined, E2E_CREATE_FIXTURE_USER: "1"})).rejects.toThrow("email ya existe");
    expect(f.admin.listUsers).toHaveBeenCalledTimes(2);
    expect(f.admin.createUser).not.toHaveBeenCalled();
    expect(f.admin.updateUserById).not.toHaveBeenCalled();
  });
  it("creates only a new reserved fixture after all data fences pass", async () => {
    const f = fixture();
    await resolveFixtureUser(f.client, {...env, E2E_ADMIN_USER_ID: undefined, E2E_CREATE_FIXTURE_USER: "1"});
    expect(f.admin.createUser).toHaveBeenCalledWith(expect.objectContaining({email: env.E2E_ADMIN_EMAIL, password: env.E2E_ADMIN_PASSWORD, app_metadata: user.app_metadata}));
    expect(f.reads).toEqual(expect.arrayContaining(["app_dev.organizations", "app_dev.players", "app_prod.super_admin_emails"]));
    expect(f.admin.updateUserById).not.toHaveBeenCalled();
  });
  it("rejects a real email or configured superadmin before even reading Auth", async () => {
    const f = fixture();
    await expect(resolveFixtureUser(f.client, {...env, E2E_ADMIN_EMAIL: "admin@real.example"})).rejects.toThrow("reservado");
    await expect(resolveFixtureUser(f.client, {...env, SUPER_ADMIN_EMAIL: env.E2E_ADMIN_EMAIL})).rejects.toThrow("autoridad");
    expect(f.admin.getUserById).not.toHaveBeenCalled();
    expect(f.admin.createUser).not.toHaveBeenCalled();
  });
});
