import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const schemaSqlPath = path.join(root, "supabase", "schema.sql");
const policiesSqlPath = path.join(root, "supabase", "policies.sql");
const hasPoliciesSql = existsSync(schemaSqlPath) && existsSync(policiesSqlPath);
const schemaSql = hasPoliciesSql ? readFileSync(schemaSqlPath, "utf8") : "";
const policiesSql = hasPoliciesSql ? readFileSync(policiesSqlPath, "utf8") : "";
const describeSupabaseSql = hasPoliciesSql ? describe : describe.skip;

describeSupabaseSql("tournament security sql", () => {
  it("bloquea altas directas de ligas a usuarios que no son super admin", () => {
    expect(policiesSql).toMatch(
      /create policy leagues_insert_authenticated[\s\S]*with check \([\s\S]*created_by = auth\.uid\(\)[\s\S]*and public\.is_super_admin\(\)[\s\S]*\);/
    );
  });

  it("bloquea lectura publica de Torneos para anonimos y usuarios comunes", () => {
    expect(policiesSql).toMatch(
      /create or replace function public\.can_read_league\(league_id uuid\)[\s\S]*select public\.is_super_admin\(\)[\s\S]*and \([\s\S]*l\.status in \('active', 'finished'\)[\s\S]*or public\.is_league_admin\(league_id\)[\s\S]*\);/
    );
    expect(policiesSql).toMatch(
      /create or replace function public\.can_read_competition\(competition_id uuid\)[\s\S]*select public\.is_super_admin\(\)[\s\S]*and \([\s\S]*c\.status in \('active', 'finished'\)[\s\S]*or exists[\s\S]*public\.is_league_admin\(c\.league_id\)[\s\S]*ctc\.captain_id = auth\.uid\(\)[\s\S]*\);/
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

  it("refuerza en SQL el maximo de admins activos de liga", () => {
    expect(schemaSql).toContain("create or replace function public.enforce_league_admin_limit");
    expect(schemaSql).toContain("from public.league_admins la");
    expect(schemaSql).toContain("where la.league_id = new.league_id");
    expect(schemaSql).toContain("Cada liga admite hasta 4 administradores activos.");
    expect(schemaSql).toContain("drop trigger if exists trg_league_admins_limit on public.league_admins;");
    expect(schemaSql).toContain("before insert or update of league_id on public.league_admins");
    expect(schemaSql).toContain("execute function public.enforce_league_admin_limit();");
  });
});
