import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { assertPrivateSqlSources } from "./check-private-sql.mjs";
import { buildSchemaSources } from "./lib/schema-sql.mjs";
import {
  localConcurrencyDatabase, PrivatePostgresError, privateQuery, connectPrivate, claimEmptyDatabase,
  syntheticBootstrap, authenticate, observeQuery, waitForDatabaseLock,
  cleanupSyntheticDatabase
} from "./lib/postgres-concurrency.mjs";

const id = (number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const owner = id(1), member = id(2), sportingGroup = id(10), photoGroup = id(11);
const matchId = id(40), optionId = id(50), photoPlayer = id(60);
const oldPhoto = `app_dev/${photoGroup}/${photoPlayer}/${id(90)}.webp`;
const bucket = "player-photos-dev";
const CLEANUP_SENTINEL = "Sentinela cleanup despues de schema";

async function seedFixtures(controller) {
  await privateQuery(controller, `
    insert into auth.users(id,email) values($1,'owner@example.test'),($2,'member@example.test');
  `, [owner, member], "Crear identidades sinteticas");
  await privateQuery(controller, "insert into app_dev.admins(id,display_name) values($1,'Owner'),($2,'Member')", [owner, member]);
  await privateQuery(controller, `insert into app_dev.organizations(id,name,slug,created_by,created_at,updated_at)
    values($1,'Sporting concurrency','synthetic-sporting',$3,'2000-01-01','2000-01-01'),
          ($2,'Photo concurrency','synthetic-photo',$3,'2000-01-01','2000-01-01')`, [sportingGroup, photoGroup, owner]);
  await privateQuery(controller, "insert into app_dev.organization_admins(organization_id,admin_id,created_by) values($1,$2,$3)", [sportingGroup, member, owner]);
  for (let index = 0; index < 10; index++) {
    await privateQuery(controller, "insert into app_dev.players(id,organization_id,full_name,initial_rank) values($1,$2,$3,$4)",
      [id(20 + index), sportingGroup, `Synthetic player ${index + 1}`, index + 1]);
  }
  await privateQuery(controller, `insert into app_dev.players(id,organization_id,full_name,initial_rank,photo_path,photo_updated_at,created_at,updated_at)
    values($1,$2,'Synthetic photo player',1,$3,'2000-01-01','2000-01-01','2000-01-01')`, [photoPlayer, photoGroup, oldPhoto]);
  await privateQuery(controller, "insert into storage.objects(bucket_id,name,owner,created_at,updated_at) values($1,$2,$3,'2000-01-01','2000-01-01')", [bucket, oldPhoto, owner]);
  await privateQuery(controller, "insert into app_dev.matches(id,organization_id,created_by,modality,scheduled_at) values($1,$2,$3,'5v5','2026-09-01T20:00:00Z')", [matchId, sportingGroup, owner]);
  await privateQuery(controller, `insert into app_dev.team_options(id,match_id,option_number,rating_sum_a,rating_sum_b,rating_diff,created_by)
    values($1,$2,1,5000,5000,0,$3)`, [optionId, matchId, owner]);
  await privateQuery(controller, "insert into app_dev.match_players(match_id,player_id) select $1,id from app_dev.players where organization_id=$2", [matchId, sportingGroup]);
  await privateQuery(controller, `insert into app_dev.team_option_players(team_option_id,player_id,team)
    select $1,id,case when initial_rank<=5 then 'A'::app_dev.team_side else 'B'::app_dev.team_side end
    from app_dev.players where organization_id=$2`, [optionId, sportingGroup]);
  await authenticate(controller, owner);
  await privateQuery(controller, "select app_dev.confirm_group_match_option($1,$2,$3)", [matchId, sportingGroup, optionId], "Confirmar equipos sinteticos");
  await privateQuery(controller, "reset role; select app_dev_private.activate_group_security_controls()");
}

async function sportingState(controller) {
  const rows = async (query, values = []) => (await privateQuery(controller, query, values)).rows;
  return {
    match: await rows("select status,result_version,confirmed_option_id,lineup_snapshot from app_dev.matches where id=$1", [matchId]),
    players: await rows("select id,current_rating from app_dev.players where organization_id=$1 order by id", [sportingGroup]),
    history: await rows("select player_id,rating_before,rating_after,delta,reason,season_id,season_delta from app_dev.rating_history where match_id=$1 order by player_id", [matchId]),
    result: await rows("select score_a,score_b,mvp_player_id,created_by from app_dev.match_result where match_id=$1", [matchId]),
    seasonRatings: await rows(`select player_id,current_rating from app_dev.organization_season_player_ratings
      where organization_id=$1 order by season_id,player_id`, [sportingGroup])
  };
}

async function holdGroup(controller, group) {
  await privateQuery(controller, "reset role; begin");
  const held = await privateQuery(controller, "select id from app_dev.organizations where id=$1 for update", [group]);
  assert.equal(held.rowCount, 1, "La carrera debe retener el lock del grupo sintetico.");
}

async function revokeWhileWaiting(controller, worker, pids) {
  const baseline = await sportingState(controller);
  assert.equal(baseline.match[0].status, "confirmed");
  const version = baseline.match[0].result_version;
  assert.equal(version, 1);
  assert.equal(baseline.history.length, 0);
  assert.equal(baseline.result.length, 0);
  assert.deepEqual(baseline.players.map((player) => Number(player.current_rating)), Array(10).fill(1000));
  await authenticate(worker, member);
  assert.equal((await privateQuery(worker, "select app_dev.can_write_org($1) as allowed", [sportingGroup])).rows[0].allowed, true,
    "El miembro debe poder guardar antes de la revocacion.");
  const input = JSON.stringify({ scoreA: 2, scoreB: 0, mvpParticipantId: `player:${id(20)}` });
  let pending;
  try {
    await holdGroup(controller, sportingGroup);
    pending = observeQuery(privateQuery(worker, "select app_dev.save_group_match_result($1,$2,$3,$4::jsonb) as result",
      [matchId, sportingGroup, version, input], "Guardar resultado durante revocacion"));
    await waitForDatabaseLock(controller, pids.controller, pids.worker, pending);
    await authenticate(controller, owner);
    const removed = await privateQuery(controller, "delete from app_dev.organization_admins where organization_id=$1 and admin_id=$2 returning admin_id", [sportingGroup, member]);
    assert.equal(removed.rowCount, 1, "El propietario debe revocar al miembro durante el lock observado.");
    await privateQuery(controller, "reset role; commit");
    const outcome = await pending.promise;
    assert.equal(outcome.ok, false, "Un permiso revocado mientras espera no puede guardar el resultado.");
    assert.equal(outcome.error.code, "42501", "La operacion debe rechazar por autorizacion, no por un error incidental.");
    assert.equal((await privateQuery(worker, "select app_dev.can_write_org($1) as allowed", [sportingGroup])).rows[0].allowed, false);
    assert.deepEqual(await sportingState(controller), baseline, "La revocacion no debe dejar resultado, puntos o version parciales.");
    // Positive control: the very same valid payload and version can be saved by
    // the owner. A malformed fixture must not make the rejection pass vacuously.
    await authenticate(controller, owner);
    const saved = (await privateQuery(controller, "select app_dev.save_group_match_result($1,$2,$3,$4::jsonb) as result",
      [matchId, sportingGroup, version, input], "Control positivo del resultado")).rows[0].result;
    assert.equal(saved.first_finished, true);
    assert.equal(saved.result_version, version + 1);
    await privateQuery(controller, "reset role");
    const finished = await sportingState(controller);
    assert.equal(finished.history.length, 10);
    assert.deepEqual(finished.players.map((player) => Number(player.current_rating)), [...Array(5).fill(1010), ...Array(5).fill(990)]);
    assert.equal(finished.result.length, 1);
    assert.equal(finished.result[0].mvp_player_id, id(20));
  } finally {
    await privateQuery(controller, "reset role; rollback");
    if (pending) await pending.promise;
    await privateQuery(worker, "reset role");
  }
  console.log("PostgreSQL 17: permiso revocado durante lock real rechazado sin escrituras parciales; control positivo valido.");
}

async function newPhotoWhileRetiring(controller, worker, pids) {
  await authenticate(controller, owner);
  const reservation = (await privateQuery(controller, "select app_dev.reserve_group_player_photo($1,$2,$3) as result",
    [photoGroup, photoPlayer, id(91)], "Reservar foto sintetica")).rows[0].result;
  assert.equal(reservation.path, `app_dev/${photoGroup}/${photoPlayer}/${id(91)}.webp`);
  await privateQuery(controller, "insert into storage.objects(bucket_id,name,owner) values($1,$2,$3)", [bucket, reservation.path, owner], "Aceptar metadata de upload sintetico");
  await privateQuery(controller, "reset role");
  const cutoff = "2001-01-01T00:00:00.000Z";
  const candidate = (await privateQuery(controller, `select photo_path,
    not exists(select 1 from app_dev.players where organization_id=$1 and greatest(created_at,updated_at,photo_updated_at)>$2::timestamptz)
    and not exists(select 1 from app_dev.matches where organization_id=$1 and greatest(created_at,updated_at)>$2::timestamptz) as inactive
    from app_dev.players where id=$3`, [photoGroup, cutoff, photoPlayer])).rows[0];
  assert.deepEqual(candidate, { photo_path: oldPhoto, inactive: true }, "La foto vieja debe ser elegible antes de la carrera.");
  await authenticate(worker, null, "service_role");
  let pending;
  try {
    await holdGroup(controller, photoGroup);
    pending = observeQuery(privateQuery(worker, "select app_dev.retire_group_player_photo($1,$2,$3,$4::timestamptz) as retired",
      [photoPlayer, photoGroup, oldPhoto, cutoff], "Retirar foto durante finalizacion"));
    await waitForDatabaseLock(controller, pids.controller, pids.worker, pending);
    await authenticate(controller, owner);
    const finalized = (await privateQuery(controller, "select app_dev.finalize_group_player_photo($1,$2,$3) as result",
      [photoGroup, photoPlayer, reservation.reservation_id], "Finalizar foto durante lock observado")).rows[0].result;
    assert.equal(finalized.path, reservation.path);
    assert.equal(finalized.previous_path, oldPhoto);
    await privateQuery(controller, "reset role; commit");
    const outcome = await pending.promise;
    assert.equal(outcome.ok, true, "La retencion debe completar con un CAS perdido, sin error incidental.");
    assert.equal(outcome.result.rows[0].retired, false, "La retencion obsoleta debe perder contra la foto nueva.");
    const player = (await privateQuery(controller, "select photo_path,photo_updated_at=$2::timestamptz as exact_timestamp from app_dev.players where id=$1", [photoPlayer, finalized.updated_at])).rows[0];
    assert.equal(player.photo_path, reservation.path);
    assert.equal(player.exact_timestamp, true);
    assert.deepEqual((await privateQuery(controller, "select status from app_dev_private.photo_upload_reservations where id=$1", [reservation.reservation_id])).rows, [{ status: "linked" }]);
    const jobs = (await privateQuery(controller, `select object_path,completed_at is not null as completed,last_error,lease_token
      from app_dev_private.media_cleanup_jobs where object_path=any($1::text[]) order by object_path`, [[oldPhoto, reservation.path]])).rows;
    assert.deepEqual(jobs, [
      { object_path: oldPhoto, completed: false, last_error: null, lease_token: null },
      { object_path: reservation.path, completed: true, last_error: "linked", lease_token: null }
    ], "Solo la foto vieja puede quedar en la cola; la nueva debe seguir vinculada.");
    assert.equal((await privateQuery(controller, "select count(*)::int as count from storage.objects where bucket_id=$1 and name=any($2::text[])", [bucket, [oldPhoto, reservation.path]])).rows[0].count, 2);
    assert.equal((await privateQuery(controller, "select count(*)::int as count from app_dev.player_photo_upload_events where target_player_id=$1", [photoPlayer])).rows[0].count, 1,
      "La retencion obsoleta debe conservar el consumo del upload nuevo.");
    // Positive control: once the caller supplies the current path and an
    // eligible activity cutoff, retirement really clears and queues that path.
    const control = await privateQuery(worker, "select app_dev.retire_group_player_photo($1,$2,$3,clock_timestamp()) as retired", [photoPlayer, photoGroup, reservation.path]);
    assert.equal(control.rows[0].retired, true);
    assert.equal((await privateQuery(controller, "select photo_path from app_dev.players where id=$1", [photoPlayer])).rows[0].photo_path, null);
    assert.deepEqual((await privateQuery(controller, "select completed_at is not null as completed,last_error from app_dev_private.media_cleanup_jobs where object_path=$1", [reservation.path])).rows,
      [{ completed: false, last_error: null }]);
  } finally {
    await privateQuery(controller, "reset role; rollback");
    if (pending) await pending.promise;
    await privateQuery(worker, "reset role");
  }
  console.log("PostgreSQL 17: foto finalizada durante lock real conserva metadata, reserva y cuota; retencion obsoleta pierde y control positivo retira.");
}

async function runSyntheticScenario(config, sources, failAfterSchema) {
  const controller = new pg.Client(config), worker = new pg.Client(config);
  let ownedResourcesCreated = false, controllerConnected = false, workerConnected = false;
  // Never print driver notices/errors containing private query bodies.
  controller.on("error", () => {}); worker.on("error", () => {});
  try {
    await connectPrivate(controller); controllerConnected = true;
    await claimEmptyDatabase(controller);
    await privateQuery(controller, "begin");
    await privateQuery(controller, syntheticBootstrap, [], "Bootstrap auth/storage sintetico");
    await privateQuery(controller, "commit"); ownedResourcesCreated = true;
    // Canonical sources may contain their own BEGIN/COMMIT. Record ownership
    // before applying them so even a partially failed source is cleaned up.
    for (const name of ["schema.app_dev.sql", "policies.app_dev.sql", "policies.storage.sql"]) {
      await privateQuery(controller, sources[name], [], `Aplicar ${name} acreditado`);
      if (failAfterSchema && name === "schema.app_dev.sql") {
        // This canonical source has already executed its own COMMIT. A real
        // PostgreSQL error here must clean even those committed DDL resources.
        await privateQuery(controller, "select 1/0", [], CLEANUP_SENTINEL);
      }
    }
    await privateQuery(controller, "begin");
    await seedFixtures(controller);
    await privateQuery(controller, "commit");
    await connectPrivate(worker); workerConnected = true;
    const pids = {
      controller: (await privateQuery(controller, "select pg_backend_pid() as pid")).rows[0].pid,
      worker: (await privateQuery(worker, "select pg_backend_pid() as pid")).rows[0].pid
    };
    assert.notEqual(pids.controller, pids.worker, "Las carreras requieren dos conexiones PostgreSQL independientes.");
    await revokeWhileWaiting(controller, worker, pids);
    await newPhotoWhileRetiring(controller, worker, pids);
  } finally {
    // Teardown must still run if closing the second connection fails.
    let shutdownFailure;
    if (workerConnected) {
      try { await worker.end(); }
      catch { shutdownFailure = new Error("No se pudo cerrar la conexion worker sintetica; diagnostico privado omitido."); }
    }
    try {
      if (ownedResourcesCreated) await cleanupSyntheticDatabase(controller);
      else if (controllerConnected) await privateQuery(controller, "reset role; rollback");
    } finally {
      if (controllerConnected) {
        try { await controller.end(); }
        catch { shutdownFailure = new Error("No se pudo cerrar la conexion controladora sintetica; diagnostico privado omitido."); }
      }
    }
    if (shutdownFailure) throw shutdownFailure;
  }
}

async function assertFreshFromNewConnection(config) {
  const verifier = new pg.Client(config);
  verifier.on("error", () => {});
  let connected = false;
  try {
    await connectPrivate(verifier); connected = true;
    // A new session checks committed schemas, roles, functions and the advisory
    // lock after teardown; the previous session cannot hide uncommitted work.
    await claimEmptyDatabase(verifier);
  } finally {
    if (connected) {
      try { await verifier.end(); }
      catch { throw new Error("No se pudo cerrar la conexion verificadora sintetica; diagnostico privado omitido."); }
    }
  }
}

export async function checkPostgresConcurrency({ env = process.env, root = process.cwd() } = {}) {
  const config = localConcurrencyDatabase(env);
  const sources = buildSchemaSources(assertPrivateSqlSources(root), "app_dev");
  let inducedFailure;
  try { await runSyntheticScenario(config, sources, true); }
  catch (error) { inducedFailure = error; }
  assert.ok(inducedFailure instanceof PrivatePostgresError, "El control negativo debe provocar un error PostgreSQL real.");
  assert.equal(inducedFailure.label, CLEANUP_SENTINEL, "Una falla incidental de bootstrap o cleanup no acredita el control negativo.");
  assert.equal(inducedFailure.code, "22012", "El control negativo debe fallar exactamente por division por cero.");
  await assertFreshFromNewConnection(config);
  console.log("PostgreSQL 17: error real 22012 despues de schema confirmado; cleanup verificado desde una conexion nueva.");
  await runSyntheticScenario(config, sources, false);
  await assertFreshFromNewConnection(config);
  console.log("PostgreSQL 17: cleanup normal verificado desde una conexion nueva; base sintetica lista para repetir.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try { await checkPostgresConcurrency(); }
  catch (error) {
    console.error(error instanceof Error ? error.message : "Fallo la suite sintetica PostgreSQL; diagnostico privado omitido.");
    process.exitCode = 1;
  }
}
