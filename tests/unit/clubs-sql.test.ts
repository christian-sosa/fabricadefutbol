import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const schemaSqlPath = path.join(root, "supabase", "schema.sql");
const policiesSqlPath = path.join(root, "supabase", "policies.sql");
const hasSupabaseSql = existsSync(schemaSqlPath) && existsSync(policiesSqlPath);
const schemaSql = hasSupabaseSql ? readFileSync(schemaSqlPath, "utf8") : "";
const policiesSql = hasSupabaseSql ? readFileSync(policiesSqlPath, "utf8") : "";
const describeSupabaseSql = hasSupabaseSql ? describe : describe.skip;

const privateClubTables = [
  "club_admins",
  "club_admin_invites",
  "club_competitions",
  "club_players",
  "club_teams",
  "club_team_players",
  "club_matches",
  "club_match_lineups",
  "club_match_player_stats"
] as const;

describeSupabaseSql("clubes sql", () => {
  it("crea el modelo nuevo separado de grupos y torneos", () => {
    for (const table of ["clubs", ...privateClubTables, "club_public_snapshots"]) {
      expect(schemaSql).toContain(`create table if not exists public.${table}`);
      expect(policiesSql).toContain(`alter table public.${table} enable row level security;`);
    }
  });

  it("mantiene tablas privadas de clubes fuera del grant anon directo", () => {
    expect(policiesSql).toContain("public.clubs, public.club_public_snapshots to anon, authenticated");

    for (const table of privateClubTables) {
      expect(policiesSql).not.toMatch(new RegExp(`grant select on table[^;]*public\\.${table}[^;]*to anon`));
    }
  });

  it("protege lecturas crudas de club con membresia admin y bloquea altas comunes", () => {
    expect(policiesSql).toContain("create or replace function public.is_club_admin");
    expect(policiesSql).toContain("create or replace function public.can_read_club");
    expect(policiesSql).toContain("public.is_club_admin(club_id)");
    expect(policiesSql).toContain("public.can_read_club(club_id)");
    expect(policiesSql).toMatch(
      /create or replace function public\.can_read_club\(club_id uuid\)[\s\S]*select public\.is_club_admin\(club_id\);/
    );
    expect(policiesSql).toMatch(
      /create policy clubs_insert_authenticated[\s\S]*with check \([\s\S]*created_by = auth\.uid\(\)[\s\S]*and public\.is_super_admin\(\)[\s\S]*\);/
    );
  });

  it("incluye limites de admins, equipos y seed no-op de La Quinta", () => {
    expect(schemaSql).toContain("Cada club admite hasta 5 equipos activos.");
    expect(policiesSql).toContain("create or replace function public.club_has_admin_slot");
    expect(policiesSql).toContain("select c.created_by");
    expect(policiesSql).toContain("c.created_by = club_admins.admin_id");
    expect(schemaSql).toContain("se omite seed de club La Quinta");
    expect(schemaSql).toContain("'La Quinta'");
  });

  it("agrega media privada y torneos del club para segmentar estadisticas", () => {
    expect(schemaSql).toContain("create table if not exists public.club_competitions");
    expect(schemaSql).toContain("club_competition_id uuid references public.club_competitions");
    expect(schemaSql).toContain("photo_path text");
    expect(schemaSql).toContain("logo_path text");
    expect(schemaSql).toContain("'Copa Premier'");
    expect(schemaSql).toContain("'LAFAB'");
    expect(schemaSql).toContain("'AMISTOSO'");
    expect(policiesSql).toContain("is_club_admin(p.club_id)");
    expect(policiesSql).toContain("scope_name = 'club-teams'");
  });

  it("mantiene los agregados publicos dentro del snapshot", () => {
    expect(schemaSql).toContain("activity jsonb not null default '[]'::jsonb");
    expect(schemaSql).toContain("player_stats jsonb not null default '[]'::jsonb");
    expect(schemaSql).toContain("records jsonb not null default '{}'::jsonb");
    expect(schemaSql).toContain("'totalMatches', 0");
    expect(schemaSql).not.toContain("create table if not exists public.club_events");
    expect(schemaSql).not.toContain("create view public.club_stats_summary");
  });
});
