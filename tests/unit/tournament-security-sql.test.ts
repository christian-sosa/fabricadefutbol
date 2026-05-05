import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const policiesSqlPath = path.join(root, "supabase", "policies.sql");
const hasPoliciesSql = existsSync(policiesSqlPath);
const policiesSql = hasPoliciesSql ? readFileSync(policiesSqlPath, "utf8") : "";
const describeSupabaseSql = hasPoliciesSql ? describe : describe.skip;

describeSupabaseSql("tournament security sql", () => {
  it("bloquea altas directas de ligas a usuarios que no son super admin", () => {
    expect(policiesSql).toMatch(
      /create policy leagues_insert_authenticated[\s\S]*with check \([\s\S]*created_by = auth\.uid\(\)[\s\S]*and public\.is_super_admin\(\)[\s\S]*\);/
    );
  });

  it("bloquea cambios directos de planteles en competencias cerradas", () => {
    expect(policiesSql).toMatch(
      /create policy competition_teams_admin_write[\s\S]*c\.status not in \('finished', 'archived'\)[\s\S]*with check[\s\S]*c\.status not in \('finished', 'archived'\)/
    );
    expect(policiesSql).toMatch(
      /create policy competition_team_players_admin_write[\s\S]*c\.status not in \('finished', 'archived'\)[\s\S]*with check[\s\S]*c\.status not in \('finished', 'archived'\)/
    );
    expect(policiesSql).toMatch(
      /create policy competition_team_players_captain_write[\s\S]*public\.is_competition_team_captain\(competition_team_id\)[\s\S]*c\.status not in \('finished', 'archived'\)[\s\S]*with check[\s\S]*c\.status not in \('finished', 'archived'\)/
    );
  });
});
