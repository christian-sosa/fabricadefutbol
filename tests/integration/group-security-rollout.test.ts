import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { executePrivateSql, privateSqlAvailable } from "../helpers/private-sql";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe.skipIf(!privateSqlAvailable("supabase/generated/schema.app_prod.sql")).each(["app_dev", "app_prod"])("%s snapshot/draft/photo rollout security", (schema) => {
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
      grant select on storage.objects to anon,authenticated; grant insert,update,delete on storage.objects to authenticated;`);
    for (const file of [`schema.${schema}.sql`, `policies.${schema}.sql`, "policies.storage.sql"]) {
      const source = readFileSync(`supabase/generated/${file}`, "utf8").replace("create extension if not exists pgcrypto;", "");
      await executePrivateSql(db, source, file);
      await executePrivateSql(db, source, file);
    }
  }, 30_000);
  afterAll(async () => { await db?.close(); });
  beforeEach(async () => {
    await sql(`reset role; truncate APP.organizations cascade; truncate APP.admins cascade; truncate auth.users cascade;
      truncate auth.mfa_factors; truncate APP.super_admin_emails; truncate APP_PRIVATE.media_cleanup_jobs; truncate APP_PRIVATE.shared_rate_limits; truncate storage.objects; update APP_PRIVATE.photo_upload_settings set enforce_reservations=false where id;
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
  const payload = {summary:{name:"Snapshot"},standings:[],matchHistory:[]};
  const revision = async () => Number((await rows(`select sporting_revision from APP.organizations where id='${id(10)}'`))[0].sporting_revision);
  const writeSnapshot = async (expected: number) => (await rows(`select APP.write_group_public_snapshot('${id(10)}',${expected},'${JSON.stringify(payload)}') result`))[0].result;
  const activate = async () => { await sql('reset role; select APP_PRIVATE.activate_group_security_controls()'); await login(); };
  const reserve = async (revisionId: number, playerId=20) => (await rows(`select APP.reserve_group_player_photo('${id(10)}','${id(playerId)}','${id(revisionId)}') result`))[0].result as {path:string;reservation_id:string;expires_at:string};
  const upload = async (reservation: {path:string}) => sql(`insert into storage.objects(bucket_id,name,owner) values('${bucket}','${reservation.path}','${id(1)}')`);
  const cancel = async (reservation: {reservation_id:string}) => rows(`select APP.cancel_group_player_photo('${id(10)}','${id(20)}','${reservation.reservation_id}') result`);
  const finalize = async (reservation: {reservation_id:string}) => (await rows(`select APP.finalize_group_player_photo('${id(10)}','${id(20)}','${reservation.reservation_id}') result`))[0].result as {path:string;updated_at:string;previous_path:string|null};

  it('rejects stale snapshot writes after every public source changes', async () => {
    await login();
    for (const mutation of [
      `update APP.players set full_name=full_name||'x' where id='${id(20)}'`,
      `update APP.matches set location='Cancha nueva' where id='${id(40)}'`,
      `update APP.match_players set is_substitute=false where player_id='${id(20)}'`,
      `update APP.team_options set rating_diff=rating_diff+1 where id='${id(50)}'`,
      `update APP.team_option_players set team='B' where player_id='${id(20)}'`,
      `insert into APP.match_guests(match_id,guest_name,guest_rating) values('${id(40)}','Visita',5)`
    ]) {
      const before = await revision();
      expect(await writeSnapshot(before)).toBe(true);
      await sql(mutation);
      // A no-op write is deliberately not a source mutation.
      if ((await revision())===before) continue;
      expect(await rows(`select organization_id from APP.organization_public_snapshots`)).toEqual([]);
      expect(await writeSnapshot(before)).toBe(false);
      expect(await writeSnapshot(await revision())).toBe(true);
    }
    await expect(sql(`insert into APP.organization_public_snapshots(organization_id) values('${id(10)}')`)).rejects.toThrow(/permission denied/);
    await expect(sql(`update APP.organizations set sporting_revision=0 where id='${id(10)}'`)).rejects.toThrow(/permission denied/);
    await login(2);
    await expect(writeSnapshot(await revision())).rejects.toThrow(/No autorizado/);
  });
  it('unlisted groups remain readable by public slug', async () => {
    await login(); await sql(`update APP.organizations set is_listed=false where id='${id(10)}'`);
    await sql("reset role; select set_config('test.uid','',false); set role anon");
    expect(await rows(`select slug,is_public,is_listed from APP.organizations where slug='one'`)).toEqual([{slug:'one',is_public:true,is_listed:false}]);
  });
  it('invalidates cached goals and assists on match_player_stats insert, update and delete', async () => {
    await login();
    for (const mutation of [
      `insert into APP.match_player_stats(id,match_id,player_id,goals,assists) values('${id(80)}','${id(40)}','${id(20)}',1,0)`,
      `update APP.match_player_stats set goals=2,assists=1 where id='${id(80)}'`,
      `delete from APP.match_player_stats where id='${id(80)}'`
    ]) {
      const before=await revision();expect(await writeSnapshot(before)).toBe(true);
      await sql(mutation);
      expect(await revision()).toBeGreaterThan(before);
      expect(await rows('select organization_id from APP.organization_public_snapshots')).toEqual([]);
      expect(await writeSnapshot(before)).toBe(false);
      expect(await writeSnapshot(await revision())).toBe(true);
    }
  });
  const draftInput = () => ({scheduledAt:'2026-10-01T20:00:00Z',modality:'5v5',location:'Cancha',selectedPlayerIds:Array.from({length:9},(_,n)=>id(20+n)),
    invitedGuests:[{key:'visitor',name:'Visita',rating:5}],substituteAssignments:[],goalkeeperPlayerIds:[id(20),id(25)],teamALabel:'Azul',teamBLabel:'Rojo',teamCreationMode:'manual',
    options:[{teamA:Array.from({length:5},(_,n)=>({id:`player:${id(20+n)}`})),teamB:[...Array.from({length:4},(_,n)=>({id:`player:${id(25+n)}`})),{id:'guest:visitor'}],ratingSumA:25,ratingSumB:25,ratingDiff:0}]});
  const createDraft = async (request: number,input=draftInput()) => (await rows(`select APP.create_group_match_draft('${id(10)}','${id(request)}','${JSON.stringify(input)}') result`))[0].result;
  it('creates the complete manual draft atomically and reuses the stable request after finishing', async () => {
    await login();
    expect(await createDraft(70)).toEqual({match_id:id(70),result_version:2,reused:false});
    expect(await rows(`select status from APP.matches where id='${id(70)}'`)).toEqual([{status:'confirmed'}]);
    expect(await rows(`select id from APP.match_guests where match_id='${id(70)}'`)).toHaveLength(1);
    await sql(`select APP.save_group_match_result('${id(70)}','${id(10)}',2,'{"scoreA":1,"scoreB":0}')`);
    expect(await createDraft(70)).toEqual({match_id:id(70),result_version:3,reused:true});
    await expect(createDraft(70,{...draftInput(),location:'Otra cancha'})).rejects.toThrow(/otros datos/);
  });
  it('rolls back a late invalid draft option and rejects foreign players before creating anything', async () => {
    await login(); const input=draftInput(); input.options[0].teamB[0].id=`player:${id(20)}`;
    await expect(createDraft(71,input)).rejects.toThrow(/duplicados/);
    expect(await rows(`select id from APP.matches where id='${id(71)}'`)).toEqual([]);
    expect(await rows(`select id from APP.match_guests where match_id='${id(71)}'`)).toEqual([]);
    await sql(`reset role; insert into APP.players(id,organization_id,full_name,initial_rank) values('${id(60)}','${id(11)}','Foreign',1)`); await login();
    await expect(createDraft(72,{...draftInput(),selectedPlayerIds:[id(60),...draftInput().selectedPlayerIds.slice(1)],goalkeeperPlayerIds:[id(60),id(25)]})).rejects.toThrow(/activos del grupo/);
  });
  it('keeps legacy frontend writes during additive rollout and enforces exact reservations only after activation', async () => {
    await login(); await sql(`insert into storage.objects(bucket_id,name,owner) values('${bucket}','${photo}','${id(1)}')`);
    await activate();
    await expect(sql(`insert into storage.objects(bucket_id,name,owner) values('${bucket}','${schema}/${id(10)}/${id(20)}/${id(91)}.webp','${id(1)}')`)).rejects.toThrow(/row-level security/);
    await expect(sql(`update APP.players set photo_path='${photo}' where id='${id(20)}'`)).rejects.toThrow(/reserva/);
    await expect(sql(`insert into APP.player_photo_upload_events(uploader_id,uploader_role,target_type,target_player_id) values('${id(1)}','organization_admin','organization_player','${id(20)}')`)).rejects.toThrow(/cuota/);
  });
  it('reserves quota atomically, frees cancellations without upload and keeps accepted-upload consumption', async () => {
    await activate(); const first=await reserve(91),second=await reserve(92);
    await expect(reserve(93)).rejects.toThrow(/2 fotos/);
    await cancel(first); const third=await reserve(93);
    await upload(second); await cancel(second);
    await expect(reserve(94)).rejects.toThrow(/2 fotos/);
    await cancel(third); const fourth=await reserve(94); await upload(fourth);
    expect(await rows(`update storage.objects set updated_at=clock_timestamp() where name='${fourth.path}' returning name`)).toEqual([]);
    await cancel(fourth); await expect(reserve(95)).rejects.toThrow(/2 fotos/);
    expect(await rows(`select count(*)::int count from APP.player_photo_upload_events where target_player_id='${id(20)}'`)).toEqual([{count:2}]);
    await sql('reset role');
    expect(await rows('select count(*)::int count from APP_PRIVATE.media_cleanup_jobs where completed_at is null')).toEqual([{count:4}]);
  });
  it('finalizes once with metadata CAS and protects the linked photo from cancellation/cleanup', async () => {
    await activate(); const first=await reserve(91),second=await reserve(92); await upload(first); await upload(second);
    const result=await finalize(first); expect(result).toMatchObject({path:first.path,previous_path:null});
    expect(await finalize(first)).toEqual(result);
    await expect(finalize(second)).rejects.toThrow(/foto cambio/);
    expect(await cancel(first)).toEqual([{result:false}]);
    await cancel(second);
    expect(await rows(`select photo_path from APP.players where id='${id(20)}'`)).toEqual([{photo_path:first.path}]);
    await sql('reset role');
    expect(await rows(`select last_error,completed_at is not null completed from APP_PRIVATE.media_cleanup_jobs where object_path='${first.path}'`)).toEqual([{last_error:'linked',completed:true}]);
  });
  it('expires unuploaded reservations without consuming quota and denies expired uploads', async () => {
    await activate(); const first=await reserve(91),second=await reserve(92);
    await sql(`reset role; update APP_PRIVATE.photo_upload_reservations set expires_at=clock_timestamp()-interval '1 second' where id='${first.reservation_id}'`); await login();
    await expect(upload(first)).rejects.toThrow(/row-level security/);
    await reserve(93); await expect(reserve(94)).rejects.toThrow(/2 fotos/);
    await cancel(second);
  });
  it('keeps injury truth private while public data and legacy photo reads remain available', async () => {
    await sql(`update APP.players set is_injured=true where id='${id(20)}'`); await activate();
    expect(await rows(`select is_injured from APP.players where id='${id(20)}'`)).toEqual([{is_injured:true}]);
    await login(2); expect(await rows(`select is_injured from APP.players where id='${id(20)}'`)).toEqual([]);
    await sql("reset role; select set_config('test.uid','',false); set role anon");
    await expect(rows(`select is_injured from APP.players`)).rejects.toThrow(/permission denied/);
    expect(await rows(`select full_name,is_injured from APP.public_players where id='${id(20)}'`)).toEqual([{full_name:'Player 0',is_injured:false}]);
    expect(await rows(`select public.can_read_player_photo_object('${schema}/${id(10)}/${id(20)}.webp') result`)).toEqual([{result:true}]);
  });
  it('allows trusted service copies and platform metadata maintenance without granting user overwrites', async () => {
    await activate();
    await sql(`reset role; grant insert,update,select on storage.objects to service_role; set role service_role;
      insert into storage.objects(bucket_id,name,owner) values('${bucket}','${photo}','${id(1)}');
      update storage.objects set updated_at=clock_timestamp() where name='${photo}';`);
    await login();
    expect(await rows(`update storage.objects set updated_at=clock_timestamp() where name='${photo}' returning name`)).toEqual([]);
    const reserved=await reserve(91); await upload(reserved);
    await sql(`reset role; set role service_role; update storage.objects set updated_at=clock_timestamp() where name='${reserved.path}'`);
    await login(); expect((await finalize(reserved)).path).toBe(reserved.path);
    expect(await rows('select count(*)::int count from APP.player_photo_upload_events')).toEqual([{count:1}]);
  });
  it('sanitizes injury flags in raw snapshot RPC payloads and preserves public match cards', async () => {
    await activate();
    await sql(`select APP.confirm_group_match_option('${id(40)}','${id(10)}','${id(50)}');
      select APP.write_group_public_snapshot('${id(10)}',(select sporting_revision from APP.organizations where id='${id(10)}'),'{"summary":{"nested":{"is_injured":true}},"standings":[{"isInjured":true,"isAbsent":false}],"matchHistory":[]}');`);
    await sql("reset role; select set_config('test.uid','',false); set role anon");
    expect(await rows('select summary,standings from APP.organization_public_snapshots')).toEqual([{summary:{nested:{is_injured:false}},standings:[{isInjured:false}]}]);
    expect(await rows('select team_a_players,team_b_players from APP.public_match_cards')).toHaveLength(1);
  });
  it('hides inactive photo objects from public readers and preserves own-admin previews', async () => {
    await sql(`insert into storage.objects(bucket_id,name,owner) values('${bucket}','${photo}','${id(1)}');
      update APP.organizations set is_listed=false where id='${id(10)}';`);
    await activate();
    const access=()=>rows(`select public.can_read_player_photo_object('${photo}') allowed`);
    await sql("reset role;select set_config('test.uid','',false);set role anon");
    expect(await access()).toEqual([{allowed:true}]);
    expect(await rows(`select name from storage.objects where name='${photo}'`)).toEqual([{name:photo}]);
    await sql(`reset role;update APP.players set active=false where id='${id(20)}';set role anon`);
    expect(await access()).toEqual([{allowed:false}]);
    expect(await rows(`select name from storage.objects where name='${photo}'`)).toEqual([]);
    await login(2);expect(await access()).toEqual([{allowed:false}]);
    expect(await rows(`select name from storage.objects where name='${photo}'`)).toEqual([]);
    await login();expect(await access()).toEqual([{allowed:true}]);
    expect(await rows(`select name from storage.objects where name='${photo}'`)).toEqual([{name:photo}]);
    await sql(`reset role;update APP.players set active=true where id='${id(20)}';update APP.organizations set archived_at=clock_timestamp() where id='${id(10)}';select set_config('test.uid','',false);set role anon`);
    expect(await access()).toEqual([{allowed:false}]);
    expect(await rows(`select name from storage.objects where name='${photo}'`)).toEqual([]);
    await login(3,'aal2');expect(await access()).toEqual([{allowed:true}]);
  });
});
