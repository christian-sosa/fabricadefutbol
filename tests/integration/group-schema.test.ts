import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { executePrivateSql, privateSqlAvailable } from "../helpers/private-sql";

const source = "supabase/generated/schema.app_prod.sql";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

// Operational SQL stays local. Execute the real generated baseline, not source-string assertions.
describe.skipIf(!privateSqlAvailable(source))("groups database and RLS", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key,email text);
      create table auth.mfa_factors(user_id uuid,status text);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,updated_at timestamptz,created_at timestamptz,owner uuid);
      alter table storage.objects enable row level security;
      grant usage on schema auth,storage to anon,authenticated,service_role;
      grant select on storage.objects to anon,authenticated;`);
    for (const file of [source, "supabase/generated/policies.app_prod.sql", "supabase/generated/policies.storage.sql"]) {
      const sql = readFileSync(file, "utf8").replace("create extension if not exists pgcrypto;", "");
      await executePrivateSql(db, sql, file);
      await executePrivateSql(db, sql, file); // Idempotent deployment is part of the contract.
    }
  }, 30_000);
  afterAll(async () => { await db?.close(); });
  beforeEach(async () => {
    await db.exec(`reset role; truncate app_prod.organizations cascade; truncate app_prod.admins cascade; truncate auth.users cascade;
      select set_config('test.uid','',false);
      insert into auth.users values ('${id(1)}','owner@example.test'),('${id(2)}','guest@example.test'),('${id(3)}','other@example.test');
      insert into app_prod.admins(id,display_name) values ('${id(1)}','Owner'),('${id(2)}','Guest'),('${id(3)}','Other');
      insert into app_prod.organizations(id,name,slug,created_by,is_public) values ('${id(10)}','Public','public','${id(1)}',true),('${id(11)}','Other','other','${id(3)}',true);
      insert into app_prod.organization_admins(organization_id,admin_id) values ('${id(10)}','${id(2)}');
      insert into app_prod.players(id,organization_id,full_name,initial_rank) values ('${id(20)}','${id(10)}','Uno',1),('${id(21)}','${id(11)}','Dos',1);`);
  });
  it("preserves public groups and prevents anonymous writes", async () => {
    await db.exec("set role anon");
    expect((await db.query("select id from app_prod.players")).rows).toHaveLength(2);
    await expect(db.exec(`insert into app_prod.players(organization_id,full_name,initial_rank) values ('${id(10)}','Intruso',2)`)).rejects.toThrow();
  });
  it("allows an invited administrator to create one owned group and blocks a second", async () => {
    await db.exec(`select set_config('test.uid','${id(2)}',false); set role authenticated;`);
    await db.exec(`select app_prod.create_group_organization('${id(12)}','Own','own')`);
    await expect(db.exec(`select app_prod.create_group_organization('${id(13)}','Second','second')`)).rejects.toThrow(/Ya tenes un grupo/);
    expect((await db.query(`update app_prod.players set full_name='Otro' where id='${id(21)}' returning id`)).rows).toHaveLength(0);
  });
  it("keeps creation and ownership immutable", async () => {
    await db.exec(`select set_config('test.uid','${id(1)}',false); set role authenticated;`);
    await expect(db.exec(`update app_prod.organizations set created_at=now()-interval '1 year' where id='${id(10)}'`)).rejects.toThrow();
    await expect(db.exec(`update app_prod.organizations set created_by='${id(2)}' where id='${id(10)}'`)).rejects.toThrow();
  });
  it("creates matches without recursive policies and rejects cross-group links", async () => {
    await db.exec(`insert into app_prod.matches(id,organization_id,created_by,modality,scheduled_at) values ('${id(40)}','${id(11)}','${id(3)}','5v5',now());
      insert into app_prod.team_options(id,match_id,option_number,rating_sum_a,rating_sum_b,rating_diff,created_by) values ('${id(50)}','${id(40)}',1,1000,1000,0,'${id(3)}');
      select set_config('test.uid','${id(1)}',false); set role authenticated;
      insert into app_prod.matches(id,organization_id,created_by,modality,scheduled_at) values ('${id(41)}','${id(10)}','${id(1)}','5v5',now());
      insert into app_prod.team_options(id,match_id,option_number,rating_sum_a,rating_sum_b,rating_diff,created_by) values ('${id(51)}','${id(41)}',1,1000,1000,0,'${id(1)}');
      insert into app_prod.match_players(match_id,player_id) values ('${id(41)}','${id(20)}');
      insert into app_prod.team_option_players(team_option_id,player_id,team) values ('${id(51)}','${id(20)}','A');`);
    await expect(db.exec(`insert into app_prod.match_players(match_id,player_id) values ('${id(41)}','${id(21)}')`)).rejects.toThrow(/row-level security/);
    await expect(db.exec(`insert into app_prod.team_option_players(team_option_id,player_id,team) values ('${id(51)}','${id(21)}','B')`)).rejects.toThrow(/row-level security/);
    await expect(db.exec(`update app_prod.matches set confirmed_option_id='${id(50)}' where id='${id(41)}'`)).rejects.toThrow();
    await expect(db.exec(`update app_prod.matches set confirmed_option_id='${id(51)}' where id='${id(41)}'`)).rejects.toThrow(/operacion deportiva/);
  });
  it("enforces skill bounds and rank uniqueness without remapping existing players", async () => {
    await expect(db.exec(`update app_prod.players set skill_level=8 where id='${id(20)}'`)).rejects.toThrow();
    await expect(db.exec(`insert into app_prod.players(organization_id,full_name,initial_rank) values ('${id(10)}','Repeat',1)`)).rejects.toThrow();
    expect((await db.query(`select current_rating from app_prod.players where id='${id(20)}'`)).rows[0]).toEqual({ current_rating: "1000.00" });
  });
  it("supports an inclusive year end and a single active season", async () => {
    await db.exec(`insert into app_prod.organization_seasons(organization_id,label,duration_months,starts_at,ends_at) values ('${id(10)}','2026',12,'2026-12-31','2026-12-31')`);
    await expect(db.exec(`insert into app_prod.organization_seasons(organization_id,label,duration_months,starts_at,ends_at) values ('${id(10)}','2027',12,'2027-01-01','2027-12-31')`)).rejects.toThrow();
  });
  it("keeps audit append-only and event writes server-only", async () => {
    await db.exec(`select set_config('test.uid','${id(1)}',false); set role authenticated;`);
    await expect(db.exec(`insert into app_prod.analytics_events(event_name) values ('group_created')`)).rejects.toThrow();
    await expect(db.exec(`insert into app_prod.organization_audit_events(organization_id,event_type) values ('${id(10)}','forged')`)).rejects.toThrow();
  });
  it("deduplicates trusted events and rejects unrecognized names", async () => {
    await db.exec("insert into app_prod.analytics_events(event_name,event_key) values ('referral_visit','visit:1')");
    await expect(db.exec("insert into app_prod.analytics_events(event_name,event_key) values ('referral_visit','visit:1')")).rejects.toThrow();
    await expect(db.exec("insert into app_prod.analytics_events(event_name) values ('forged')")).rejects.toThrow();
  });
  it("binds legacy and versioned photo paths to group visibility and ownership", async () => {
    await db.exec("set role anon");
    for (const photo of [`app_prod/${id(10)}/${id(20)}.webp`, `app_prod/${id(10)}/${id(20)}/${id(30)}.webp`]) {
      expect((await db.query("select public.can_read_player_photo_object($1) allowed", [photo])).rows[0]).toEqual({ allowed: true });
      expect((await db.query("select public.can_manage_player_photo_object($1) allowed", [photo])).rows[0]).toEqual({ allowed: false });
    }
    expect((await db.query("select public.can_read_player_photo_object($1) allowed", [`app_prod/${id(11)}/${id(20)}.webp`])).rows[0]).toEqual({ allowed: false });
    expect((await db.query("select public.can_read_player_photo_object($1) allowed", [`arbitrary/${id(10)}/${id(20)}.webp`])).rows[0]).toEqual({ allowed: false });
  });
  it("does not count retention cleanup as renewed player activity", async () => {
    await db.exec(`update app_prod.players set photo_path='old.webp' where id='${id(20)}'`);
    const before = (await db.query(`select updated_at from app_prod.players where id='${id(20)}'`)).rows[0];
    await db.exec(`update app_prod.players set photo_path=null where id='${id(20)}'`);
    expect((await db.query(`select updated_at from app_prod.players where id='${id(20)}'`)).rows[0]).toEqual(before);
  });
  it("has no retired domain tables in a clean installation and private buckets", async () => {
    expect((await db.query("select tablename from pg_tables where schemaname='app_prod' and tablename ~ 'club|league|tournament'")).rows).toEqual([]);
    expect((await db.query("select id from storage.buckets where public")).rows).toEqual([]);
  });
});
