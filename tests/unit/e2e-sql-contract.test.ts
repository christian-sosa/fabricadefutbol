import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  compareSqlContracts, fetchInstalledSqlContract, getE2eSqlContractProbeSql, validateSqlContract,
  STORAGE_PROVIDER_TRIGGER_HASHES,
  type SqlContract
} from "../../scripts/lib/e2e-sql-contract.mjs";

const artifactSha256 = "a".repeat(64);
const functionKey = "function:app_dev.fixture_value()";
const expected: SqlContract = { formatVersion: 1, artifactSha256, objects: { [functionKey]: "b".repeat(64) } };
const env = {
  NEXT_PUBLIC_SUPABASE_URL_DEV: "https://fixture.supabase.co", SUPABASE_SERVICE_ROLE_KEY_DEV: "test-service-key",
  NEXT_PUBLIC_SUPABASE_TARGET_ENV: "development", NEXT_PUBLIC_SUPABASE_DB_SCHEMA_DEV: "app_dev"
};

// Public Supabase Storage migrations pinned by e2e-storage-provider-manifest.json.
// Keep their original function bodies: metadata hashes must match the reviewed
// PostgreSQL 17 provider baseline, rather than accepting names alone.
const providerStorageSql = `
create function storage.update_updated_at_column() returns trigger language plpgsql as $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;\u0020
END;
$$;
create trigger update_objects_updated_at before update on storage.objects for each row execute function storage.update_updated_at_column();
create function storage.protect_delete() returns trigger language plpgsql as $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;
create trigger protect_objects_delete before delete on storage.objects for each statement execute function storage.protect_delete();`;

describe("comparison of installed E2E SQL metadata", () => {
  it("requires canonical hashes and allows extra operational objects", () => {
    const actual = { ...expected, objects: { ...expected.objects, "function:app_dev.operational_helper()": "c".repeat(64) } };
    expect(compareSqlContracts(expected, actual)).toEqual({ artifactSha256, checkedObjects: 1 });
    expect(() => compareSqlContracts({ ...expected, artifactSha256: "unverified" }, actual)).toThrow("hash canonico");
  });

  it("rejects missing functions and changed bodies instead of trusting an artifact stamp", () => {
    expect(() => compareSqlContracts(expected, { ...expected, objects: { "relation:app_dev.players": "c".repeat(64) } })).toThrow(`Falta ${functionKey}`);
    expect(() => compareSqlContracts(expected, { ...expected, objects: { [functionKey]: "c".repeat(64) } })).toThrow(`Difiere ${functionKey}`);
  });

  it.each([null, {}, { ...expected, formatVersion: 2 }, { ...expected, objects: {} },
    { ...expected, objects: { [functionKey]: "not-a-hash" } }, { ...expected, objects: [] }])("rejects malformed metadata: %j", (contract) => {
    expect(() => validateSqlContract(contract)).toThrow();
  });

  it("requests only the DEV catalog probe with a service key and refuses production before fetch", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(expected));
    expect(await fetchInstalledSqlContract(env, fetcher)).toEqual(expected);
    expect(fetcher).toHaveBeenCalledWith("https://fixture.supabase.co/rest/v1/rpc/get_e2e_sql_contract", expect.objectContaining({
      method: "POST", body: "{}", redirect: "error", headers: expect.objectContaining({
        "content-profile": "app_dev", "accept-profile": "app_dev", Authorization: "Bearer test-service-key"
      })
    }));
    fetcher.mockClear();
    await expect(fetchInstalledSqlContract({ ...env, NEXT_PUBLIC_SUPABASE_TARGET_ENV: "production" }, fetcher)).rejects.toThrow("app_dev");
    await expect(fetchInstalledSqlContract({ ...env, NEXT_PUBLIC_SUPABASE_DB_SCHEMA_DEV: "app_prod" }, fetcher)).rejects.toThrow("app_dev");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("reports HTTP and malformed responses without leaking their contents", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("private SQL body", { status: 404 }));
    await expect(fetchInstalledSqlContract(env, fetcher)).rejects.toThrow("HTTP 404");
    fetcher.mockResolvedValue(Response.json({ source: "private SQL body" }));
    await expect(fetchInstalledSqlContract(env, fetcher)).rejects.toThrow("contrato SQL invalido");
  });
});

