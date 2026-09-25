import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { executePrivateSql, privateSqlAvailable } from "../helpers/private-sql";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
type Formation = { teamA: { formationId: string; slots: Array<{ slotId: string; participantId: string }> }; teamB: Formation["teamA"] };

// Execute both deployable schemas with their actual grants, RLS and transaction functions.
describe.skipIf(!privateSqlAvailable("supabase/generated/schema.app_prod.sql")).each(["app_dev", "app_prod"])("%s visual formations and RLS", (schema) => {
  let db: PGlite;
  const sql = (query: string) => db.exec(query.replaceAll("APP", schema));
  const rows = async (query: string) => (await db.query<Record<string, unknown>>(query.replaceAll("APP", schema))).rows;
  const login = async (user = 1, aal = "aal1") => sql(`reset role; select set_config('test.uid','${id(user)}',false); select set_config('test.aal','${aal}',false); set role authenticated;`);
  const save = async (formation: unknown, version = 0, organization = id(10)) => (await db.query<{ result: { formation_version: number } }>(
    `select ${schema}.save_group_match_formation($1,$2,$3,$4::jsonb) result`, [id(40), organization, version, formation === null ? null : JSON.stringify(formation)]
  )).rows[0].result;
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
      grant select on storage.objects to anon,authenticated;`);
    for (const file of [`schema.${schema}.sql`, `policies.${schema}.sql`, "policies.storage.sql"]) {
      const source = readFileSync(`supabase/generated/${file}`, "utf8").replace("create extension if not exists pgcrypto;", "");
      await executePrivateSql(db, source, file);
      await executePrivateSql(db, source, file);
    }
  }, 30_000);
  afterAll(async () => { await db?.close(); });
  beforeEach(async () => {
    await sql(`reset role; truncate APP.organizations cascade; truncate APP.admins cascade; truncate auth.users cascade; truncate auth.mfa_factors;
      select set_config('test.uid','',false); select set_config('test.aal','aal1',false);
      insert into auth.users values('${id(1)}','owner@example.test'),('${id(2)}','other@example.test');
      insert into APP.admins(id,display_name) values('${id(1)}','Owner'),('${id(2)}','Other');
      insert into APP.organizations(id,name,slug,created_by) values('${id(10)}','One','one','${id(1)}'),('${id(11)}','Two','two','${id(2)}');
      insert into APP.players(id,organization_id,full_name,initial_rank) values ${Array.from({ length: 22 }, (_, n) => `('${id(100 + n)}','${id(10)}','Player ${n}',${n + 1})`).join(",")};
      insert into APP.players(id,organization_id,full_name,initial_rank) values('${id(200)}','${id(11)}','Other group',1);
      insert into APP.matches(id,organization_id,created_by,modality,scheduled_at) values('${id(40)}','${id(10)}','${id(1)}','9v9','2026-09-01');
      insert into APP.team_options(id,match_id,option_number,rating_sum_a,rating_sum_b,rating_diff,created_by) values('${id(50)}','${id(40)}',1,9000,9000,0,'${id(1)}');
      insert into APP.match_guests(id,match_id,guest_name,guest_rating) values('${id(80)}','${id(40)}','Invitado',2);`);
  });

  async function prepare(size = 9, withGoalkeepers = true, confirmTeams = true) {
    await sql(`update APP.matches set modality='${size}v${size}',goalkeeper_player_ids='${withGoalkeepers ? `{${id(100)},${id(100 + size)}}` : "{}"}' where id='${id(40)}';
      insert into APP.match_players(match_id,player_id) select '${id(40)}',id from APP.players where organization_id='${id(10)}';
      insert into APP.team_option_players(team_option_id,player_id,team) select '${id(50)}',id,case when initial_rank<=${size} then 'A'::APP.team_side else 'B'::APP.team_side end
        from APP.players where organization_id='${id(10)}' and initial_rank < ${2 * size};
      insert into APP.team_option_guests(team_option_id,guest_id,team) values('${id(50)}','${id(80)}','B');`);
    await login();
    if (confirmTeams) await sql(`select APP.confirm_group_match_option('${id(40)}','${id(10)}','${id(50)}')`);
  }
  function formation(preset = "3-3-2", otherPreset = preset): Formation {
    const size = 1 + preset.split("-").reduce((total, value) => total + Number(value), 0);
    const makeTeam = (side: "A" | "B", shape: string) => ({ formationId: shape, slots: ["gk", ...shape.split("-").flatMap((amount, line) => Array.from({ length: Number(amount) }, (_, position) => `line-${line}-${position}`))]
      .map((slotId, i) => ({ slotId, participantId: side === "B" && i === size - 1 ? `guest:${id(80)}` : `player:${id(100 + (side === "A" ? 0 : size) + i)}` })) });
    return { teamA: makeTeam("A", preset), teamB: makeTeam("B", otherPreset) };
  }
  const matchState = () => rows(`select formation_data,formation_version,result_version,status,goalkeeper_player_ids from APP.matches where id='${id(40)}'`);
  const result = (input: unknown, version = 1, finish = true) => db.query(`select ${schema}.save_group_match_result($1,$2,$3,$4::jsonb,$5)`, [id(40), id(10), version, JSON.stringify(input), finish]);

  it.each([
    [5, "2-2"], [5, "1-2-1"], [5, "2-1-1"],
    [6, "2-2-1"], [6, "1-3-1"], [6, "2-1-2"],
    [7, "2-3-1"], [7, "3-2-1"], [7, "2-2-2"], [7, "3-1-2"],
    [10, "3-3-3"], [10, "4-3-2"], [10, "3-4-2"], [10, "4-4-1"]
  ] as const)("publishes and clears F%s %s with the exact confirmed players, guest and goalkeeper", async (size, preset) => {
    await prepare(size);
    const payload = formation(preset);
    expect(await save(payload)).toEqual({ formation_version: 1 });
    expect((await matchState())[0]).toMatchObject({ formation_version: 1, result_version: 1, status: "confirmed", formation_data: payload });
    expect(await rows("select id from APP.players where current_rating <> 1000")).toEqual([]);
    expect(await rows("select id from APP.rating_history")).toEqual([]);
    expect(await save(null, 1)).toEqual({ formation_version: 2 });
    expect((await matchState())[0]).toMatchObject({ formation_data: null, result_version: 1 });
  });

  it("regenerates and confirms F10 teams, then saves a symbolic figure without changing sporting contracts", async () => {
    await prepare(10, true, false);
    const payload = formation("3-3-3");
    const generated = { teamA: payload.teamA.slots.map((slot) => ({ id: slot.participantId })), teamB: payload.teamB.slots.map((slot) => ({ id: slot.participantId })), ratingSumA: 10000, ratingSumB: 10000, ratingDiff: 0 };
    await db.query(`select ${schema}.replace_group_match_options($1,$2,0,$3::jsonb)`, [id(40), id(10), JSON.stringify([generated])]);
    const newOption = (await rows(`select id from APP.team_options where match_id='${id(40)}'`))[0].id;
    await db.query(`select ${schema}.confirm_group_match_option($1,$2,$3)`, [id(40), id(10), newOption]);
    expect(await save(payload)).toEqual({ formation_version: 1 });
    await result({ scoreA: 2, scoreB: 1, mvpParticipantId: `player:${id(100)}` }, 2);
    expect((await rows(`select current_rating from APP.players where id='${id(100)}'`))[0]).toEqual({ current_rating: "1010.00" });
    expect(await rows("select id from APP.rating_history")).toHaveLength(19);
    const ledger = await rows("select * from APP.rating_history order by id");
    const seasonRatings = await rows("select * from APP.organization_season_player_ratings order by player_id");
    await result({ scoreA: 2, scoreB: 1, notes: "Revisado", mvpParticipantId: `guest:${id(80)}` }, 3);
    expect(await rows("select * from APP.rating_history order by id")).toEqual(ledger);
    expect(await rows("select * from APP.organization_season_player_ratings order by player_id")).toEqual(seasonRatings);
    expect((await matchState())[0]).toMatchObject({ status: "finished", result_version: 4, formation_version: 1, formation_data: payload });
    expect((await rows("select mvp_guest_id from APP.match_result"))[0]).toEqual({ mvp_guest_id: id(80) });
  });

  it("keeps a complete pitch when an assigned bench player participates and allows choosing N of N+ players", async () => {
    await prepare(9, false, false);
    await sql(`update APP.match_players set is_substitute=true,substitute_team='A' where player_id='${id(117)}';
      select APP.confirm_group_match_option('${id(40)}','${id(10)}','${id(50)}')`);
    const payload = formation();
    await save(payload);
    const assignments = [
      ...payload.teamA.slots.map((slot)=>({participantId:slot.participantId,team:"A"})),
      ...payload.teamB.slots.map((slot)=>({participantId:slot.participantId,team:"B"})),
      {participantId:`player:${id(117)}`,team:"A"}
    ];
    await result({lineup:{assignments}},1,false);
    expect((await matchState())[0]).toMatchObject({formation_data:payload,formation_version:1,result_version:2});
    expect(await save(payload,1)).toEqual({formation_version:2});
    payload.teamA.slots[1].participantId = `player:${id(117)}`;
    expect(await save(payload,2)).toEqual({formation_version:3});
    expect((await matchState())[0]).toMatchObject({formation_data:payload,result_version:2});
    await result({scoreA:2,scoreB:1,scorers:[{participantId:`player:${id(117)}`,goals:1}]},2);
    expect((await rows(`select current_rating from APP.players where id='${id(117)}'`))[0]).toEqual({current_rating:"1010.00"});
    expect((await matchState())[0]).toMatchObject({formation_data:payload,formation_version:3,result_version:3});
  });

  it("rejects generated options that replace a starter with a called-up substitute", async () => {
    await prepare(9, false, false);
    await sql(`update APP.match_players set is_substitute=true where player_id='${id(117)}'`);
    const payload = formation();
    payload.teamA.slots[1].participantId = `player:${id(117)}`;
    const generated = {teamA:payload.teamA.slots.map((slot)=>({id:slot.participantId})),teamB:payload.teamB.slots.map((slot)=>({id:slot.participantId})),ratingSumA:9000,ratingSumB:9000,ratingDiff:0};
    await expect(db.query(`select ${schema}.replace_group_match_options($1,$2,0,$3::jsonb)`,[id(40),id(10),JSON.stringify([generated])])).rejects.toThrow(/convocatoria activa/);
    expect(await rows("select id from APP.team_options")).toEqual([{id:id(50)}]);
    expect((await matchState())[0]).toMatchObject({result_version:0,status:"draft"});
  });

  it("retains exact team size for visual formations in smaller modalities", async () => {
    await prepare(5,false);
    const payload=formation("2-2");
    await save(payload);
    const assignments=[...payload.teamA.slots.map((s)=>({participantId:s.participantId,team:"A"})),...payload.teamB.slots.map((s)=>({participantId:s.participantId,team:"B"}))];
    await result({lineup:{assignments,newPlayers:[{playerId:id(117),team:"A"}]}},1,false);
    expect((await matchState())[0]).toMatchObject({formation_data:null,formation_version:2,result_version:2});
    await expect(save(payload,2)).rejects.toThrow(/cantidad de jugadores/);
  });

  it.each([[5, "3-1"], [6, "4-1"], [7, "1-4-1"], [10, "5-4"]] as const)("rejects an unlisted F%s preset %s even when its size is correct", async (size, preset) => {
    await prepare(size);
    await expect(save(formation(preset))).rejects.toMatchObject({ code: "22023" });
    expect((await matchState())[0]).toMatchObject({ formation_data: null, formation_version: 0, result_version: 1 });
  });

  it.each(["3-3-2", "3-2-3", "4-3-1", "4-2-2", "2-4-2"])("publishes F9 %s with guests without modifying the sporting version or points", async (preset) => {
    await prepare();
    expect(await save(formation(preset, "3-3-2"))).toEqual({ formation_version: 1 });
    expect((await matchState())[0]).toMatchObject({ formation_version: 1, result_version: 1, status: "confirmed" });
    expect(await rows("select id from APP.players where current_rating <> 1000")).toEqual([]);
    expect(await rows("select id from APP.rating_history")).toEqual([]);
    expect(await rows("select id from APP.match_result")).toEqual([]);
    await sql("reset role; select set_config('test.uid','',false); set role anon");
    expect((await matchState())[0].formation_data).toMatchObject({ teamA: { formationId: preset }, teamB: { formationId: "3-3-2" } });
  });
  it.each(["4-4-2", "4-3-3", "4-2-3-1", "3-5-2", "3-4-3", "5-3-2"])("publishes F11 %s and permits an unmarked goalkeeper from that team's pool", async (preset) => {
    await prepare(11, false);
    const payload = formation(preset);
    [payload.teamB.slots[0].participantId, payload.teamB.slots[10].participantId] = [payload.teamB.slots[10].participantId, payload.teamB.slots[0].participantId];
    expect(await save(payload)).toEqual({ formation_version: 1 });
    expect((await matchState())[0].goalkeeper_player_ids).toEqual([]);
  });
  it("clears both pitches explicitly and rejects a stale editor or concurrent double save", async () => {
    await prepare();
    const outcomes = await Promise.allSettled([save(formation()), save(formation("3-2-3"))]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.find((outcome) => outcome.status === "rejected")).toMatchObject({ reason: { code: "PT409" } });
    const before = await matchState();
    await expect(save(null)).rejects.toMatchObject({ code: "PT409" });
    expect(await matchState()).toEqual(before);
    expect(await save(null, 1)).toEqual({ formation_version: 2 });
    expect((await matchState())[0]).toMatchObject({ formation_data: null, formation_version: 2, result_version: 1 });
  });
  it("rejects incomplete, duplicated, malformed and oversized payloads without changing a saved pitch", async () => {
    await prepare();
    await save(formation());
    const before = await matchState();
    const duplicatePlayer = formation(); duplicatePlayer.teamA.slots[1].participantId = duplicatePlayer.teamA.slots[0].participantId;
    const duplicateSlot = formation(); duplicateSlot.teamA.slots[1].slotId = "gk";
    const missingSlot = formation(); missingSlot.teamB.slots.pop();
    const unknownSlot = formation(); unknownSlot.teamA.slots[1].slotId = "free-position";
    const wrongPreset = formation(); wrongPreset.teamA.formationId = "4-4-2";
    const invalidUuid = formation(); invalidUuid.teamA.slots[1].participantId = "player:not-a-uuid";
    for (const payload of [[], {}, { teamA: formation().teamA }, { ...formation(), extra: true }, { teamA: null, teamB: null },
      { ...formation(), teamA: { formationId: "3-3-2", slots: null } }, duplicatePlayer, duplicateSlot, missingSlot, unknownSlot, wrongPreset, invalidUuid,
      { ...formation(), teamA: { ...formation().teamA, levels: [1, 2] } }, { ...formation(), extra: "x".repeat(17000) }]) {
      await expect(save(payload, 1)).rejects.toMatchObject({ code: "22023" });
      expect(await matchState()).toEqual(before);
    }
  });
  it("rejects participants from the opponent, another group or outside the confirmed pool, and fixes marked goalkeepers in goal", async () => {
    await prepare();
    for (const participantId of [`player:${id(109)}`, `player:${id(200)}`, `player:${id(121)}`, `guest:${id(81)}`]) {
      const payload = formation(); payload.teamA.slots[1].participantId = participantId;
      await expect(save(payload)).rejects.toMatchObject({ code: "22023" });
    }
    const goalkeeperSwap = formation();
    [goalkeeperSwap.teamA.slots[0].participantId, goalkeeperSwap.teamA.slots[1].participantId] = [goalkeeperSwap.teamA.slots[1].participantId, goalkeeperSwap.teamA.slots[0].participantId];
    await expect(save(goalkeeperSwap)).rejects.toThrow(/arquero/);
    expect((await matchState())[0]).toMatchObject({ formation_data: null, formation_version: 0 });
  });
  it("rejects anonymous, other-group and downgraded MFA writes, including direct-column bypasses", async () => {
    await prepare();
    await save(formation());
    const before = await matchState();
    for (const query of [
      `update APP.matches set formation_data=null where id='${id(40)}'`,
      `update APP.matches set formation_version=99 where id='${id(40)}'`,
      `insert into APP.matches(organization_id,created_by,modality,scheduled_at,formation_data) values('${id(10)}','${id(1)}','9v9',now(),'{}')`,
      `insert into APP.matches(organization_id,created_by,modality,scheduled_at,formation_version) values('${id(10)}','${id(1)}','9v9',now(),1)`
    ]) await expect(sql(query)).rejects.toMatchObject({ code: "42501" });
    await login(2);
    await expect(save(formation(), 1)).rejects.toMatchObject({ code: "42501" });
    await expect(save(formation(), 1, id(11))).rejects.toMatchObject({ code: "22023" });
    await sql("reset role; select set_config('test.uid','',false); set role anon");
    await expect(save(formation(), 1)).rejects.toMatchObject({ code: "42501" });
    await sql(`reset role; insert into auth.mfa_factors values('${id(1)}','verified')`);
    await login();
    await expect(save(formation(), 1)).rejects.toMatchObject({ code: "42501" });
    await login(1, "aal2");
    expect(await matchState()).toEqual(before);
    await save(null, 1);
  });
  it("rejects a formation if a lineup edit placed both marked goalkeepers on the same team", async () => {
    await prepare();
    const proposed = formation();
    [proposed.teamA.slots[1].participantId, proposed.teamB.slots[0].participantId] = [proposed.teamB.slots[0].participantId, proposed.teamA.slots[1].participantId];
    const assignments = [...proposed.teamA.slots.map((slot) => ({ participantId: slot.participantId, team: "A" })), ...proposed.teamB.slots.map((slot) => ({ participantId: slot.participantId, team: "B" }))];
    await result({ lineup: { assignments } }, 1, false);
    await expect(save(proposed)).rejects.toMatchObject({ code: "22023", message: expect.stringContaining("arqueros") });
    expect((await matchState())[0]).toMatchObject({ formation_data: null, formation_version: 0, result_version: 2 });
    expect(await rows("select id from APP.rating_history")).toEqual([]);
  });
  it("keeps formations behind existing archived group visibility", async () => {
    await prepare(); await save(formation());
    expect(await matchState()).toHaveLength(1);
    await sql(`reset role; update APP.organizations set archived_at=now() where id='${id(10)}'`);
    await login();
    await expect(save(null, 1)).rejects.toMatchObject({ code: "42501" });
    expect(await matchState()).toEqual([]);
    await sql("reset role; select set_config('test.uid','',false); set role anon");
    expect(await matchState()).toEqual([]);
  });
  it("preserves positions when recording a result or correcting notes and the symbolic figure", async () => {
    await prepare(); await save(formation());
    const positioned = (await matchState())[0].formation_data;
    await result({ scoreA: 2, scoreB: 1 });
    const ledger = await rows("select * from APP.rating_history order by id");
    await result({ scoreA: 2, scoreB: 1, notes: "Otra cancha", mvpParticipantId: `player:${id(100)}` }, 2);
    expect((await matchState())[0]).toMatchObject({ formation_data: positioned, formation_version: 1, result_version: 3, status: "finished" });
    expect(await rows("select * from APP.rating_history order by id")).toEqual(ledger);
    await expect(save(null, 1)).rejects.toMatchObject({ code: "22023" });
  });
  it("invalidates positions atomically when the act changes teams and rejects an editor based on the old formation", async () => {
    await prepare(); await save(formation());
    const original = formation();
    const assignments = [...original.teamA.slots.map((slot) => ({ participantId: slot.participantId, team: "A" })), ...original.teamB.slots.map((slot) => ({ participantId: slot.participantId, team: "B" }))];
    assignments[1].team = "B"; assignments[10].team = "A";
    await result({ lineup: { assignments } }, 1, false);
    expect((await matchState())[0]).toMatchObject({ formation_data: null, formation_version: 2, result_version: 2, status: "confirmed" });
    await expect(save(original, 1)).rejects.toMatchObject({ code: "PT409" });
    await expect(save(original, 2)).rejects.toMatchObject({ code: "22023" });
    expect(await rows("select id from APP.rating_history")).toEqual([]);
  });
  it("rolls back formation invalidation when saving a changed act fails", async () => {
    await prepare(); await save(formation());
    const before = await matchState();
    const original = formation();
    const assignments = [...original.teamA.slots.map((slot) => ({ participantId: slot.participantId, team: "A" })), ...original.teamB.slots.map((slot) => ({ participantId: slot.participantId, team: "B" }))];
    assignments[1].team = "OUT";
    await sql("reset role; alter table APP.match_result add constraint test_formation_failure check(score_a < 50)");
    await login();
    try { await expect(result({ scoreA: 99, scoreB: 0, lineup: { assignments } })).rejects.toThrow(/test_formation_failure/); }
    finally { await sql("reset role; alter table APP.match_result drop constraint test_formation_failure"); await login(); }
    expect(await matchState()).toEqual(before);
    expect(await rows("select id from APP.rating_history")).toEqual([]);
    expect(await rows("select id from APP.match_result")).toEqual([]);
  });
  it("restricts formations to confirmed matches and retains the independent nonnegative version constraint", async () => {
    await login();
    await expect(save(formation())).rejects.toMatchObject({ code: "22023" });
    await sql("reset role"); await prepare();
    await sql(`reset role; update APP.matches set status='cancelled' where id='${id(40)}'`); await login();
    await expect(save(formation())).rejects.toMatchObject({ code: "22023" });
    await sql("reset role");
    await expect(sql(`update APP.matches set formation_version=-1 where id='${id(40)}'`)).rejects.toMatchObject({ code: "23514" });
  });
  it("adds F10 without enabling F8 or dropping any existing modality", async () => {
    expect(await rows("select unnest(enum_range(null::APP.match_modality))::text modality")).toEqual(
      ["5v5", "6v6", "7v7", "9v9", "10v10", "11v11"].map((modality) => ({ modality }))
    );
    await expect(sql(`update APP.matches set modality='8v8' where id='${id(40)}'`)).rejects.toMatchObject({ code: "22P02" });
  });
});
