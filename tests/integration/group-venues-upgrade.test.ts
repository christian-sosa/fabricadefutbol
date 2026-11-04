import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { syntheticBootstrap } from "../../scripts/lib/postgres-concurrency.mjs";
import { buildSchemaSources } from "../../scripts/lib/schema-sql.mjs";
import { readUpgradeSources } from "../../scripts/lib/sql-upgrade-artifact.mjs";
import { executePrivateSql, privateSqlAvailable } from "../helpers/private-sql";

const upgrades = privateSqlAvailable("supabase/upgrade-artifacts/venues-baseline/schema.sql") ? readUpgradeSources() : undefined;
const owner = "00000000-0000-4000-8000-000000000601";
const group = "00000000-0000-4000-8000-000000000602";
const match = "00000000-0000-4000-8000-000000000603";

describe.skipIf(!upgrades).each(["app_dev", "app_prod"])("%s recorded group venues upgrade", (schema) => {
  it("preserves a legacy match and allows a new group venue after upgrading", async () => {
    const db = new PGlite();
    try {
      await db.exec(syntheticBootstrap);
      const baseline = Object.fromEntries(["schema.sql", "policies.sql", "group-match-workflow.sql"].map((name) => [name, upgrades![`venues-baseline/${name}`]]));
      for (const [name, source] of Object.entries(buildSchemaSources(baseline, schema))) {
        await executePrivateSql(db, source.replace("create extension if not exists pgcrypto;", ""), `venues previous release/${name}`);
      }
      await db.exec(`insert into auth.users values('${owner}','venue-owner@example.test');
        insert into ${schema}.admins(id,display_name) values('${owner}','Owner');
        insert into ${schema}.organizations(id,name,slug,created_by) values('${group}','Group','venues-group','${owner}');
        insert into ${schema}.matches(id,organization_id,created_by,modality,scheduled_at,location)
        values('${match}','${group}','${owner}','5v5','2026-09-01','Ubicación original');`);
      const matchRows = async () => (await db.query(`select to_jsonb(m) - 'venue_id' as match from ${schema}.matches m`)).rows;
      const previous = await matchRows();
      for (const attempt of [1, 2]) {
        for (const suffix of ["", "-permissions"]) {
          const filename = `venues-migrations/${schema}${suffix}.sql`;
          await executePrivateSql(db, upgrades![filename], `recorded ${filename}/${attempt}`);
        }
        expect(await matchRows()).toEqual(previous);
      }
      await db.exec(`select set_config('test.uid','${owner}',false); set role authenticated;`);
      const { rows: [venue] } = await db.query<{ id: string }>(`insert into ${schema}.organization_venues(organization_id,name)
        values($1,'Cancha del grupo') returning id`, [group]);
      await db.query(`update ${schema}.matches set venue_id=$1 where id=$2`, [venue.id, match]);
      expect((await db.query(`select venue_id,location from ${schema}.matches where id=$1`, [match])).rows)
        .toEqual([{ venue_id: venue.id, location: "Ubicación original" }]);
    } finally {
      await db.close();
    }
  }, 30_000);
});
