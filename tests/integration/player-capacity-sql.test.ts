import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { executePrivateSql, privateSqlAvailable } from "../helpers/private-sql";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const personalGroup = id(12);
const personalOwner = id(2);

describe.skipIf(!privateSqlAvailable("supabase/generated/schema.app_prod.sql")).each(["app_dev", "app_prod"])("%s active player capacity", (schema) => {
  let db: PGlite;
  let source: string;
  const sql = (query: string) => db.exec(query.replaceAll("APP", schema));
  const rows = async (query: string) => (await db.query<Record<string, unknown>>(query.replaceAll("APP", schema))).rows;
  const login = () => sql(`reset role; select set_config('test.uid','${id(1)}',false); set role authenticated;`);
  const addPlayer = (number: number, group = id(10), active = true) => sql(`insert into APP.players(id,organization_id,full_name,initial_rank,active) values('${id(number)}','${group}','Player ${number}',${number + 1000},${active});`);
  const addRoster = (group = id(10), total = 30) => sql(`insert into APP.players(organization_id,full_name,initial_rank) select '${group}','Player '||(coalesce((select max(initial_rank) from APP.players where organization_id='${group}'),0)+n),coalesce((select max(initial_rank) from APP.players where organization_id='${group}'),0)+n from generate_series(1,${total}) n;`);
  const reapplySchema = () => executePrivateSql(db, source, `schema.${schema}.sql player capacity upgrade`);

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key,email text);
      create table auth.mfa_factors(user_id uuid,status text);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('aal','aal1') $$;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,updated_at timestamptz,created_at timestamptz,owner uuid);
      alter table storage.objects enable row level security;
      grant usage on schema auth,storage to anon,authenticated,service_role;
      grant select on storage.objects to anon,authenticated;`);
    source = readFileSync(`supabase/generated/schema.${schema}.sql`, "utf8")
      .replace("create extension if not exists pgcrypto;", "")
      .replace(/(where o\.id = )'[0-9a-f-]{36}'::uuid(\s+and o\.created_by = )'[0-9a-f-]{36}'::uuid/i,
        `$1'${personalGroup}'::uuid$2'${personalOwner}'::uuid`);
    await reapplySchema();
    for (const file of [`policies.${schema}.sql`, "policies.storage.sql"]) {
      await executePrivateSql(db, readFileSync(`supabase/generated/${file}`, "utf8"), file);
    }
  }, 30_000);
  afterAll(async () => { await db?.close(); });
  beforeEach(async () => {
    await sql(`reset role; truncate APP.organizations cascade; truncate APP.admins cascade; truncate auth.users cascade; truncate auth.mfa_factors;
      select set_config('test.uid','',false);
      insert into auth.users values('${id(1)}','owner@example.test'),('${personalOwner}','personal@example.test');
      insert into APP.admins(id,display_name) values('${id(1)}','Owner'),('${personalOwner}','Personal owner');
      insert into APP.organizations(id,name,slug,created_by) values
        ('${id(10)}','Regular','regular','${id(1)}'),
        ('${id(11)}','Other','other','${id(1)}'),
        ('${personalGroup}','La cantera de LQ','la-cantera-de-lq','${personalOwner}');`);
    await reapplySchema();
  });

  it("caps an ordinary group at 30 active players and frees its place when a player retires", async () => {
    await addRoster();
    await login();
    await expect(addPlayer(100)).rejects.toMatchObject({ code: "23514" });
    await sql(`update APP.players set active=false where id=(select id from APP.players where organization_id='${id(10)}' limit 1);`);
    await addPlayer(100);
    expect(await rows(`select count(*)::integer as total,count(*) filter(where active)::integer as active from APP.players where organization_id='${id(10)}'`)).toEqual([{ total: 31, active: 30 }]);
  });

  it("allows inactive records but checks reactivation and preserves inactivity on failure", async () => {
    await addRoster();
    await addPlayer(100, id(10), false);
    await login();
    await expect(sql(`update APP.players set active=true where id='${id(100)}'`)).rejects.toMatchObject({ code: "23514" });
    expect(await rows(`select active from APP.players where id='${id(100)}'`)).toEqual([{ active: false }]);
  });

  it("allows ordinary name edits and no-op activation in a full roster", async () => {
    await addPlayer(100);
    await addRoster(id(10), 29);
    await login();
    await sql(`update APP.players set full_name='Updated',active=true where id='${id(100)}';`);
    expect(await rows(`select full_name,active from APP.players where id='${id(100)}'`)).toEqual([{ full_name: "Updated", active: true }]);
  });

  it("allows the verified personal group beyond 30 and keeps its exception after renaming", async () => {
    await addRoster(personalGroup, 35);
    await sql(`update APP.organizations set name='Renamed',slug='renamed' where id='${personalGroup}';`);
    await reapplySchema();
    await addPlayer(100, personalGroup);
    expect(await rows(`select count(*)::integer as total from APP.players where organization_id='${personalGroup}' and active`)).toEqual([{ total: 36 }]);
  });

  it("repairs a pre-existing ordinary limit for the verified personal identity without changing other groups", async () => {
    await sql(`update APP_private.organization_player_limits set max_active_players=30,lock_revision=7 where organization_id='${personalGroup}';
      insert into APP_private.organization_player_limits(organization_id,max_active_players) values('${id(10)}',30);`);
    await reapplySchema();
    expect(await rows(`select max_active_players,lock_revision from APP_private.organization_player_limits where organization_id='${personalGroup}'`)).toEqual([{ max_active_players: null, lock_revision: 8 }]);
    expect(await rows(`select max_active_players from APP_private.organization_player_limits where organization_id='${id(10)}'`)).toEqual([{ max_active_players: 30 }]);
    await reapplySchema();
    expect(await rows(`select max_active_players,lock_revision from APP_private.organization_player_limits where organization_id='${personalGroup}'`)).toEqual([{ max_active_players: null, lock_revision: 8 }]);
    await addRoster(personalGroup, 35);
    expect(await rows(`select count(*)::integer as total from APP.players where organization_id='${personalGroup}' and active`)).toEqual([{ total: 35 }]);
  });

  it("does not grant the exception to another group using the personal group's name or slug", async () => {
    await sql(`update APP.organizations set name='Renamed',slug='renamed' where id='${personalGroup}'; update APP.organizations set name='La cantera de LQ',slug='la-cantera-de-lq' where id='${id(10)}';`);
    await reapplySchema();
    await addRoster();
    await expect(addPlayer(100)).rejects.toMatchObject({ code: "23514" });
  });

  it("requires both the stable identity and verified creator when initializing the exception", async () => {
    await sql(`delete from APP.organizations where id='${personalGroup}'; insert into APP.organizations(id,name,slug,created_by) values('${personalGroup}','La cantera de LQ','la-cantera-de-lq','${id(1)}');`);
    await reapplySchema();
    await addRoster(personalGroup);
    await expect(addPlayer(100, personalGroup)).rejects.toMatchObject({ code: "23514" });
    expect(await rows(`select max_active_players from APP_private.organization_player_limits where organization_id='${personalGroup}'`)).toEqual([{ max_active_players: 30 }]);
  });

  it("checks capacity when privileged imports move an active player to another group", async () => {
    await addRoster();
    await addPlayer(100, id(11));
    await expect(sql(`update APP.players set organization_id='${id(10)}' where id='${id(100)}'`)).rejects.toMatchObject({ code: "23514" });
    await sql(`update APP.players set active=false,organization_id='${id(10)}' where id='${id(100)}';`);
    expect(await rows(`select organization_id,active from APP.players where id='${id(100)}'`)).toEqual([{ organization_id: id(10), active: false }]);
  });

  it("rolls back a batch that would exceed the cap and its serialization revision", async () => {
    await addRoster(id(10), 29);
    const before = await rows(`select lock_revision from APP_private.organization_player_limits where organization_id='${id(10)}'`);
    await expect(addRoster(id(10), 2)).rejects.toMatchObject({ code: "23514" });
    expect(await rows(`select count(*)::integer as total from APP.players where organization_id='${id(10)}'`)).toEqual([{ total: 29 }]);
    expect(await rows(`select lock_revision from APP_private.organization_player_limits where organization_id='${id(10)}'`)).toEqual(before);
  });

  it("keeps capacity configuration and the privileged trigger inaccessible to app roles", async () => {
    expect(await rows(`select n.nspname,p.prosecdef,p.proconfig,
      has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
      has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
      has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname='enforce_max_players_per_org'`)).toEqual([{
      nspname: `${schema}_private`, prosecdef: true, proconfig: ['search_path=""'],
      anon_execute: false, authenticated_execute: false, service_execute: false
    }]);
    for (const role of ["anon", "authenticated", "service_role"]) {
      expect(await rows(`select has_table_privilege('${role}','APP_private.organization_player_limits','SELECT') as can_read,
        has_table_privilege('${role}','APP_private.organization_player_limits','INSERT') as can_insert,
        has_table_privilege('${role}','APP_private.organization_player_limits','UPDATE') as can_update,
        has_table_privilege('${role}','APP_private.organization_player_limits','DELETE') as can_delete`)).toEqual([{ can_read: false, can_insert: false, can_update: false, can_delete: false }]);
    }
  });
});
