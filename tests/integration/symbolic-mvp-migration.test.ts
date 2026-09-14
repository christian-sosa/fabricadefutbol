import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { executePrivateSql, privateSqlAvailable } from "../helpers/private-sql";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const source = "supabase/schema.sql";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe.skipIf(!privateSqlAvailable(source))("symbolic MVP historical migration (PostgreSQL)", () => {
  let db: PGlite;
  let migration: string;
  beforeAll(async () => {
    migration = readFileSync(source, "utf8").split("-- BEGIN SYMBOLIC MVP MIGRATION 20260914")[1]
      .split("-- END SYMBOLIC MVP MIGRATION 20260914")[0];
    db = new PGlite();
    await db.exec(`
      create table public.organizations(id uuid primary key);
      create table public.players(id uuid primary key, organization_id uuid references public.organizations, current_rating numeric check(current_rating > 0));
      create table public.organization_seasons(id uuid primary key, organization_id uuid references public.organizations);
      create table public.matches(id uuid primary key, organization_id uuid references public.organizations);
      create table public.organization_season_player_ratings(player_id uuid references public.players, season_id uuid references public.organization_seasons, current_rating numeric check(current_rating > 0), unique(player_id,season_id));
      create table public.rating_history(id uuid primary key, player_id uuid references public.players, match_id uuid references public.matches, season_id uuid references public.organization_seasons, rating_before numeric, rating_after numeric, delta numeric, season_rating_before numeric, season_rating_after numeric, season_delta numeric, reason text, created_at timestamptz);
      create table public.match_result(match_id uuid primary key references public.matches, mvp_player_id uuid references public.players, score_a int, score_b int);
      create table public.organization_public_snapshots(organization_id uuid primary key references public.organizations, standings jsonb);
    `);
  });
  afterAll(async () => { await db?.close(); });
  beforeEach(async () => {
    await db.exec(`
      alter table public.rating_history drop constraint if exists rating_history_no_mvp_bonus_check;
      truncate public.organizations cascade;
      insert into public.organizations values ('${id(1)}'),('${id(2)}'),('${id(3)}');
      insert into public.players values ('${id(11)}','${id(1)}',1210),('${id(12)}','${id(2)}',990),('${id(13)}','${id(3)}',1015);
      insert into public.organization_seasons values ('${id(21)}','${id(1)}'),('${id(22)}','${id(1)}'),('${id(23)}','${id(2)}');
      insert into public.organization_season_player_ratings values ('${id(11)}','${id(21)}',1015),('${id(11)}','${id(22)}',895),('${id(12)}','${id(23)}',990);
      insert into public.matches values ('${id(31)}','${id(1)}'),('${id(32)}','${id(1)}'),('${id(33)}','${id(2)}'),('${id(34)}','${id(3)}');
      insert into public.rating_history values
        ('${id(41)}','${id(11)}','${id(31)}','${id(21)}',1200,1210,10,1000,1010,10,'match_result','2025-12-30'),
        ('${id(42)}','${id(11)}','${id(31)}','${id(21)}',1210,1215,5,1010,1015,5,'mvp_bonus','2025-12-30'),
        ('${id(43)}','${id(11)}','${id(32)}','${id(22)}',1215,1205,-10,900,890,-10,'match_result','2026-01-02'),
        ('${id(44)}','${id(11)}','${id(32)}','${id(22)}',1205,1210,5,890,895,5,'mvp_bonus','2026-01-02'),
        ('${id(45)}','${id(12)}','${id(33)}','${id(23)}',1000,990,-10,1000,990,-10,'match_result','2026-01-02'),
        ('${id(46)}','${id(13)}','${id(34)}',null,1000,1010,10,null,null,null,'match_result','2026-01-02'),
        ('${id(47)}','${id(13)}','${id(34)}',null,1010,1015,5,null,null,null,'mvp_bonus','2026-01-02');
      insert into public.match_result values ('${id(31)}','${id(11)}',2,1),('${id(32)}','${id(11)}',0,1),('${id(34)}','${id(13)}',1,0);
      insert into public.organization_public_snapshots values ('${id(1)}','[]'),('${id(2)}','[]'),('${id(3)}','[]');
    `);
  });

  async function state() {
    const tables = ["players", "organization_season_player_ratings", "rating_history", "match_result", "organization_public_snapshots"];
    return Promise.all(tables.map(async (table) => (await db.query(`select to_jsonb(t) row from public.${table} t order by to_jsonb(t)::text`)).rows));
  }

  it("removes actual bonuses across groups and seasons, preserving awards and non-MVP contributions", async () => {
    const awards = (await db.query("select * from public.match_result order by match_id")).rows;
    await executePrivateSql(db, migration, "symbolic-mvp-migration");
    expect((await db.query("select current_rating from public.players order by id")).rows).toEqual([{ current_rating: "1200" }, { current_rating: "990" }, { current_rating: "1010" }]);
    expect((await db.query("select current_rating from public.organization_season_player_ratings order by season_id")).rows).toEqual([{ current_rating: "1010" }, { current_rating: "890" }, { current_rating: "990" }]);
    expect((await db.query("select * from public.match_result order by match_id")).rows).toEqual(awards);
    expect((await db.query("select delta from public.rating_history order by id")).rows).toEqual([{ delta: "10" }, { delta: "-10" }, { delta: "-10" }, { delta: "10" }]);
    expect((await db.query("select organization_id from public.organization_public_snapshots")).rows).toEqual([{ organization_id: id(2) }]);
  });

  it("rebuilds global and seasonal balances without assuming an opening rating of 1000", async () => {
    // A corrected old match can leave stale before/after values in the ledger.
    await db.exec(`update public.rating_history set rating_before=9999,rating_after=9989 where id='${id(43)}'`);
    await executePrivateSql(db, migration, "symbolic-mvp-migration");
    expect((await db.query(`select rating_before,rating_after,season_rating_before,season_rating_after from public.rating_history where player_id='${id(11)}' order by created_at,match_id,id`)).rows).toEqual([
      { rating_before: "1200", rating_after: "1210", season_rating_before: "1000", season_rating_after: "1010" },
      { rating_before: "1210", rating_after: "1200", season_rating_before: "900", season_rating_after: "890" }
    ]);
    expect((await db.query(`select season_rating_before,season_rating_after,season_delta from public.rating_history where player_id='${id(13)}'`)).rows).toEqual([{ season_rating_before: null, season_rating_after: null, season_delta: null }]);
  });

  it("is idempotent and rejects any future MVP bonus write", async () => {
    await executePrivateSql(db, migration, "symbolic-mvp-migration");
    const once = await state();
    await executePrivateSql(db, migration, "symbolic-mvp-migration");
    expect(await state()).toEqual(once);
    await expect(db.exec(`update public.rating_history set reason='mvp_bonus' where id='${id(41)}'`)).rejects.toThrow(/rating_history_no_mvp_bonus_check/);
  });

  it("rolls back completely if removing a bonus would violate the positive rating invariant", async () => {
    await db.exec(`update public.players set current_rating=5 where id='${id(13)}'`);
    const before = await state();
    await expect(executePrivateSql(db, migration, "symbolic-mvp-migration")).rejects.toThrow(/current_rating_check/);
    expect(await state()).toEqual(before);
  });

  it("rolls back global changes when a later seasonal update violates its balance invariant", async () => {
    await db.exec(`update public.organization_season_player_ratings set current_rating=5 where season_id='${id(21)}'`);
    const before = await state();
    await expect(executePrivateSql(db, migration, "symbolic-mvp-migration")).rejects.toThrow(/current_rating_check/);
    expect(await state()).toEqual(before);
    expect((await db.query("select count(*)::int count from pg_constraint where conname='rating_history_no_mvp_bonus_check'")).rows).toEqual([{ count: 0 }]);
  });

  it("can retry safely after detecting a missing seasonal account", async () => {
    await db.exec(`delete from public.organization_season_player_ratings where season_id='${id(21)}'`);
    const before = await state();
    await expect(executePrivateSql(db, migration, "symbolic-mvp-migration")).rejects.toThrow(/Falta la cuenta de temporada/);
    expect(await state()).toEqual(before);
    await db.exec(`insert into public.organization_season_player_ratings values ('${id(11)}','${id(21)}',1015)`);
    await executePrivateSql(db, migration, "symbolic-mvp-migration");
    expect((await db.query(`select current_rating from public.players where id='${id(11)}'`)).rows).toEqual([{ current_rating: "1200" }]);
    expect((await db.query("select count(*)::int count from public.rating_history where reason='mvp_bonus'")).rows).toEqual([{ count: 0 }]);
  });

  it("uses the match order to rebuild a stable chain when timestamps tie and row IDs disagree", async () => {
    await db.exec(`update public.rating_history set created_at='2026-01-02' where player_id='${id(11)}';
      update public.rating_history set id='${id(40)}' where id='${id(43)}'`);
    await executePrivateSql(db, migration, "symbolic-mvp-migration");
    expect((await db.query(`select rating_before,rating_after from public.rating_history where player_id='${id(11)}' order by match_id`)).rows).toEqual([
      { rating_before: "1200", rating_after: "1210" },
      { rating_before: "1210", rating_after: "1200" }
    ]);
  });

  it("aborts before changing data if a bonus references another group", async () => {
    await db.exec(`update public.rating_history set match_id='${id(33)}' where id='${id(42)}'`);
    const before = await state();
    await expect(executePrivateSql(db, migration, "symbolic-mvp-migration")).rejects.toThrow(/referencias ajenas/);
    expect(await state()).toEqual(before);
  });
});
