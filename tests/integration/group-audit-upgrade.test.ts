import { existsSync,readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe,expect,it } from "vitest";
import { executePrivateSql } from "../helpers/private-sql";

const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
// The immutable previous release and deployment scripts are local private inputs,
// separate from the current private SQL bundle restored by normal CI.
describe.skipIf(!existsSync("tmp/migrations/baseline-schema.app_prod.sql"))("incremental private SQL release upgrade",()=>{
  it("preserves sporting data and old PROD uploads while only DEV is migrated, then activates both safely",async()=>{
    const db=new PGlite();
    const apply=async(file:string)=>executePrivateSql(db,readFileSync(file,"utf8").replace("create extension if not exists pgcrypto;",""),file);
    const rows=async(query:string)=>(await db.query<Record<string,unknown>>(query)).rows;
    const login=()=>db.exec(`reset role;select set_config('test.uid','${id(1)}',false);select set_config('test.aal','aal1',false);set role authenticated;`);
    try {
      await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
        create schema auth;create schema storage;
        create table auth.users(id uuid primary key,email text);create table auth.mfa_factors(user_id uuid,status text);
        create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
        create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',current_setting('test.aal',true))$$;
        create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
        create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,updated_at timestamptz,created_at timestamptz,owner uuid);
        alter table storage.objects enable row level security;
        grant usage on schema auth,storage to anon,authenticated,service_role;
        grant select on storage.objects to anon,authenticated;grant insert,update,delete on storage.objects to authenticated;
        insert into auth.users values('${id(1)}','owner@example.test');`);
      for(const schema of ["app_dev","app_prod"]){
        await apply(`tmp/migrations/baseline-schema.${schema}.sql`);
        await apply(`tmp/migrations/baseline-policies.${schema}.sql`);
        await db.exec(`insert into ${schema}.admins(id,display_name) values('${id(1)}','Owner');
          insert into ${schema}.organizations(id,name,slug,created_by) values('${id(10)}','Group','group','${id(1)}');
          insert into ${schema}.players(id,organization_id,full_name,initial_rank) values ${Array.from({length:10},(_,n)=>`('${id(20+n)}','${id(10)}','Player ${n}',${n+1})`).join(",")};
          insert into ${schema}.matches(id,organization_id,created_by,modality,scheduled_at) values('${id(40)}','${id(10)}','${id(1)}','5v5','2026-09-01');
          insert into ${schema}.team_options(id,match_id,option_number,rating_sum_a,rating_sum_b,rating_diff,created_by) values('${id(50)}','${id(40)}',1,5000,5000,0,'${id(1)}');
          insert into ${schema}.match_players(match_id,player_id) select '${id(40)}',id from ${schema}.players;
          insert into ${schema}.team_option_players(team_option_id,player_id,team) select '${id(50)}',id,case when initial_rank<=5 then 'A'::${schema}.team_side else 'B'::${schema}.team_side end from ${schema}.players;`);
        await login();
        await db.exec(`select ${schema}.confirm_group_match_option('${id(40)}','${id(10)}','${id(50)}');select ${schema}.save_group_match_result('${id(40)}','${id(10)}',1,'{"scoreA":1,"scoreB":0}');reset role;`);
        await db.exec(`insert into ${schema}.organization_public_snapshots(organization_id,standings) values('${id(10)}','[{"isInjured":true}]');`);
      }
      await apply("tmp/migrations/baseline-policies.storage.sql");
      const sporting=async(schema:string)=>({players:await rows(`select id,current_rating from ${schema}.players order by id`),
        ledger:await rows(`select * from ${schema}.rating_history order by id`),
        seasons:await rows(`select * from ${schema}.organization_season_player_ratings order by player_id`),
        matches:await rows(`select id,result_version,lineup_snapshot,status from ${schema}.matches order by id`)});
      const beforeDev=await sporting("app_dev"),beforeProd=await sporting("app_prod");
      await apply("tmp/migrations/dev-audit-additive.sql");
      await login();
      for(const [schema,bucket] of [["app_dev","player-photos-dev"],["app_prod","player-photos"]]){
        await db.exec(`insert into storage.objects(bucket_id,name,owner) values('${bucket}','${schema}/${id(10)}/${id(20)}/${id(90)}.webp','${id(1)}')`);
      }
      await expect(db.exec(`insert into storage.objects(bucket_id,name,owner) values('player-photos','app_dev/${id(10)}/${id(20)}/${id(91)}.webp','${id(1)}')`)).rejects.toMatchObject({code:"42501"});
      await db.exec("reset role");
      expect(await sporting("app_dev")).toEqual(beforeDev);expect(await sporting("app_prod")).toEqual(beforeProd);
      await apply("tmp/migrations/dev-audit-additive.sql");
      await apply("tmp/migrations/prod-audit-additive.sql");
      await apply("tmp/migrations/prod-audit-additive.sql");
      expect(await sporting("app_dev")).toEqual(beforeDev);expect(await sporting("app_prod")).toEqual(beforeProd);
      for(const [label,schema,bucket] of [["dev","app_dev","player-photos-dev"],["prod","app_prod","player-photos"]]){
        await apply(`tmp/migrations/${label}-audit-activation.sql`);
        expect(await rows(`select * from ${schema}.organization_public_snapshots`)).toEqual([]);
        await login();
        await expect(db.exec(`insert into storage.objects(bucket_id,name,owner) values('${bucket}','${schema}/${id(10)}/${id(20)}/${id(92)}.webp','${id(1)}')`)).rejects.toMatchObject({code:"42501"});
        const reservation=(await rows(`select ${schema}.reserve_group_player_photo('${id(10)}','${id(20)}','${id(93)}') result`))[0].result as {path:string;reservation_id:string};
        await db.exec(`insert into storage.objects(bucket_id,name,owner) values('${bucket}','${reservation.path}','${id(1)}');select ${schema}.finalize_group_player_photo('${id(10)}','${id(20)}','${reservation.reservation_id}');reset role;`);
      }
      expect(await sporting("app_dev")).toEqual(beforeDev);expect(await sporting("app_prod")).toEqual(beforeProd);
    } finally {await db.close();}
  },60_000);
});
