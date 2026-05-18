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
  "club_callups",
  "club_callup_players",
  "club_callup_guests",
  "club_matches",
  "club_match_lineups",
  "club_match_payments",
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
    expect(policiesSql).toMatch(
      /grant select on table[\s\S]*public\.clubs[\s\S]*public\.club_public_snapshots[\s\S]*public\.club_site_settings[\s\S]*public\.club_products[\s\S]*to anon, authenticated;/
    );

    for (const table of privateClubTables) {
      expect(policiesSql).not.toMatch(new RegExp(`grant select on table[^;]*public\\.${table}[^;]*to anon`));
    }
  });

  it("protege lecturas crudas de club con membresia admin o sitio publico publicado y bloquea altas comunes", () => {
    expect(policiesSql).toContain("create or replace function public.is_club_admin");
    expect(policiesSql).toContain("create or replace function public.can_read_club");
    expect(policiesSql).toContain("public.is_club_admin(club_id)");
    expect(policiesSql).toContain("public.can_read_club(club_id)");
    expect(policiesSql).toMatch(
      /create or replace function public\.can_read_club\(club_id uuid\)[\s\S]*select public\.is_club_admin\(club_id\)[\s\S]*join public\.club_site_settings s on s\.club_id = c\.id[\s\S]*c\.status = 'active'[\s\S]*c\.is_public = true[\s\S]*s\.enabled = true[\s\S]*s\.published = true[\s\S]*;/
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
    expect(schemaSql).toContain("create or replace function public.enforce_club_admin_limit");
    expect(schemaSql).toContain("from public.club_admins ca");
    expect(schemaSql).toContain("where ca.club_id = new.club_id");
    expect(schemaSql).toContain("Cada club admite hasta 4 administradores activos.");
    expect(schemaSql).toContain("drop trigger if exists trg_club_admins_limit on public.club_admins;");
    expect(schemaSql).toContain("before insert or update of club_id on public.club_admins");
    expect(schemaSql).toContain("execute function public.enforce_club_admin_limit();");
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

  it("guarda modalidad en equipos y partidos de club con backfill 11v11", () => {
    expect(schemaSql).toMatch(/create table if not exists public\.club_teams[\s\S]*modality public\.match_modality not null default '11v11'/);
    expect(schemaSql).toMatch(/create table if not exists public\.club_matches[\s\S]*modality public\.match_modality not null default '11v11'/);
    expect(schemaSql).toContain("add column modality public.match_modality not null default '11v11'");
    expect(schemaSql).toContain("idx_club_matches_club_modality_played_at");
  });

  it("agrega finanzas privadas de cancha por partido y participante", () => {
    expect(schemaSql).toMatch(/create table if not exists public\.club_matches[\s\S]*field_cost_cents integer not null default 0/);
    expect(schemaSql).toMatch(/create table if not exists public\.club_match_payments[\s\S]*expected_cents integer not null default 0/);
    expect(schemaSql).toMatch(/create table if not exists public\.club_match_payments[\s\S]*paid_cents integer not null default 0/);
    expect(schemaSql).toContain("unique (match_id, lineup_id)");
    expect(schemaSql).toContain("check (paid_cents <= expected_cents)");
    expect(schemaSql).toContain("idx_club_match_payments_match_id");
    expect(policiesSql).toContain("create policy club_match_payments_admin_read");
    expect(policiesSql).toContain("create policy club_match_payments_admin_write");
    expect(policiesSql).toContain("where m.id = club_match_payments.match_id");
    expect(policiesSql).toContain("and public.is_club_admin(m.club_id)");
  });

  it("agrega convocatorias privadas de club sin mezclar grupos ni torneos", () => {
    expect(schemaSql).toMatch(/create table if not exists public\.club_callups[\s\S]*ideal_player_count integer not null default 14/);
    expect(schemaSql).toMatch(/create table if not exists public\.club_callups[\s\S]*max_player_count integer not null default 16/);
    expect(schemaSql).toMatch(/create table if not exists public\.club_callups[\s\S]*target_payment_count integer not null default 14/);
    expect(schemaSql).toMatch(/create table if not exists public\.club_callup_players[\s\S]*status text not null default 'confirmed'/);
    expect(schemaSql).toMatch(/create table if not exists public\.club_callup_guests[\s\S]*guest_name text not null/);
    expect(schemaSql).toContain("default_payment_cents integer");
    expect(schemaSql).toContain("idx_club_callups_club_scheduled_at");
    expect(schemaSql).toContain("unique (callup_id, club_player_id)");
    expect(schemaSql).toContain("idx_club_callup_guests_callup");
    expect(policiesSql).toContain("create policy club_callups_admin_read");
    expect(policiesSql).toContain("create policy club_callups_admin_write");
    expect(policiesSql).toContain("create policy club_callup_players_admin_read");
    expect(policiesSql).toContain("create policy club_callup_players_admin_write");
    expect(policiesSql).toContain("create policy club_callup_guests_admin_read");
    expect(policiesSql).toContain("create policy club_callup_guests_admin_write");
    expect(policiesSql).toContain("where c.id = club_callup_players.callup_id");
    expect(policiesSql).toContain("where c.id = club_callup_guests.callup_id");
    expect(schemaSql).not.toContain("organization_callups");
    expect(schemaSql).not.toContain("tournament_callups");
  });

  it("mantiene los agregados publicos dentro del snapshot", () => {
    expect(schemaSql).toContain("activity jsonb not null default '[]'::jsonb");
    expect(schemaSql).toContain("player_stats jsonb not null default '[]'::jsonb");
    expect(schemaSql).toContain("records jsonb not null default '{}'::jsonb");
    expect(schemaSql).toContain("available_modalities jsonb not null default '[]'::jsonb");
    expect(schemaSql).toContain("by_modality jsonb not null default '{}'::jsonb");
    expect(schemaSql).toContain("'totalMatches', 0");
    expect(schemaSql).not.toContain("create table if not exists public.club_events");
    expect(schemaSql).not.toContain("create view public.club_stats_summary");
  });
});
