import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { executePrivateSql, privateSqlAvailable } from "../helpers/private-sql";
import { readUpgradeSources } from "../../scripts/lib/sql-upgrade-artifact.mjs";
import { buildSchemaSources } from "../../scripts/lib/schema-sql.mjs";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const upgrades = privateSqlAvailable("supabase/upgrade-artifacts/positions-baseline/schema.sql") ? readUpgradeSources() : undefined;

describe.skipIf(!privateSqlAvailable("supabase/generated/schema.app_prod.sql")).each(["app_dev", "app_prod"])("%s player position preferences and RLS", (schema) => {
  let db: PGlite;
  const sql = (query: string) => db.exec(query.replaceAll("APP", schema));
  const rows = async (query: string) => (await db.query<Record<string, unknown>>(query.replaceAll("APP", schema))).rows;
  const login = async (user = 1) => sql(`reset role; select set_config('test.uid','${id(user)}',false); set role authenticated;`);
  const preferences = () => rows("select id,preferred_position,secondary_position from APP.players order by id");

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
      insert into auth.users values('${id(1)}','owner@example.test'),('${id(2)}','other@example.test'),('${id(3)}','invited@example.test');
      insert into APP.admins(id,display_name) values('${id(1)}','Owner'),('${id(2)}','Other'),('${id(3)}','Invited');
      insert into APP.organizations(id,name,slug,created_by) values('${id(10)}','One','one','${id(1)}'),('${id(11)}','Two','two','${id(2)}');
      insert into APP.organization_admins(organization_id,admin_id) values('${id(10)}','${id(3)}');
      insert into APP.players(id,organization_id,full_name,initial_rank,current_rating) values('${id(100)}','${id(10)}','Player One',1,1240),('${id(200)}','${id(11)}','Player Two',1,1150);`);
  });

  it("applies the exact recorded migration to the previous released baseline, preserving finished matches and ratings", async () => {
    const previous = new PGlite();
    const baseline = Object.fromEntries(["schema.sql", "policies.sql", "group-match-workflow.sql"].map((name) => [name, upgrades![`positions-baseline/${name}`]]));
    const generated = buildSchemaSources(baseline, schema);
    const run = (query: string) => previous.exec(query.replaceAll("APP", schema));
    const previousRows = async (query: string) => (await previous.query<Record<string, unknown>>(query.replaceAll("APP", schema))).rows;
    try {
      await previous.exec(`create role anon; create role authenticated; create role service_role bypassrls;
        create schema auth; create schema storage;
        create table auth.users(id uuid primary key,email text); create table auth.mfa_factors(user_id uuid,status text);
        create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
        create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('aal','aal1') $$;
        create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
        create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,updated_at timestamptz,created_at timestamptz,owner uuid);
        alter table storage.objects enable row level security;
        grant usage on schema auth,storage to anon,authenticated,service_role;
        grant select on storage.objects to anon,authenticated;`);
      for (const [name, source] of Object.entries(generated)) await executePrivateSql(previous, source.replace("create extension if not exists pgcrypto;", ""), `previous-release/${name}`);
      await executePrivateSql(previous, upgrades![`positions-prerequisites/${schema}.sql`], `recorded-prerequisite/${schema}`);
      expect(await previousRows("select column_name from information_schema.columns where table_schema='APP' and table_name='players' and column_name='preferred_position'")).toEqual([]);
      await run(`insert into auth.users values('${id(1)}','owner@example.test'),('${id(2)}','other@example.test');
        insert into APP.admins(id,display_name) values('${id(1)}','Owner'),('${id(2)}','Other');
        insert into APP.organizations(id,name,slug,created_by) values('${id(10)}','Group','group','${id(1)}');
        insert into APP.players(id,organization_id,full_name,initial_rank) values ${Array.from({length:10}, (_,n)=>`('${id(100+n)}','${id(10)}','Player ${n}',${n+1})`).join(",")};
        insert into APP.matches(id,organization_id,created_by,modality,scheduled_at) values('${id(40)}','${id(10)}','${id(1)}','5v5','2026-09-01');
        insert into APP.team_options(id,match_id,option_number,rating_sum_a,rating_sum_b,rating_diff,created_by) values('${id(50)}','${id(40)}',1,5000,5000,0,'${id(1)}');
        insert into APP.match_players(match_id,player_id) select '${id(40)}',id from APP.players;
        insert into APP.team_option_players(team_option_id,player_id,team) select '${id(50)}',id,case when initial_rank<=5 then 'A'::APP.team_side else 'B'::APP.team_side end from APP.players;
        select set_config('test.uid','${id(1)}',false); set role authenticated;
        select APP.confirm_group_match_option('${id(40)}','${id(10)}','${id(50)}');
        select APP.save_group_match_result('${id(40)}','${id(10)}',1,'{"scoreA":2,"scoreB":1}'); reset role;`);
      const sporting = async () => Object.fromEntries(await Promise.all(["players", "matches", "match_result", "rating_history", "organization_seasons", "organization_season_player_ratings"].map(async (table) => [table, await previousRows(`select to_jsonb(t)-'preferred_position'-'secondary_position' row from APP.${table} t order by to_jsonb(t)::text`)])));
      const before = await sporting();
      const migration = upgrades![`positions-migrations/${schema}.sql`];
      await executePrivateSql(previous, migration, `recorded-positions-migration/${schema}`);
      await executePrivateSql(previous, migration, `recorded-positions-migration/${schema}`);
      expect(await sporting()).toEqual(before);
      expect(await previousRows("select preferred_position,secondary_position from APP.players")).toEqual(Array.from({length:10}, () => ({preferred_position:null,secondary_position:null})));
      await run(`select set_config('test.uid','${id(1)}',false); set role authenticated; update APP.players set preferred_position='GK',secondary_position='DEF' where id='${id(100)}';`);
      expect(await previousRows(`select preferred_position,secondary_position from APP.players where id='${id(100)}'`)).toEqual([{preferred_position:"GK",secondary_position:"DEF"}]);
      await run(`reset role; select set_config('test.uid','${id(2)}',false); set role authenticated;`);
      expect(await previousRows(`update APP.players set preferred_position='FWD' where id='${id(100)}' returning id`)).toEqual([]);
    } finally { await previous.close(); }
  }, 30_000);

  it("lets owners and invited group administrators update, clear and insert preferences", async () => {
    const before = await rows("select id,current_rating,initial_rank,skill_level,active,is_injured from APP.players order by id");
    await login();
    await sql(`update APP.players set preferred_position='DEF',secondary_position='MID' where id='${id(100)}';`);
    expect(await preferences()).toEqual([
      { id: id(100), preferred_position: "DEF", secondary_position: "MID" }
    ]);
    await login(3);
    await sql(`update APP.players set preferred_position='FWD',secondary_position='GK' where id='${id(100)}';`);
    expect(await rows(`select preferred_position,secondary_position from APP.players where id='${id(100)}'`)).toEqual([{ preferred_position: "FWD", secondary_position: "GK" }]);
    await sql(`update APP.players set secondary_position=null where id='${id(100)}';`);
    await sql(`update APP.players set preferred_position=null where id='${id(100)}';`);
    expect(await preferences()).toEqual([
      { id: id(100), preferred_position: null, secondary_position: null }
    ]);
    await sql("reset role;");
    expect(await preferences()).toEqual([
      { id: id(100), preferred_position: null, secondary_position: null },
      { id: id(200), preferred_position: null, secondary_position: null }
    ]);
    expect(await rows("select id,current_rating,initial_rank,skill_level,active,is_injured from APP.players order by id")).toEqual(before);
    expect(await rows("select * from APP.rating_history")).toEqual([]);
    await login(3);
    await sql(`insert into APP.players(id,organization_id,full_name,initial_rank,preferred_position,secondary_position) values('${id(101)}','${id(10)}','New',2,'GK','DEF');`);
    expect(await rows(`select preferred_position,secondary_position from APP.players where id='${id(101)}'`)).toEqual([{ preferred_position: "GK", secondary_position: "DEF" }]);
  });

  it.each([
    ["unknown primary", "'CB'", "null"],
    ["unknown secondary", "'DEF'", "'ST'"],
    ["duplicate preference", "'MID'", "'MID'"],
    ["secondary without primary", "null", "'FWD'"],
    ["empty primary", "''", "null"],
    ["lowercase primary", "'gk'", "null"]
  ])("rejects %s on inserts and updates", async (_label, preferred, secondary) => {
    await login();
    await expect(sql(`update APP.players set preferred_position=${preferred},secondary_position=${secondary} where id='${id(100)}'`)).rejects.toMatchObject({ code: "23514" });
    await expect(sql(`insert into APP.players(organization_id,full_name,initial_rank,preferred_position,secondary_position) values('${id(10)}','Invalid',2,${preferred},${secondary})`)).rejects.toMatchObject({ code: "23514" });
    expect(await rows(`select preferred_position,secondary_position from APP.players where id='${id(100)}'`)).toEqual([{ preferred_position: null, secondary_position: null }]);
  });

  it("requires clearing the secondary preference when removing the primary", async () => {
    await login();
    await sql(`update APP.players set preferred_position='DEF',secondary_position='MID' where id='${id(100)}';`);
    await expect(sql(`update APP.players set preferred_position=null where id='${id(100)}'`)).rejects.toMatchObject({ code: "23514" });
    expect(await rows(`select preferred_position,secondary_position from APP.players where id='${id(100)}'`)).toEqual([{ preferred_position: "DEF", secondary_position: "MID" }]);
  });

  it("accepts each primary position without requiring a secondary preference", async () => {
    await login();
    for (const preferred of ["GK", "DEF", "MID", "FWD"]) {
      await sql(`update APP.players set preferred_position='${preferred}',secondary_position=null where id='${id(100)}';`);
      expect(await rows(`select preferred_position,secondary_position from APP.players where id='${id(100)}'`)).toEqual([{ preferred_position: preferred, secondary_position: null }]);
    }
  });

  it("preserves the existing public player view contract", async () => {
    expect(await rows("select column_name from information_schema.columns where table_schema='APP' and table_name='public_players' and column_name in ('preferred_position','secondary_position')")).toEqual([]);
    await sql("set role anon;");
    expect(await rows("select full_name,is_injured from APP.public_players order by id")).toEqual([
      { full_name: "Player One", is_injured: false },
      { full_name: "Player Two", is_injured: false }
    ]);
  });

  it("denies edits and inserts for another group", async () => {
    await login(2);
    expect(await rows(`update APP.players set preferred_position='GK' where id='${id(100)}' returning id`)).toEqual([]);
    await expect(sql(`insert into APP.players(organization_id,full_name,initial_rank,preferred_position) values('${id(10)}','Intruder',2,'FWD')`)).rejects.toMatchObject({ code: "42501" });
    expect(await rows(`select preferred_position,secondary_position from APP.players where id='${id(100)}'`)).toEqual([]);
    await sql("reset role;");
    expect(await rows(`select preferred_position,secondary_position from APP.players where id='${id(100)}'`)).toEqual([{ preferred_position: null, secondary_position: null }]);
  });

  it("denies anonymous writes and writes in archived groups", async () => {
    await sql("set role anon;");
    await expect(sql(`update APP.players set preferred_position='GK' where id='${id(100)}'`)).rejects.toMatchObject({ code: "42501" });
    await sql(`reset role; update APP.organizations set archived_at=now() where id='${id(10)}';`);
    await login();
    expect(await rows(`update APP.players set preferred_position='GK' where id='${id(100)}' returning id`)).toEqual([]);
  });
});
