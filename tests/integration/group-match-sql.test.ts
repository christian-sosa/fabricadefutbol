import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const sqlPath = path.join(process.cwd(), "supabase/group-match-workflow.sql");
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const org = id(1), admin = id(2), match = id(3), option = id(4);
const player = (n: number) => id(100 + n);
const assignments = [1, 2, 3, 4].map((n) => ({ participantId: `player:${player(n)}`, team: n < 3 ? "A" : "B" }));

// SQL remains an intentionally local operational source, as required by AGENTS.md.
describe.skipIf(!existsSync(sqlPath))("group match transactions (real PostgreSQL)", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.admin', true), '')::uuid $$;
      create type public.team_side as enum ('A', 'B');
      create type public.winner_team as enum ('A', 'B', 'DRAW');
      create type public.match_status as enum ('draft', 'confirmed', 'finished', 'cancelled');
      create table public.organizations (id uuid primary key, created_by uuid);
      create function public.is_org_admin(p_id uuid) returns boolean language sql stable as $$ select exists(select 1 from public.organizations where id = p_id and created_by = auth.uid()) $$;
      create table public.players (id uuid primary key, organization_id uuid references public.organizations, full_name text not null, current_rating numeric not null default 1000, active boolean default true);
      create table public.organization_seasons (id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations, label text, duration_months int, starts_at date, ends_at date, status text, created_by uuid, closed_at timestamptz);
      create unique index seasons_one_active on public.organization_seasons(organization_id) where status = 'active';
      create table public.organization_season_player_ratings (organization_id uuid references public.organizations, season_id uuid references public.organization_seasons, player_id uuid references public.players, current_rating numeric default 1000, unique(season_id, player_id));
      create table public.matches (id uuid primary key, organization_id uuid references public.organizations, status public.match_status, confirmed_option_id uuid, modality text default '5v5', scheduled_at timestamptz, team_a_label text, team_b_label text, season_id uuid references public.organization_seasons, finished_at timestamptz);
      create table public.team_options (id uuid primary key default gen_random_uuid(), match_id uuid references public.matches, is_confirmed boolean, option_number int, rating_sum_a numeric, rating_sum_b numeric, rating_diff numeric, created_by uuid);
      create table public.match_players (match_id uuid references public.matches, player_id uuid references public.players, unique(match_id, player_id));
      create table public.match_guests (id uuid primary key default gen_random_uuid(), match_id uuid references public.matches, guest_name text, guest_rating numeric);
      create table public.team_option_players (team_option_id uuid references public.team_options on delete cascade, player_id uuid references public.players, team public.team_side, unique(team_option_id, player_id));
      create table public.team_option_guests (team_option_id uuid references public.team_options on delete cascade, guest_id uuid references public.match_guests, team public.team_side, unique(team_option_id, guest_id));
      create table public.match_result (id uuid primary key default gen_random_uuid(), match_id uuid unique references public.matches, score_a int check(score_a >= 0), score_b int check(score_b >= 0), winner_team public.winner_team, mvp_player_id uuid references public.players, mvp_guest_id uuid references public.match_guests, mvp_display_name text, notes text, created_by uuid);
      create table public.rating_history (id uuid primary key default gen_random_uuid(), match_id uuid references public.matches, player_id uuid references public.players, season_id uuid references public.organization_seasons, rating_before numeric, rating_after numeric, delta numeric, season_rating_before numeric, season_rating_after numeric, season_delta numeric, reason text, unique(match_id, player_id, reason));
    `);
    await db.exec(readFileSync(sqlPath, "utf8"));
  }, 30_000);
  afterAll(async () => { await db?.close(); });
  beforeEach(async () => {
    await db.exec(`truncate public.organizations cascade; select set_config('test.admin', '${admin}', false);
      insert into public.organizations values ('${org}', '${admin}');
      insert into public.matches(id, organization_id, status, confirmed_option_id, scheduled_at) values ('${match}', '${org}', 'confirmed', '${option}', '2026-09-01T20:00:00Z');
      insert into public.team_options(id, match_id, is_confirmed, option_number) values ('${option}', '${match}', true, 1);`);
    for (let n = 1; n <= 5; n++) {
      await db.query("insert into public.players(id, organization_id, full_name) values ($1, $2, $3)", [player(n), org, `Jugador ${n}`]);
      if (n <= 4) await db.query("insert into public.team_option_players values ($1,$2,$3)", [option, player(n), n < 3 ? "A" : "B"]);
    }
  });
  async function save(input: object, version = 0, finish = true) {
    const result = await db.query<{ result: { first_finished: boolean; result_version: number; season_id: string } }>(
      "select public.save_group_match_result($1, $2, $3, $4::jsonb, $5) result", [match, org, version, JSON.stringify(input), finish]);
    return result.rows[0].result;
  }
  async function ratings() {
    return (await db.query<{ current_rating: string }>("select current_rating from public.players order by id")).rows.map((r) => Number(r.current_rating));
  }
  async function history() { return (await db.query("select player_id, delta, reason from public.rating_history order by player_id, reason")).rows; }
  async function seasonRatings() {
    return (await db.query("select season_id, player_id, current_rating from public.organization_season_player_ratings order by season_id, player_id")).rows;
  }

  it("saves result, registered MVP and season ratings together; correction emits no new finish", async () => {
    const first = await save({ scoreA: 2, scoreB: 1, mvpParticipantId: `player:${player(1)}` });
    expect(first).toMatchObject({ first_finished: true, result_version: 1 });
    expect(await ratings()).toEqual([1010, 1010, 990, 990, 1000]);
    expect((await db.query("select mvp_player_id, mvp_display_name from public.match_result")).rows[0]).toEqual({mvp_player_id: player(1), mvp_display_name: "Jugador 1"});
    expect((await db.query("select * from public.rating_history where reason='mvp_bonus'")).rows).toEqual([]);
    const corrected = await save({ scoreA: 0, scoreB: 1, mvpParticipantId: null }, 1);
    expect(corrected).toMatchObject({ first_finished: false, result_version: 2 });
    expect(await ratings()).toEqual([990, 990, 1010, 1010, 1000]);
    expect(await history()).toHaveLength(4);
  });
  it("rejects invalid MVP without reverting old ratings, result or history", async () => {
    await save({ scoreA: 1, scoreB: 0 });
    const before = await history();
    await expect(save({ scoreA: 9, scoreB: 0, mvpParticipantId: `player:${player(5)}` }, 1)).rejects.toThrow("MVP");
    expect(await ratings()).toEqual([1010, 1010, 990, 990, 1000]);
    expect(await history()).toEqual(before);
    expect((await db.query("select score_a from public.match_result")).rows[0]).toEqual({ score_a: 1 });
  });
  it("rolls back a failure after rating updates and guest inserts", async () => {
    await db.exec("alter table public.match_result add constraint test_fail_result check(score_a < 50)");
    try {
      await expect(save({ scoreA: 99, scoreB: 0, lineup: { assignments, newGuests: [{ name: "Visita", rating: 2, team: "A" }] } })).rejects.toThrow("test_fail_result");
      expect(await ratings()).toEqual([1000, 1000, 1000, 1000, 1000]);
      expect(await history()).toEqual([]);
      expect((await db.query("select * from public.match_guests")).rows).toEqual([]);
      expect((await db.query("select * from public.organization_seasons")).rows).toEqual([]);
    } finally { await db.exec("alter table public.match_result drop constraint test_fail_result"); }
  });
  it("preserves absences and handicap when correcting only notes", async () => {
    await save({ scoreA: 1, scoreB: 0, lineup: { assignments: assignments.map((a, i) => i === 1 ? { ...a, team: "OUT" } : a), absencePenaltyParticipantIds: [`player:${player(2)}`], handicapTeam: "A" } });
    const before = await history();
    expect(await ratings()).toEqual([1020, 980, 980, 980, 1000]);
    await save({ scoreA: 1, scoreB: 0, notes: "Cancha corregida" }, 1);
    expect(await ratings()).toEqual([1020, 980, 980, 980, 1000]);
    expect(await history()).toEqual(before);
    const snapshot = (await db.query<{ lineup_snapshot: Array<{ team: string; penalized: boolean }> }>("select lineup_snapshot from public.matches")).rows[0].lineup_snapshot;
    expect(snapshot.find((p) => p.team === "OUT")).toMatchObject({ penalized: true });
  });
  it("retains absent participants through a lineup-only edit, without changing ratings", async () => {
    await save({ lineup: { assignments: assignments.map((a, i) => i === 1 ? { ...a, team: "OUT" } : a), newPlayers: [{ playerId: player(5), team: "A" }], newGuests: [{ name: "Visita", rating: 0.5, team: "B" }] } }, 0, false);
    expect(await ratings()).toEqual([1000, 1000, 1000, 1000, 1000]);
    expect((await db.query("select * from public.match_result")).rows).toEqual([]);
    expect((await db.query<{ lineup_snapshot: unknown[] }>("select lineup_snapshot from public.matches")).rows[0].lineup_snapshot).toHaveLength(6);
    await save({ scoreA: 0, scoreB: 0 }, 1);
    expect(await history()).toHaveLength(4);
  });
  it("rejects stale saves and concurrent retries with the same version", async () => {
    const outcomes = await Promise.allSettled([save({ scoreA: 1, scoreB: 0 }), save({ scoreA: 0, scoreB: 2 })]);
    expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.find((o) => o.status === "rejected")).toMatchObject({ status: "rejected", reason: expect.objectContaining({ code: "40001" }) });
    expect(await history()).toHaveLength(4);
  });
  it("rejects replacements from another group and duplicate assignments", async () => {
    await db.query("update public.players set active = false where id = $1", [player(5)]);
    await expect(save({ scoreA: 1, scoreB: 0, lineup: { assignments, newPlayers: [{ playerId: player(5), team: "A" }] } })).rejects.toThrow("activo");
    await expect(save({ scoreA: 1, scoreB: 0, lineup: { assignments: [...assignments, assignments[0]] } })).rejects.toThrow("duplicados");
    expect(await history()).toEqual([]);
  });
  it("rejects handicap on the larger team and negative or fractional scores", async () => {
    await expect(save({ scoreA: 1, scoreB: 0, lineup: { assignments, handicapTeam: "A" } })).rejects.toThrow("menos jugadores");
    await expect(save({ scoreA: -1, scoreB: 0 })).rejects.toThrow("enteros no negativos");
    await expect(save({ scoreA: 1.5, scoreB: 0 })).rejects.toThrow("enteros no negativos");
  });
  it("records a new guest as symbolic MVP without changing any participant's points", async () => {
    await save({ scoreA: 1, scoreB: 0, mvpParticipantId: "newGuest:1", lineup: { assignments, newGuests: [{ clientId: "1", name: "Visita", rating: 2, team: "A" }] } });
    expect(await ratings()).toEqual([1010, 1010, 990, 990, 1000]);
    expect((await db.query("select mvp_display_name, mvp_player_id from public.match_result")).rows[0]).toEqual({ mvp_display_name: "Visita", mvp_player_id: null });
  });
  it("preserves the stored figure when reopened and changes or removes it without rewriting points", async () => {
    await save({ scoreA: 2, scoreB: 1, mvpParticipantId: `player:${player(1)}` });
    const beforeRatings = await ratings();
    const beforeSeasonRatings = await seasonRatings();
    const beforeHistory = (await db.query("select * from public.rating_history order by id")).rows;
    await save({ scoreA: 2, scoreB: 1, notes: "Revisado" }, 1);
    expect((await db.query("select mvp_player_id, mvp_display_name from public.match_result")).rows[0]).toEqual({mvp_player_id: player(1), mvp_display_name: "Jugador 1"});
    await save({ scoreA: 2, scoreB: 1, mvpParticipantId: `player:${player(3)}`, lineup: {assignments} }, 2);
    expect((await db.query("select mvp_player_id, mvp_display_name from public.match_result")).rows[0]).toEqual({mvp_player_id: player(3), mvp_display_name: "Jugador 3"});
    await save({ scoreA: 2, scoreB: 1, mvpParticipantId: null }, 3);
    expect((await db.query("select mvp_player_id, mvp_guest_id, mvp_display_name from public.match_result")).rows[0]).toEqual({mvp_player_id: null, mvp_guest_id: null, mvp_display_name: null});
    expect(await ratings()).toEqual(beforeRatings);
    expect(await seasonRatings()).toEqual(beforeSeasonRatings);
    expect((await db.query("select * from public.rating_history order by id")).rows).toEqual(beforeHistory);
  });
  it("changes the figure without recalculating an old capped absence after later sporting contributions", async () => {
    await db.query("update public.players set current_rating=10 where id=$1", [player(2)]);
    const lineup = { assignments: assignments.map((a, i) => i === 1 ? {...a, team: "OUT"} : a), absencePenaltyParticipantIds: [`player:${player(2)}`] };
    await save({ scoreA: 1, scoreB: 0, lineup, mvpParticipantId: `player:${player(1)}` });
    expect(await ratings()).toEqual([1010, 1, 990, 990, 1000]);
    // A later match can increase the absent player's accumulated and season points.
    await db.query("update public.players set current_rating=current_rating+10 where id=$1", [player(2)]);
    await db.query("update public.organization_season_player_ratings set current_rating=current_rating+10 where player_id=$1", [player(2)]);
    const beforeRatings = await ratings();
    const beforeSeasonRatings = await seasonRatings();
    const beforeHistory = (await db.query("select * from public.rating_history order by id")).rows;
    await save({ scoreA: 1, scoreB: 0, lineup, mvpParticipantId: `player:${player(3)}` }, 1);
    expect(await ratings()).toEqual(beforeRatings);
    expect(await seasonRatings()).toEqual(beforeSeasonRatings);
    expect((await db.query("select * from public.rating_history order by id")).rows).toEqual(beforeHistory);
  });
  it("closes an expired active season and preserves the stored match's local calendar date", async () => {
    await db.exec(`insert into public.organization_seasons(organization_id, label, starts_at, ends_at, status) values ('${org}', 'Temporada 2020', '2020-01-01', '2020-12-31', 'active');
      update public.matches set scheduled_at = '2025-01-01T01:00:00Z';`);
    const outcome = await save({ scoreA: 1, scoreB: 0 });
    const target = (await db.query<{ label: string; status: string }>("select label, status from public.organization_seasons where id = $1", [outcome.season_id])).rows[0];
    expect(target).toEqual({ label: "Temporada 2025", status: "closed" });
    expect((await db.query("select * from public.organization_seasons where status = 'active'")).rows).toHaveLength(1);
    const old = (await db.query("select status from public.organization_seasons where label = 'Temporada 2020'")).rows[0];
    expect(old).toEqual({ status: "closed" });
  });
  it("prevents reconfirming a finished match or editing its lineup without its result", async () => {
    await save({ scoreA: 1, scoreB: 0 });
    await expect(db.query("select public.confirm_group_match_option($1,$2,$3)", [match, org, option])).rejects.toThrow("borrador");
    await expect(save({ lineup: { assignments } }, 1, false)).rejects.toThrow("antes de cargar");
    expect((await db.query("select status from public.matches")).rows[0]).toEqual({ status: "finished" });
  });
  it("rebuilds legacy actas and infers historical handicap without changing ratings", async () => {
    await save({ scoreA: 1, scoreB: 0, lineup: { assignments: assignments.map((a, i) => i === 1 ? { ...a, team: "OUT" } : a), absencePenaltyParticipantIds: [`player:${player(2)}`], handicapTeam: "A" } });
    await db.exec("update public.matches set lineup_snapshot = '[]'::jsonb; update public.match_result set handicap_team = null");
    await db.exec(readFileSync(sqlPath, "utf8"));
    expect((await db.query("select handicap_team from public.match_result")).rows[0]).toEqual({ handicap_team: "A" });
    const snapshot = (await db.query<{ lineup_snapshot: Array<{ participantId: string; penalized: boolean }> }>("select lineup_snapshot from public.matches")).rows[0].lineup_snapshot;
    expect(snapshot.find((p) => p.participantId === `player:${player(2)}`)).toMatchObject({ penalized: true });
    await save({ scoreA: 1, scoreB: 0, notes: "Correccion posterior" }, 1);
    expect(await ratings()).toEqual([1020, 980, 980, 980, 1000]);
  });
  it("regenerates all options atomically and preserves the previous options on validation error", async () => {
    await db.exec("update public.matches set status = 'draft'");
    for (let n = 6; n <= 10; n++) await db.query("insert into public.players(id, organization_id, full_name) values ($1,$2,$3)", [player(n), org, `Jugador ${n}`]);
    for (let n = 1; n <= 10; n++) await db.query("insert into public.match_players values ($1,$2)", [match, player(n)]);
    await db.query("update public.matches set goalkeeper_player_ids = $1", [[player(1), player(6)]]);
    const optionInput = { teamA: [1,2,3,4,5].map((n) => ({ id: `player:${player(n)}` })), teamB: [6,7,8,9,10].map((n) => ({ id: `player:${player(n)}` })), ratingSumA: 0, ratingSumB: 0, ratingDiff: 0 };
    await db.query("select public.replace_group_match_options($1,$2,0,$3::jsonb)", [match, org, JSON.stringify([optionInput])]);
    const before = (await db.query("select * from public.team_options")).rows;
    const invalid = { ...optionInput, teamA: [1,2,3,4,6].map((n) => ({ id: `player:${player(n)}` })), teamB: [5,7,8,9,10].map((n) => ({ id: `player:${player(n)}` })) };
    await expect(db.query("select public.replace_group_match_options($1,$2,1,$3::jsonb)", [match, org, JSON.stringify([invalid])])).rejects.toThrow("arqueros");
    expect((await db.query("select * from public.team_options")).rows).toEqual(before);
    expect((await db.query("select * from public.team_option_players")).rows).toHaveLength(10);
    const selected = before[0] as { id: string };
    await db.query("select public.confirm_group_match_option($1,$2,$3)", [match, org, selected.id]);
    expect((await db.query("select status from public.matches")).rows[0]).toEqual({ status: "confirmed" });
  });
  it("correcting a migrated historical figure neither restores its bonus nor deducts it twice", async () => {
    const oldResult = await save({ scoreA: 1, scoreB: 0, mvpParticipantId: `player:${player(1)}` });
    // Reproduce the old persisted bonus before applying the migration's resulting state.
    await db.exec(`update public.players set current_rating=current_rating+5 where id='${player(1)}';
      update public.organization_season_player_ratings set current_rating=current_rating+5 where player_id='${player(1)}';
      insert into public.rating_history(match_id,player_id,season_id,rating_before,rating_after,delta,season_rating_before,season_rating_after,season_delta,reason)
      values ('${match}','${player(1)}','${oldResult.season_id}',1010,1015,5,1010,1015,5,'mvp_bonus');`);
    const match2 = id(50), option2 = id(51);
    await db.query("insert into public.matches(id,organization_id,status,confirmed_option_id,scheduled_at) values ($1,$2,'confirmed',$3,'2026-09-02T20:00:00Z')", [match2, org, option2]);
    await db.query("insert into public.team_options(id,match_id,is_confirmed,option_number) values ($1,$2,true,1)", [option2, match2]);
    for (let n = 1; n <= 4; n++) await db.query("insert into public.team_option_players values ($1,$2,$3)", [option2, player(n), n < 3 ? "A" : "B"]);
    await db.query("select public.save_group_match_result($1,$2,0,$3::jsonb,true)", [match2, org, JSON.stringify({scoreA:0,scoreB:1})]);
    expect(await ratings()).toEqual([1005,1000,1000,1000,1000]);
    await db.exec(`update public.players set current_rating=current_rating-5 where id='${player(1)}';
      update public.organization_season_player_ratings set current_rating=current_rating-5 where player_id='${player(1)}';
      delete from public.rating_history where reason='mvp_bonus';
      update public.rating_history set rating_before=rating_before-5,rating_after=rating_after-5,
        season_rating_before=season_rating_before-5,season_rating_after=season_rating_after-5
        where match_id='${match2}' and player_id='${player(1)}';
      alter table public.rating_history add constraint test_no_mvp_bonus check(reason <> 'mvp_bonus');`);
    const newerHistory = (await db.query("select * from public.rating_history where match_id=$1 order by id", [match2])).rows;
    await save({ scoreA: 1, scoreB: 0, mvpParticipantId: `player:${player(3)}` }, 1);
    await save({ scoreA: 1, scoreB: 0, notes: "Revisado otra vez" }, 2);
    expect(await ratings()).toEqual([1000,1000,1000,1000,1000]);
    await save({ scoreA: 0, scoreB: 0 }, 3);
    expect(await ratings()).toEqual([990,990,1010,1010,1000]);
    expect((await db.query("select * from public.rating_history where match_id=$1 order by id", [match2])).rows).toEqual(newerHistory);
    expect((await db.query("select mvp_player_id from public.match_result where match_id=$1", [match])).rows[0]).toEqual({mvp_player_id: player(3)});
    expect((await db.query("select * from public.rating_history where reason='mvp_bonus'")).rows).toEqual([]);
  });
  it("enforces authorization inside the private implementation", async () => {
    await db.exec(`select set_config('test.admin', '${id(999)}', false)`);
    await expect(save({ scoreA: 1, scoreB: 0 })).rejects.toThrow("No autorizado");
    expect(await history()).toEqual([]);
  });
  it("rejects a forged confirmed option pointer without touching another group's lineup", async () => {
    const foreignOrg = id(60), foreignMatch = id(61), foreignOption = id(62), foreignPlayer = id(63);
    await db.query("insert into public.organizations values ($1,$2)", [foreignOrg, id(999)]);
    await db.query("insert into public.players(id,organization_id,full_name) values ($1,$2,'Ajeno')", [foreignPlayer, foreignOrg]);
    await db.query("insert into public.matches(id,organization_id,status) values ($1,$2,'confirmed')", [foreignMatch, foreignOrg]);
    await db.query("insert into public.team_options(id,match_id,is_confirmed) values ($1,$2,true)", [foreignOption, foreignMatch]);
    await db.query("insert into public.team_option_players values ($1,$2,'A')", [foreignOption, foreignPlayer]);
    await db.query("update public.matches set confirmed_option_id=$1,lineup_snapshot=$2::jsonb where id=$3", [foreignOption,
      JSON.stringify(assignments.map((p) => ({ ...p, fullName: "Propio", source: "player", penalized: false }))), match]);
    await expect(save({ scoreA: 1, scoreB: 0 })).rejects.toThrow("opcion confirmada");
    expect((await db.query("select player_id from public.team_option_players where team_option_id=$1", [foreignOption])).rows).toEqual([{player_id: foreignPlayer}]);
    expect(await history()).toEqual([]);
  });
  it("rejects a forged rating ledger linking another group's player or season", async () => {
    const foreignOrg = id(70), foreignSeason = id(71), foreignPlayer = id(72);
    await db.query("insert into public.organizations values ($1,$2)", [foreignOrg, id(999)]);
    await db.query("insert into public.players(id,organization_id,full_name) values ($1,$2,'Ajeno')", [foreignPlayer, foreignOrg]);
    await db.query("insert into public.organization_seasons(id,organization_id,starts_at,ends_at,status) values ($1,$2,'2026-01-01','2026-12-31','active')", [foreignSeason, foreignOrg]);
    await db.query("insert into public.organization_season_player_ratings values ($1,$2,$3,1000)", [foreignOrg, foreignSeason, foreignPlayer]);
    await db.query("insert into public.rating_history(match_id,player_id,season_id,delta,season_delta,reason) values ($1,$2,$3,50,50,'match_result')", [match, foreignPlayer, foreignSeason]);
    await expect(save({ scoreA: 1, scoreB: 0 })).rejects.toThrow("referencias ajenas");
    expect((await db.query("select current_rating from public.organization_season_player_ratings where season_id=$1", [foreignSeason])).rows).toEqual([{current_rating: "1000"}]);
    await db.query("update public.rating_history set player_id=$1 where match_id=$2", [player(1), match]);
    await expect(save({ scoreA: 1, scoreB: 0 })).rejects.toThrow("referencias ajenas");
    expect((await db.query("select count(*)::int count from public.match_result")).rows[0]).toEqual({count: 0});
  });
  it("rejects a forged seasonal account instead of mutating another group's row", async () => {
    const foreignOrg = id(80), season = id(81);
    await db.query("insert into public.organizations values ($1,$2)", [foreignOrg, id(999)]);
    await db.query("insert into public.organization_seasons(id,organization_id,starts_at,ends_at,status) values ($1,$2,'2026-01-01','2026-12-31','active')", [season, org]);
    await db.query("insert into public.organization_season_player_ratings values ($1,$2,$3,500)", [foreignOrg, season, player(1)]);
    await expect(save({ scoreA: 1, scoreB: 0 })).rejects.toThrow("cuenta de puntos");
    expect((await db.query("select current_rating from public.organization_season_player_ratings where season_id=$1", [season])).rows).toEqual([{current_rating: "500"}]);
    expect(await history()).toEqual([]);
  });
});