describe("DEV catalog probe in PostgreSQL", () => {
  let db: PGlite;
  async function installed() {
    const { rows } = await db.query<{ contract: SqlContract }>("select app_dev.get_e2e_sql_contract() as contract");
    return rows[0].contract;
  }

  beforeAll(async () => {
    db = new PGlite();
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  });
  afterAll(async () => { await db?.close(); });
  beforeEach(async () => {
    await db.exec(`reset role; drop schema if exists app_dev cascade; create schema app_dev;
      drop schema if exists storage cascade; create schema storage;
      create table storage.objects(id uuid, updated_at timestamptz);
      alter table storage.objects enable row level security;
      grant usage on schema storage to anon,authenticated,service_role;
      grant select on storage.objects to anon;
      create policy fixture_storage_read on storage.objects for select to anon using(false);
      ${providerStorageSql}
      grant usage on schema app_dev to anon, authenticated, service_role;
      create table app_dev.players(id uuid primary key,full_name text not null);
      insert into app_dev.players values('00000000-0000-4000-8000-000000000001','private fixture player');
      alter table app_dev.players enable row level security;
      create policy fixture_read on app_dev.players for select to anon using (true);
      create function app_dev.fixture_value() returns text language sql stable security invoker set search_path=pg_catalog as $$ select 'fixture-original'::text $$;
      create function app_dev.fixture_integer(x integer) returns integer language sql as $$ select x $$;
      create view app_dev.fixture_names as select full_name from app_dev.players;
      grant select,insert,update,delete on app_dev.players to authenticated;
      grant select on app_dev.fixture_names to authenticated;
      ${getE2eSqlContractProbeSql()}`);
  });

  it("exposes only catalog hashes to service_role and denies anonymous/authenticated callers", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await expect(installed()).rejects.toThrow(/permission denied/);
      await db.exec("reset role");
    }
    await db.exec("set role service_role");
    const contract = validateSqlContract(await installed());
    expect(contract.objects).toHaveProperty(functionKey);
    expect(Object.values(contract.objects).every((hash) => /^[a-f0-9]{64}$/.test(hash))).toBe(true);
    expect(JSON.stringify(contract)).not.toContain("fixture-original");
    expect(JSON.stringify(contract)).not.toContain("private fixture player");
    expect(Object.keys(contract.objects).some((key) => key.includes("get_e2e_sql_contract"))).toBe(false);
  });

  it("checks the exact reviewed Storage platform trigger baseline and excludes only matching providers from the app inventory", async () => {
    const contract = await installed();
    for (const [name, hash] of Object.entries(STORAGE_PROVIDER_TRIGGER_HASHES)) {
      expect(contract.objects[`provider-trigger:storage.objects.${name}`]).toBe(hash);
    }
    const baseline = { ...contract, artifactSha256 };
    await db.exec("create function app_dev.operational_helper() returns integer language sql as $$ select 1 $$;");
    const actual = await installed();
    expect(() => compareSqlContracts(baseline, actual)).not.toThrow();
  });

  it("rejects an extra overload that makes a previously valid canonical function call ambiguous", async () => {
    expect((await db.query<{ value: number }>("select app_dev.fixture_integer(1) value")).rows).toEqual([{ value: 1 }]);
    const baseline = { ...await installed(), artifactSha256 };
    await db.exec("create function app_dev.fixture_integer(x integer,y integer default null) returns integer language sql as $$ select x $$;");
    await expect(db.query("select app_dev.fixture_integer(1)")).rejects.toMatchObject({ code: "42725" });
    const actual = await installed();
    expect(() => compareSqlContracts(baseline, actual)).toThrow("function-family:app_dev.fixture_integer");
  });

  it("rejects a new permissive Storage policy that exposes a row previously hidden from anon", async () => {
    await db.exec("insert into storage.objects(id) values('00000000-0000-4000-8000-000000000002'); set role anon;");
    expect((await db.query("select id from storage.objects")).rows).toEqual([]);
    await db.exec("reset role");
    const baseline = { ...await installed(), artifactSha256 };
    await db.exec("create policy unexpected_public_read on storage.objects for select to anon using(true); set role anon;");
    expect((await db.query("select id from storage.objects")).rows).toEqual([{ id: "00000000-0000-4000-8000-000000000002" }]);
    await db.exec("reset role");
    const actual = await installed();
    expect(() => compareSqlContracts(baseline, actual)).toThrow("storage-inventory:storage.objects");
  });

  it("normalizes legacy CR runs before LF without collapsing meaningful whitespace in a function literal", async () => {
    const definition = "create or replace function app_dev.fixture_value() returns text language sql stable security invoker set search_path=pg_catalog as $$\nselect\n  'fixture  original'::text\n$$;";
    await db.exec(definition);
    const baseline = { ...await installed(), artifactSha256 };
    await db.exec(definition.replaceAll("\n", "\r\r\n"));
    const legacy = await installed();
    expect(() => compareSqlContracts(baseline, legacy)).not.toThrow();
    expect((await db.query<{ value: string }>("select app_dev.fixture_value() value")).rows).toEqual([{ value: "fixture  original" }]);
    await db.exec(definition.replace("fixture  original", "fixture original"));
    const changed = await installed();
    expect(() => compareSqlContracts(baseline, changed)).toThrow("function:app_dev.fixture_value");
  });

  it.each([
    ["function body", "create or replace function app_dev.fixture_value() returns text language sql stable security invoker set search_path=pg_catalog as $$ select 'changed'::text $$;", "function:"],
    ["function overload", "create function app_dev.fixture_value(value integer) returns text language sql as $$ select value::text $$;", "function-family:"],
    ["column type", "drop view app_dev.fixture_names; alter table app_dev.players alter column full_name type varchar(40); create view app_dev.fixture_names as select full_name from app_dev.players;", "column:"],
    ["column nullability", "alter table app_dev.players alter column full_name drop not null;", "column:"],
    ["RLS", "alter table app_dev.players disable row level security;", "relation:"],
    ["table SELECT permission", "revoke select on app_dev.players from authenticated;", "relation:"],
    ["table INSERT permission", "revoke insert on app_dev.players from authenticated;", "relation:"],
    ["table UPDATE permission", "revoke update on app_dev.players from authenticated;", "relation:"],
    ["table DELETE permission", "revoke delete on app_dev.players from authenticated;", "relation:"],
    ["view SELECT permission", "revoke select on app_dev.fixture_names from authenticated;", "relation:"],
    ["schema USAGE permission", "revoke usage on schema app_dev from authenticated;", "schema:"],
    ["policy", "alter policy fixture_read on app_dev.players using (false);", "policy:"],
    ["extra permissive policy", "create policy additional_read on app_dev.players for select to anon using (true);", "relation:"],
    ["extra trigger", "create function app_dev.extra_hook() returns trigger language plpgsql as $$ begin return new; end $$; create trigger extra_hook before insert on app_dev.players for each row execute function app_dev.extra_hook();", "relation:"],
    ["extra constraint blocking new writes", "alter table app_dev.players add constraint reject_new_players check(false) not valid;", "relation:"],
    ["extra unique index", "create unique index extra_unique_name on app_dev.players(full_name);", "relation:"],
    ["extra column", "alter table app_dev.players add column unavailable boolean not null default false;", "relation:"],
    ["extra permissive Storage policy", "create policy additional_storage_read on storage.objects for select to anon using(true);", "storage-inventory:"],
    ["extra Storage trigger", "create function app_dev.extra_storage_hook() returns trigger language plpgsql as $$ begin return new; end $$; create trigger extra_storage_hook before insert on storage.objects for each row execute function app_dev.extra_storage_hook();", "storage-inventory:"],
    ["missing Storage provider trigger", "drop trigger protect_objects_delete on storage.objects;", "provider-trigger:"],
    ["disabled Storage provider trigger", "alter table storage.objects disable trigger update_objects_updated_at;", "provider-trigger:"],
    ["changed Storage provider function", "create or replace function storage.protect_delete() returns trigger language plpgsql as $$ begin return null; end $$;", "provider-trigger:"],
    ["constraint", "alter table app_dev.players drop constraint players_pkey;", "constraint:"],
    ["view", "create or replace view app_dev.fixture_names as select upper(full_name) as full_name from app_dev.players;", "view:"]
  ])("detects installed %s changes from real metadata", async (_label, mutation, objectType) => {
    const baseline = { ...await installed(), artifactSha256 };
    await db.exec(mutation);
    const actual = await installed();
    expect(() => compareSqlContracts(baseline, actual)).toThrow(new RegExp(objectType));
  });
});
