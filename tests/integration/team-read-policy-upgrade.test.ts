import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { executePrivateSql, privateSqlAvailable } from "../helpers/private-sql";
import { readUpgradeSources } from "../../scripts/lib/sql-upgrade-artifact.mjs";
import { buildSchemaSources } from "../../scripts/lib/schema-sql.mjs";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const upgrades = privateSqlAvailable("supabase/upgrade-artifacts/team-read-baseline/schema.sql") ? readUpgradeSources() : undefined;

// Observable contract: the exact incremental migration preserves stored results,
// role-visible teams and authorized draft writes. Real regressions include a
// dropped command policy, widened cross-group access or public draft disclosure.
describe.skipIf(!upgrades).each(["app_dev", "app_prod"])("%s recorded team read policy upgrade", (schema) => {
  it("preserves sporting rows and read authorization on repeated migration, with unchanged draft write boundaries", async () => {
    const db = new PGlite();
    const sql = (query: string) => db.exec(query.replaceAll("APP", schema));
    const rows = async (query: string) => (await db.query<Record<string, unknown>>(query.replaceAll("APP", schema))).rows;
    const login = (user: number | null, aal = "aal1") => sql(`reset role;
      select set_config('test.uid','${user === null ? "" : id(user)}',false),set_config('test.aal','${aal}',false);
      set role ${user === null ? "anon" : "authenticated"};`);
    const visible = () => rows("select distinct team_option_id from APP.team_option_players order by team_option_id");
    const expectedOptions = (...options: number[]) => options.map((n) => ({ team_option_id: id(n) }));
    const assertReads = async () => {
      await login(null);
      expect(await visible()).toEqual(expectedOptions(51)); // Unlisted groups retain direct-link access.
      await login(1);
      expect(await visible()).toEqual(expectedOptions(50, 51, 55));
      await login(2);
      expect(await visible()).toEqual(expectedOptions(51, 52));
      await login(3);
      expect(await visible()).toEqual(expectedOptions(50, 51, 55));
      await login(4);
      expect(await visible()).toEqual(expectedOptions(51));
      await login(4, "aal2");
      expect(await visible()).toEqual(expectedOptions(50, 51, 52, 53, 55));
      await sql("reset role");
    };
    try {
      await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
        create schema auth; create schema storage;
        create table auth.users(id uuid primary key,email text); create table auth.mfa_factors(user_id uuid,status text);
        create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
        create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('aal',current_setting('test.aal',true)) $$;
        create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
        create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,updated_at timestamptz,created_at timestamptz,owner uuid);
        alter table storage.objects enable row level security;
        grant usage on schema auth,storage to anon,authenticated,service_role;
        grant select on storage.objects to anon,authenticated;`);
      const baseline = Object.fromEntries(["schema.sql", "policies.sql", "group-match-workflow.sql"].map((name) => [name, upgrades![`team-read-baseline/${name}`]]));
      for (const [name, source] of Object.entries(buildSchemaSources(baseline, schema))) {
        await executePrivateSql(db, source.replace("create extension if not exists pgcrypto;", ""), `team-read previous release/${name}`);
      }
      await sql(`insert into auth.users values ${[1, 2, 3, 4].map((n) => `('${id(n)}','user${n}@example.test')`).join(",")};
        insert into APP.admins(id,display_name) select id,email from auth.users;
        insert into auth.mfa_factors values('${id(4)}','verified');
        insert into APP.super_admin_emails(email) values('user4@example.test');
        insert into APP.organizations(id,name,slug,created_by,is_listed) values
          ('${id(10)}','Unlisted','unlisted','${id(1)}',false),
          ('${id(11)}','Other','other','${id(2)}',true),
          ('${id(12)}','Archived','archived','${id(2)}',true);
        insert into APP.organization_admins(organization_id,admin_id) values('${id(10)}','${id(3)}');`);
      for (let group = 0; group < 3; group++) {
        await sql(`insert into APP.players(id,organization_id,full_name,initial_rank) values ${Array.from({ length: 10 }, (_, n) => `('${id(100 + group * 100 + n)}','${id(10 + group)}','Player ${group}-${n}',${n + 1})`).join(",")}`);
      }
      for (let match = 0; match < 4; match++) {
        const group = match < 2 ? 10 : match + 9;
        await sql(`insert into APP.matches(id,organization_id,created_by,modality,scheduled_at)
          values('${id(40 + match)}','${id(group)}','${id(group === 10 ? 1 : 2)}','5v5','2026-09-01');
          insert into APP.team_options(id,match_id,option_number,rating_sum_a,rating_sum_b,rating_diff,created_by)
          values('${id(50 + match)}','${id(40 + match)}',1,5000,5000,0,'${id(group === 10 ? 1 : 2)}');
          insert into APP.match_players(match_id,player_id) select '${id(40 + match)}',id from APP.players where organization_id='${id(group)}';
          insert into APP.team_option_players(team_option_id,player_id,team)
          select '${id(50 + match)}',id,case when initial_rank<=5 then 'A'::APP.team_side else 'B'::APP.team_side end from APP.players where organization_id='${id(group)}';`);
      }
      await sql(`insert into APP.team_options(id,match_id,option_number,rating_sum_a,rating_sum_b,rating_diff,created_by)
        values('${id(55)}','${id(41)}',2,5000,5000,0,'${id(1)}');
        insert into APP.team_option_players(team_option_id,player_id,team)
        select '${id(55)}',id,case when initial_rank<=5 then 'A'::APP.team_side else 'B'::APP.team_side end from APP.players where organization_id='${id(10)}';`);
      await login(1);
      await sql(`select APP.confirm_group_match_option('${id(41)}','${id(10)}','${id(51)}');
        select APP.save_group_match_result('${id(41)}','${id(10)}',1,'{"scoreA":2,"scoreB":1}');`);
      await login(2);
      await sql(`select APP.confirm_group_match_option('${id(43)}','${id(12)}','${id(53)}'); reset role;
        update APP.organizations set archived_at=clock_timestamp() where id='${id(12)}';`);
      await assertReads();
      const policies = () => rows(`select policyname,permissive,roles,cmd,qual,with_check from pg_policies
        where schemaname='APP' and tablename='team_option_players' order by policyname`);
      const baselinePolicies = await policies();
      const oldWritePolicy = baselinePolicies.find((policy) => policy.cmd === "ALL");
      const publicReadPolicy = baselinePolicies.find((policy) => policy.cmd === "SELECT");
      expect(oldWritePolicy).toMatchObject({ policyname: "team_option_players_admin_write", roles: ["authenticated"] });
      expect(publicReadPolicy).toMatchObject({ policyname: "team_option_players_public_read", roles: ["anon", "authenticated"] });
      const expectedPolicies = [
        { ...oldWritePolicy, policyname: "team_option_players_admin_delete", cmd: "DELETE", with_check: null },
        { ...oldWritePolicy, policyname: "team_option_players_admin_insert", cmd: "INSERT", qual: null },
        { ...oldWritePolicy, policyname: "team_option_players_admin_update", cmd: "UPDATE" },
        publicReadPolicy
      ];
      const sporting = async () => Object.fromEntries(await Promise.all([
        "players", "matches", "team_options", "team_option_players", "match_result", "rating_history", "organization_seasons", "organization_season_player_ratings"
      ].map(async (table) => [table, await rows(`select to_jsonb(t) row from APP.${table} t order by to_jsonb(t)::text`)])));
      const before = await sporting();
      const migration = upgrades![`team-read-migrations/${schema}.sql`];
      for (let repeat = 0; repeat < 2; repeat++) {
        await executePrivateSql(db, migration, `recorded team-read migration/${schema}`);
        // A hash-valid no-op must fail here: the old ALL policy would continue
        // repeating authorization during SELECT despite preserving row results.
        expect(await policies()).toEqual(expectedPolicies);
        expect(await sporting()).toEqual(before);
        await assertReads();
      }
      await login(1);
      expect(await rows(`delete from APP.team_option_players where team_option_id='${id(50)}' and player_id='${id(100)}' returning player_id`)).toEqual([{ player_id: id(100) }]);
      await sql(`insert into APP.team_option_players(team_option_id,player_id,team) values('${id(50)}','${id(100)}','A')`);
      expect(await rows(`update APP.team_option_players set team='B' where team_option_id='${id(50)}' and player_id='${id(100)}' returning team`)).toEqual([{ team: "B" }]);
      await expect(sql(`insert into APP.team_option_players(team_option_id,player_id,team) values('${id(50)}','${id(200)}','B')`)).rejects.toMatchObject({ code: "42501" });
      await expect(sql(`update APP.team_option_players set team='B' where team_option_id='${id(51)}' and player_id='${id(100)}'`)).rejects.toMatchObject({ code: "42501" });
      await login(2);
      expect(await rows(`update APP.team_option_players set team='A' where team_option_id='${id(50)}' returning player_id`)).toEqual([]);
      expect(await rows(`delete from APP.team_option_players where team_option_id='${id(50)}' returning player_id`)).toEqual([]);
      await login(3);
      expect(await rows(`update APP.team_option_players set team='A' where team_option_id='${id(50)}' and player_id='${id(100)}' returning team`)).toEqual([{ team: "A" }]);
      await login(1);
      await sql(`delete from APP.organization_admins where organization_id='${id(10)}' and admin_id='${id(3)}'`);
      await login(3);
      expect(await visible()).toEqual(expectedOptions(51));
      expect(await rows(`update APP.team_option_players set team='B' where team_option_id='${id(50)}' returning player_id`)).toEqual([]);
      await expect(sql(`insert into APP.team_option_players(team_option_id,player_id,team) values('${id(50)}','${id(100)}','B')`)).rejects.toMatchObject({ code: "42501" });
      await login(4, "aal2");
      expect(await rows(`update APP.team_option_players set team='B' where team_option_id='${id(53)}' returning player_id`)).toEqual([]);
    } finally { await db.close(); }
  }, 30_000);
});
