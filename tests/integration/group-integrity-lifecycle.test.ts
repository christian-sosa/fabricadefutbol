import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { executePrivateSql, privateSqlAvailable } from "../helpers/private-sql";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe.skipIf(!privateSqlAvailable("supabase/generated/schema.app_prod.sql")).each(["app_dev", "app_prod"])("%s real baseline integrity and lifecycle", (schema) => {
  let db: PGlite;
  const bucket = schema === "app_dev" ? "player-photos-dev" : "player-photos";
  const photo = `${schema}/${id(10)}/${id(20)}/${id(90)}.webp`;
  const sql = (query: string) => db.exec(query.replaceAll("APP_PRIVATE", `${schema}_private`).replaceAll("APP", schema));
  const rows = async (query: string) => (await db.query<Record<string, unknown>>(query.replaceAll("APP_PRIVATE", `${schema}_private`).replaceAll("APP", schema))).rows;
  const login = async (user = 1, aal = "aal1") => sql(`reset role; select set_config('test.uid','${id(user)}',false); select set_config('test.aal','${aal}',false); set role authenticated;`);
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key,email text);
      create table auth.mfa_factors(user_id uuid,status text);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('aal',current_setting('test.aal',true)) $$;
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
    await sql(`reset role; truncate APP.organizations cascade; truncate APP.admins cascade; truncate auth.users cascade;
      truncate auth.mfa_factors; truncate APP.super_admin_emails; truncate APP_PRIVATE.media_cleanup_jobs; truncate APP_PRIVATE.shared_rate_limits;
      select set_config('test.uid','',false); select set_config('test.aal','aal1',false);
      insert into auth.users values('${id(1)}','owner@example.test'),('${id(2)}','other@example.test'),('${id(3)}','super@example.test');
      insert into APP.admins(id,display_name) values('${id(1)}','Owner'),('${id(2)}','Other'),('${id(3)}','Super');
      insert into APP.super_admin_emails(email) values('super@example.test');
      insert into APP.organizations(id,name,slug,created_by) values('${id(10)}','One','one','${id(1)}'),('${id(11)}','Two','two','${id(2)}');
      insert into APP.players(id,organization_id,full_name,initial_rank) values ${Array.from({ length: 10 }, (_, n) => `('${id(20 + n)}','${id(10)}','Player ${n}',${n + 1})`).join(",")};
      insert into APP.matches(id,organization_id,created_by,modality,scheduled_at) values('${id(40)}','${id(10)}','${id(1)}','5v5','2026-09-01');
      insert into APP.team_options(id,match_id,option_number,rating_sum_a,rating_sum_b,rating_diff,created_by) values('${id(50)}','${id(40)}',1,5000,5000,0,'${id(1)}');
      insert into APP.match_players(match_id,player_id) select '${id(40)}',id from APP.players where organization_id='${id(10)}';
      insert into APP.team_option_players(team_option_id,player_id,team) select '${id(50)}',id,case when initial_rank<=5 then 'A'::APP.team_side else 'B'::APP.team_side end from APP.players where organization_id='${id(10)}';`);
  });
  const confirm = async () => { await login(); await sql(`select APP.confirm_group_match_option('${id(40)}','${id(10)}','${id(50)}')`); };
  const finish = async () => { await confirm(); await sql(`select APP.save_group_match_result('${id(40)}','${id(10)}',1,'{"scoreA":2,"scoreB":1}')`); };

  it("creates group, membership, season and audit atomically; stable form IDs make retries idempotent", async () => {
    await login(3, "aal2");
    const first = (await rows(`select APP.create_group_organization('${id(70)}','New group','one') result`))[0].result;
    expect(first).toEqual({ organizationId: id(70), slug: "one-2", created: true });
    expect((await rows(`select APP.create_group_organization('${id(70)}','New group','one') result`))[0].result)
      .toEqual({ organizationId: id(70), slug: "one-2", created: false });
    expect(await rows(`select id from APP.organization_admins where organization_id='${id(70)}'`)).toHaveLength(1);
    expect(await rows(`select id from APP.organization_seasons where organization_id='${id(70)}'`)).toHaveLength(1);
    expect(await rows(`select id from APP.organization_audit_events where organization_id='${id(70)}'`)).toHaveLength(1);
    // The legitimate superadmin can still create an additional distinct group.
    await sql(`select APP.create_group_organization('${id(71)}','Another group','another-group')`);
    await login(1);
    await expect(sql(`select APP.create_group_organization('${id(70)}','New group','one')`)).rejects.toThrow(/en uso/);
    await expect(sql(`insert into APP.organizations(id,name,slug,created_by) values('${id(72)}','Direct','direct','${id(1)}')`)).rejects.toThrow();
  });
  it("rolls back a group creation failure after membership insertion and permits the same form retry", async () => {
    await sql(`insert into auth.users values('${id(4)}','new-owner@example.test'); insert into APP.admins(id,display_name) values('${id(4)}','New');
      create function APP.test_fail_season() returns trigger language plpgsql as $$ begin raise exception 'forced season failure'; end $$;
      create trigger test_fail_season before insert on APP.organization_seasons for each row execute function APP.test_fail_season();`);
    await login(4);
    await expect(sql(`select APP.create_group_organization('${id(70)}','New group','new-group')`)).rejects.toThrow(/forced season failure/);
    await sql("reset role; drop trigger test_fail_season on APP.organization_seasons; drop function APP.test_fail_season()");
    expect(await rows(`select id from APP.organizations where id='${id(70)}'`)).toEqual([]);
    expect(await rows(`select id from APP.organization_admins where organization_id='${id(70)}'`)).toEqual([]);
    await login(4);
    await sql(`select APP.create_group_organization('${id(70)}','New group','new-group'); select APP.create_group_organization('${id(70)}','New group','new-group')`);
    await expect(sql(`select APP.create_group_organization('${id(71)}','Second group','second-group')`)).rejects.toThrow(/Ya tenes un grupo/);
  });

  it("allows draft creation and label edits while rejecting direct points and forged results", async () => {
    await login();
    await sql(`update APP.players set full_name='Renamed' where id='${id(20)}'; update APP.matches set location='Cancha',team_a_label='Verdes' where id='${id(40)}'`);
    for (const query of [
      `update APP.players set current_rating=9999 where id='${id(20)}'`,
      `insert into APP.players(organization_id,full_name,initial_rank,current_rating) values('${id(10)}','Bad',20,9999)`,
      `update APP.matches set status='finished' where id='${id(40)}'`,
      `update APP.matches set organization_id='${id(11)}' where id='${id(40)}'`,
      `update APP.matches set result_version=99 where id='${id(40)}'`,
      `update APP.matches set lineup_snapshot='[{}]' where id='${id(40)}'`,
      `insert into APP.match_result(match_id,score_a,score_b,winner_team,created_by) values('${id(40)}',9,0,'A','${id(1)}')`,
      `insert into APP.rating_history(match_id,player_id,rating_before,rating_after,delta,reason) values('${id(40)}','${id(20)}',1000,9999,8999,'match_result')`
    ]) await expect(sql(query)).rejects.toThrow();
    await sql(`delete from APP.matches where id='${id(40)}'`);
    expect(await rows("select * from APP.matches")).toEqual([]);
  });
  it("keeps unused player and group IDs immutable before foreign keys could protect them", async () => {
    await sql(`insert into APP.players(id,organization_id,full_name,initial_rank) values('${id(70)}','${id(10)}','Unused',11)`);
    await login();
    await expect(sql(`update APP.players set id='${id(71)}' where id='${id(70)}'`)).rejects.toThrow();
    await login(2);
    await expect(sql(`update APP.organizations set id='${id(12)}' where id='${id(11)}'`)).rejects.toThrow();
  });
  it("keeps confirmation and result RPCs functional under real RLS, and rejects confirmed membership edits", async () => {
    await finish();
    expect((await rows(`select current_rating from APP.players where id='${id(20)}'`))[0]).toEqual({ current_rating: "1010.00" });
    for (const query of [
      `delete from APP.matches where id='${id(40)}'`,
      `delete from APP.organization_seasons`,
      `update APP.organization_season_player_ratings set current_rating=9999`,
      `update APP.team_option_players set team='B' where player_id='${id(20)}'`,
      `delete from APP.match_players where player_id='${id(20)}'`,
      `delete from APP.team_options where id='${id(50)}'`,
      `update APP.matches set scheduled_at='2027-01-01' where id='${id(40)}'`
    ]) await expect(sql(query)).rejects.toThrow();
    await sql(`update APP.matches set scheduled_at='2026-09-02',team_a_label='Azules' where id='${id(40)}'`);
  });
  it("rejects stale versions and cross-group RPCs without altering totals", async () => {
    await finish();
    const previousLedger = await rows("select * from APP.rating_history order by id");
    const previousMatch = await rows(`select * from APP.matches where id='${id(40)}'`);
    await expect(sql(`select APP.save_group_match_result('${id(40)}','${id(10)}',1,'{"scoreA":0,"scoreB":2}')`)).rejects.toMatchObject({ code: "PT409" });
    expect(await rows("select * from APP.rating_history order by id")).toEqual(previousLedger);
    expect(await rows(`select * from APP.matches where id='${id(40)}'`)).toEqual(previousMatch);
    await login(2);
    await expect(sql(`select APP.save_group_match_result('${id(40)}','${id(10)}',2,'{"scoreA":0,"scoreB":2}')`)).rejects.toThrow();
    await sql("reset role");
    expect((await rows(`select current_rating from APP.players where id='${id(20)}'`))[0]).toEqual({ current_rating: "1010.00" });
  });
  it("returns a non-retrying HTTP conflict code for stale option replacement without mutation", async () => {
    await login();
    const previousOptions = await rows("select * from APP.team_options order by id");
    const previousMembers = await rows("select * from APP.team_option_players order by player_id");
    await expect(sql(`select APP.replace_group_match_options('${id(40)}','${id(10)}',99,'[]')`)).rejects.toMatchObject({ code: "PT409" });
    expect(await rows("select * from APP.team_options order by id")).toEqual(previousOptions);
    expect(await rows("select * from APP.team_option_players order by player_id")).toEqual(previousMembers);
  });
  const seedSecondMatch = async (date: string) => {
    await sql(`reset role;
      insert into APP.matches(id,organization_id,created_by,modality,scheduled_at) values('${id(41)}','${id(10)}','${id(1)}','5v5','${date}');
      insert into APP.team_options(id,match_id,option_number,rating_sum_a,rating_sum_b,rating_diff,created_by) values('${id(51)}','${id(41)}',1,5000,5000,0,'${id(1)}');
      insert into APP.match_players(match_id,player_id) select '${id(41)}',id from APP.players where organization_id='${id(10)}';
      insert into APP.team_option_players(team_option_id,player_id,team) select '${id(51)}',id,case when initial_rank<=5 then 'A'::APP.team_side else 'B'::APP.team_side end from APP.players where organization_id='${id(10)}';`);
    await login();
    await sql(`select APP.confirm_group_match_option('${id(41)}','${id(10)}','${id(51)}'); select APP.save_group_match_result('${id(41)}','${id(10)}',1,'{"scoreA":3,"scoreB":1}')`);
  };
  it("corrects an older score while preserving later contributions and metadata-only ledger identity", async () => {
    await finish();
    await seedSecondMatch("2026-10-01");
    const later = await rows(`select * from APP.rating_history where match_id='${id(41)}' order by player_id`);
    await sql(`select APP.save_group_match_result('${id(40)}','${id(10)}',2,'{"scoreA":0,"scoreB":1}')`);
    expect((await rows(`select current_rating from APP.players where id='${id(20)}'`))[0]).toEqual({ current_rating: "1000.00" });
    expect(await rows(`select * from APP.rating_history where match_id='${id(41)}' order by player_id`)).toEqual(later);
    const ledger = await rows("select * from APP.rating_history order by id");
    await sql(`select APP.save_group_match_result('${id(40)}','${id(10)}',3,'{"scoreA":0,"scoreB":1,"notes":"Nota corregida","mvpParticipantId":"player:${id(20)}"}')`);
    expect(await rows("select * from APP.rating_history order by id")).toEqual(ledger);
  });
  it("keeps each sporting year when correcting a previous-year match after the rollover", async () => {
    await sql(`update APP.matches set scheduled_at='2025-12-31 20:00Z' where id='${id(40)}'`);
    await finish();
    await seedSecondMatch("2026-01-01 20:00Z");
    const seasonId = (await rows(`select season_id from APP.matches where id='${id(41)}'`))[0].season_id;
    const current = await rows(`select * from APP.organization_season_player_ratings where season_id='${seasonId}' order by player_id`);
    await sql(`select APP.save_group_match_result('${id(40)}','${id(10)}',2,'{"scoreA":0,"scoreB":1}')`);
    expect(await rows(`select * from APP.organization_season_player_ratings where season_id='${seasonId}' order by player_id`)).toEqual(current);
    expect((await rows(`select s.starts_at::text starts_at from APP.matches m join APP.organization_seasons s on s.id=m.season_id where m.id='${id(40)}'`))[0]).toEqual({ starts_at: "2025-01-01" });
    expect((await rows(`select current_rating from APP.players where id='${id(20)}'`))[0]).toEqual({ current_rating: "1000.00" });
  });
  it("archives and restores data and photos; anonymous old IDs cannot bypass archival", async () => {
    await sql(`update APP.players set photo_path='${photo}' where id='${id(20)}'`);
    await login();
    await expect(sql(`select APP.set_group_archived('${id(10)}',true)`)).rejects.toThrow();
    await login(3);
    await sql(`select APP.set_group_archived('${id(10)}',true); set role anon; select set_config('test.uid','',false)`);
    expect(await rows(`select id from APP.organizations where id='${id(10)}'`)).toEqual([]);
    expect(await rows(`select id from APP.players where organization_id='${id(10)}'`)).toEqual([]);
    expect((await db.query("select public.can_read_player_photo_object($1) allowed", [photo])).rows[0]).toEqual({ allowed: false });
    await login(1);
    await expect(sql(`select APP.ensure_group_current_season('${id(10)}')`)).rejects.toThrow();
    await login(3);
    await sql(`select APP.set_group_archived('${id(10)}',false); reset role;`);
    expect((await rows(`select photo_path from APP.players where id='${id(20)}'`))[0]).toEqual({ photo_path: photo });
    expect(await rows("select * from APP_PRIVATE.media_cleanup_jobs")).toEqual([]);
  });
  it("requires MFA after verified enrollment and always for permanent purge", async () => {
    await login(3);
    expect((await rows("select APP.is_super_admin() allowed"))[0]).toEqual({ allowed: true });
    await sql(`select APP.set_group_archived('${id(10)}',true)`);
    await expect(sql(`select APP.purge_group('${id(10)}')`)).rejects.toThrow(/dos pasos/);
    await sql(`reset role; insert into auth.mfa_factors values('${id(3)}','verified')`);
    await login(3);
    expect((await rows("select APP.is_super_admin() allowed"))[0]).toEqual({ allowed: false });
    await login(3, "aal2");
    expect((await rows("select APP.is_super_admin() allowed"))[0]).toEqual({ allowed: true });
  });
  it("purges atomically, preserves other groups and queues actual, cover and legacy paths", async () => {
    await finish();
    await sql(`reset role; update APP.players set photo_path='${photo}' where id='${id(20)}'; update APP.organizations set image_path='${schema}/organizations/${id(10)}.webp' where id='${id(10)}'`);
    await login(3, "aal2");
    await expect(sql(`select APP.purge_group('${id(10)}')`)).rejects.toThrow(/Primero archiva/);
    await sql(`select APP.set_group_archived('${id(10)}',true); select APP.purge_group('${id(10)}'); select APP.purge_group('${id(10)}'); reset role`);
    expect(await rows("select id from APP.organizations")).toEqual([{ id: id(11) }]);
    expect(await rows("select * from APP.rating_history")).toEqual([]);
    const paths = (await rows("select object_path from APP_PRIVATE.media_cleanup_jobs")).map((row) => row.object_path);
    expect(paths).toEqual(expect.arrayContaining([photo, `${schema}/${id(10)}/${id(20)}.webp`, `${id(10)}/${id(20)}.webp`, `${schema}/organizations/${id(10)}.webp`]));
  });
  it("rolls back every deletion and queued file when a late database operation fails", async () => {
    await finish();
    await login(3, "aal2");
    await sql(`select APP.set_group_archived('${id(10)}',true); reset role;
      create function APP.test_fail_purge() returns trigger language plpgsql as $$ begin raise exception 'forced late failure'; end $$;
      create trigger test_fail_purge before delete on APP.organizations for each row execute function APP.test_fail_purge();`);
    await login(3, "aal2");
    await expect(sql(`select APP.purge_group('${id(10)}')`)).rejects.toThrow(/forced late failure/);
    await sql("reset role; drop trigger test_fail_purge on APP.organizations; drop function APP.test_fail_purge()");
    expect(await rows("select id from APP.matches")).toHaveLength(1);
    expect(await rows("select id from APP.rating_history")).toHaveLength(10);
    expect(await rows("select id from APP.players")).toHaveLength(10);
    expect(await rows("select id from APP_PRIVATE.media_cleanup_jobs")).toHaveLength(0);
  });
  it("protects player history and atomically queues deletion of an unused player's photo", async () => {
    await finish();
    await expect(sql(`select APP.delete_group_player('${id(20)}','${id(10)}')`)).rejects.toThrow(/historial/);
    await sql(`reset role; insert into APP.players(id,organization_id,full_name,initial_rank,photo_path) values('${id(70)}','${id(10)}','Unused',11,'${schema}/${id(10)}/${id(70)}/${id(90)}.webp')`);
    await login();
    await sql(`select APP.delete_group_player('${id(70)}','${id(10)}'); reset role`);
    expect(await rows(`select id from APP.players where id='${id(70)}'`)).toEqual([]);
    expect(await rows(`select id from APP_PRIVATE.media_cleanup_jobs where object_path='${schema}/${id(10)}/${id(70)}/${id(90)}.webp'`)).toHaveLength(1);
  });
  it("reserves orphan cleanup before upload and refuses reattachment after retirement", async () => {
    await sql(`set role service_role; select APP.enqueue_media_cleanup('${bucket}','${photo}',true); reset role;`);
    await login();
    await sql(`update APP.players set photo_path='${photo}' where id='${id(20)}'; reset role; set role service_role`);
    expect((await rows("select APP.claim_media_cleanup() jobs"))[0]).toEqual({ jobs: [] });
    await sql(`reset role; update APP.players set photo_path=null where id='${id(20)}'; set role service_role;`);
    const jobs = (await rows("select APP.claim_media_cleanup() jobs"))[0].jobs as unknown[];
    expect(jobs).toHaveLength(1);
    await login();
    await expect(sql(`update APP.players set photo_path='${photo}' where id='${id(20)}'`)).rejects.toThrow(/retirada/);
  });
  it("ignores stale retention versions and retains archived media", async () => {
    await sql(`update APP.players set photo_path='${photo}' where id='${id(20)}'; set role service_role`);
    expect((await rows(`select APP.retire_group_player_photo('${id(20)}','${id(10)}','old.webp',now()) retired`))[0]).toEqual({ retired: false });
    await login(3);
    await sql(`select APP.set_group_archived('${id(10)}',true); reset role; set role service_role`);
    expect((await rows(`select APP.retire_group_player_photo('${id(20)}','${id(10)}','${photo}',now()) retired`))[0]).toEqual({ retired: false });
  });
  it("retires several old photos without treating its own cleanup as new activity", async () => {
    const secondPhoto = `${schema}/${id(10)}/${id(21)}/${id(90)}.webp`;
    await sql(`update APP.players set photo_path='${photo}' where id='${id(20)}'; update APP.players set photo_path='${secondPhoto}' where id='${id(21)}'`);
    const cutoff = ((await rows("select max(greatest(created_at,updated_at,photo_updated_at))::text cutoff from APP.players"))[0].cutoff as string);
    await sql("set role service_role");
    for (const [player, path] of [[20, photo], [21, secondPhoto]] as const) {
      expect((await rows(`select APP.retire_group_player_photo('${id(player)}','${id(10)}','${path}','${cutoff}') retired`))[0]).toEqual({ retired: true });
    }
  });
  it("blocks cross-owner media metadata and requires enrolled normal admins to use MFA", async () => {
    await login();
    await expect(sql(`update APP.players set photo_path='${schema}/${id(11)}/${id(21)}/${id(90)}.webp' where id='${id(20)}'`)).rejects.toThrow(/no pertenece/);
    await expect(sql(`update APP.organizations set image_path='${schema}/organizations/${id(11)}.webp' where id='${id(10)}'`)).rejects.toThrow(/no pertenece/);
    await sql(`reset role; insert into auth.mfa_factors values('${id(1)}','verified')`);
    await login();
    await expect(sql(`select APP.confirm_group_match_option('${id(40)}','${id(10)}','${id(50)}')`)).rejects.toThrow();
    await login(1, "aal2");
    await sql(`select APP.confirm_group_match_option('${id(40)}','${id(10)}','${id(50)}')`);
  });
  it("serializes fixture leases only in development and enforces ownership on heartbeat/release", async () => {
    await login();
    await expect(sql(`select APP.acquire_e2e_fixture_lease('${id(80)}')`)).rejects.toThrow();
    await sql("reset role; set role service_role");
    if (schema === "app_prod") {
      await expect(sql(`select APP.acquire_e2e_fixture_lease('${id(80)}')`)).rejects.toThrow(/solo esta disponible/);
      return;
    }
    expect((await rows(`select APP.acquire_e2e_fixture_lease('${id(80)}') acquired`))[0]).toEqual({ acquired: true });
    expect((await rows(`select APP.acquire_e2e_fixture_lease('${id(81)}') acquired`))[0]).toEqual({ acquired: false });
    expect((await rows(`select APP.heartbeat_e2e_fixture_lease('${id(81)}') renewed`))[0]).toEqual({ renewed: false });
    await sql(`select APP.release_e2e_fixture_lease('${id(81)}')`);
    expect((await rows(`select APP.heartbeat_e2e_fixture_lease('${id(80)}') renewed`))[0]).toEqual({ renewed: true });
    await sql(`select APP.release_e2e_fixture_lease('${id(80)}')`);
    expect((await rows(`select APP.acquire_e2e_fixture_lease('${id(81)}') acquired`))[0]).toEqual({ acquired: true });
    await sql("reset role; update APP_PRIVATE.e2e_fixture_lease set expires_at=now()-interval '1 minute'; set role service_role");
    expect((await rows(`select APP.heartbeat_e2e_fixture_lease('${id(81)}') renewed`))[0]).toEqual({ renewed: false });
    expect((await rows(`select APP.acquire_e2e_fixture_lease('${id(80)}') acquired`))[0]).toEqual({ acquired: true });
  });
  it("keeps rate limits atomic and private, and retries claimed cleanup after failure", async () => {
    await login();
    await expect(sql(`select APP.consume_shared_rate_limit('${"a".repeat(64)}',2,10000)`)).rejects.toThrow();
    await expect(sql("select * from APP_PRIVATE.shared_rate_limits")).rejects.toThrow();
    await sql("reset role; set role service_role");
    for (const expected of [true, true, false]) expect((await rows(`select APP.consume_shared_rate_limit('${"a".repeat(64)}',2,10000) value`))[0].value).toMatchObject({ allowed: expected });
    await sql("reset role; update APP_PRIVATE.shared_rate_limits set expires_at=now()-interval '1 minute'; set role service_role");
    expect((await rows(`select APP.consume_shared_rate_limit('${"a".repeat(64)}',2,10000) value`))[0].value).toMatchObject({ allowed: true, remaining: 1 });
    await expect(sql("select * from APP_PRIVATE.shared_rate_limits")).rejects.toThrow();
    await sql(`select APP.enqueue_media_cleanup('${bucket}','${photo}')`);
    const job = ((await rows("select APP.claim_media_cleanup() jobs"))[0].jobs as Array<{ id: string; leaseToken: string }>)[0];
    await sql(`select APP.complete_media_cleanup('${job.id}','${job.leaseToken}','storage unavailable'); reset role; update APP_PRIVATE.media_cleanup_jobs set available_at=now()-interval '1 minute'; set role service_role`);
    expect(((await rows("select APP.claim_media_cleanup() jobs"))[0].jobs as unknown[])).toHaveLength(1);
  });
});
