import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { executePrivateSql, privateSqlAvailable } from "../helpers/private-sql";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe.skipIf(!privateSqlAvailable("supabase/generated/schema.app_prod.sql")).each(["app_dev", "app_prod"])("%s player injury status and RLS", (schema) => {
  let db: PGlite;
  const sql = (query: string) => db.exec(query.replaceAll("APP", schema));
  const rows = async (query: string) => (await db.query<Record<string, unknown>>(query.replaceAll("APP", schema))).rows;
  const login = async (user = 1) => sql(`reset role; select set_config('test.uid','${id(user)}',false); set role authenticated;`);
  const snapshots = () => rows("select organization_id from APP.organization_public_snapshots order by organization_id");

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
    for (const file of [`schema.${schema}.sql`, `policies.${schema}.sql`, "policies.storage.sql"]) {
      const source = readFileSync(`supabase/generated/${file}`, "utf8").replace("create extension if not exists pgcrypto;", "");
      await executePrivateSql(db, source, file);
      await executePrivateSql(db, source, file);
    }
  }, 30_000);
  afterAll(async () => { await db?.close(); });
  beforeEach(async () => {
    await sql(`reset role; truncate APP.organizations cascade; truncate APP.admins cascade; truncate auth.users cascade; truncate auth.mfa_factors;
      select set_config('test.uid','',false);
      insert into auth.users values('${id(1)}','owner@example.test'),('${id(2)}','other@example.test');
      insert into APP.admins(id,display_name) values('${id(1)}','Owner'),('${id(2)}','Other');
      insert into APP.organizations(id,name,slug,created_by) values('${id(10)}','One','one','${id(1)}'),('${id(11)}','Two','two','${id(2)}');
      insert into APP.players(id,organization_id,full_name,initial_rank,current_rating) values('${id(100)}','${id(10)}','Player One',1,1240),('${id(200)}','${id(11)}','Player Two',1,1150);
      insert into APP.organization_seasons(id,organization_id,label,starts_at,ends_at,created_by) values('${id(30)}','${id(10)}','2026','2026-01-01','2026-12-31','${id(1)}');
      insert into APP.organization_season_player_ratings(organization_id,season_id,player_id,current_rating) values('${id(10)}','${id(30)}','${id(100)}',1090);
      insert into APP.organization_public_snapshots(organization_id) values('${id(10)}'),('${id(11)}');`);
  });

  it("defaults new and preexisting players to healthy when the column is introduced", async () => {
    expect(await rows("select is_injured from APP.players")).toEqual([{ is_injured: false }, { is_injured: false }]);
    await sql("drop trigger invalidate_player_injury_snapshot on APP.players; alter table APP.players drop column is_injured;");
    const source = readFileSync(`supabase/generated/schema.${schema}.sql`, "utf8").replace("create extension if not exists pgcrypto;", "");
    await executePrivateSql(db, source, `schema.${schema}.sql upgrading existing players`);
    expect(await rows("select is_injured from APP.players")).toEqual([{ is_injured: false }, { is_injured: false }]);
  });

  it("lets the owner mark and clear injury without altering activity, points or other groups", async () => {
    const before = await rows("select id,current_rating,active,created_at from APP.players order by id");
    const seasonBefore = await rows("select * from APP.organization_season_player_ratings");
    await login();
    await sql(`update APP.players set is_injured=true where id='${id(100)}';`);
    expect(await rows(`select is_injured from APP.players where id='${id(100)}'`)).toEqual([{ is_injured: true }]);
    expect(await snapshots()).toEqual([{ organization_id: id(11) }]);
    expect(await rows("select id,current_rating,active,created_at from APP.players order by id")).toEqual(before);
    expect(await rows("select * from APP.organization_season_player_ratings")).toEqual(seasonBefore);
    expect(await rows("select * from APP.rating_history")).toEqual([]);
    await sql(`insert into APP.organization_public_snapshots(organization_id) values('${id(10)}');
      update APP.players set is_injured=false where id='${id(100)}';`);
    expect(await snapshots()).toEqual([{ organization_id: id(11) }]);
    expect(await rows(`select is_injured from APP.players where id='${id(100)}'`)).toEqual([{ is_injured: false }]);
  });

  it("does not invalidate snapshots for unchanged status or unrelated profile updates", async () => {
    await login();
    await sql(`update APP.players set is_injured=false, full_name='Updated' where id='${id(100)}';`);
    expect(await snapshots()).toEqual([{ organization_id: id(10) }, { organization_id: id(11) }]);
  });

  it("rolls snapshot invalidation back with a failed player transaction", async () => {
    await login();
    await sql(`begin; update APP.players set is_injured=true where id='${id(100)}';`);
    expect(await snapshots()).toEqual([{ organization_id: id(11) }]);
    await sql("rollback;");
    expect(await snapshots()).toEqual([{ organization_id: id(10) }, { organization_id: id(11) }]);
    expect(await rows(`select is_injured from APP.players where id='${id(100)}'`)).toEqual([{ is_injured: false }]);
  });

  it("denies injury edits by an administrator from another group", async () => {
    await login(2);
    expect(await rows(`update APP.players set is_injured=true where id='${id(100)}' returning id`)).toEqual([]);
    expect(await rows(`select is_injured from APP.players where id='${id(100)}'`)).toEqual([{ is_injured: false }]);
    expect(await snapshots()).toEqual([{ organization_id: id(10) }, { organization_id: id(11) }]);
  });

  it("allows public injury badges while denying anonymous writes and hiding archived groups", async () => {
    await sql(`update APP.players set is_injured=true where id='${id(100)}'; update APP.organizations set archived_at=now() where id='${id(11)}'; set role anon;`);
    expect(await rows("select id,is_injured from APP.players")).toEqual([{ id: id(100), is_injured: true }]);
    await expect(sql(`update APP.players set is_injured=false where id='${id(100)}'`)).rejects.toMatchObject({ code: "42501" });
  });

  it("denies injury edits in archived groups and rejects null status", async () => {
    await sql(`update APP.organizations set archived_at=now() where id='${id(10)}';`);
    await login();
    expect(await rows(`update APP.players set is_injured=true where id='${id(100)}' returning id`)).toEqual([]);
    await sql(`reset role; update APP.organizations set archived_at=null where id='${id(10)}';`);
    await login();
    await expect(sql(`update APP.players set is_injured=null where id='${id(100)}'`)).rejects.toMatchObject({ code: "23502" });
    expect(await snapshots()).toEqual([{ organization_id: id(10) }, { organization_id: id(11) }]);
  });

  it("keeps the privileged cache trigger private with no direct application execution", async () => {
    expect(await rows(`select n.nspname,p.prosecdef,p.proconfig,
      has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
      has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
      has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where p.proname='invalidate_player_injury_snapshot'`)).toEqual([{
      nspname: `${schema}_private`, prosecdef: true, proconfig: ['search_path=""'],
      anon_execute: false, authenticated_execute: false, service_execute: false
    }]);
  });
});
