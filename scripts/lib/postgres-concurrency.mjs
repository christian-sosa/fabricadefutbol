import { setTimeout as delay } from "node:timers/promises";

const DATABASE = "fdf_test_concurrency";
const ROLES = ["anon", "authenticated", "service_role"];
const ADVISORY_LOCK = [20260913, 1702];

/** Parse explicitly: libpq URL options must never override the loopback host. */
export function localConcurrencyDatabase(env = process.env) {
  let url;
  try { url = new URL(env.TEST_DATABASE_URL || ""); }
  catch { throw new Error("TEST_DATABASE_URL debe identificar la base local aislada fdf_test_concurrency."); }
  if (!["postgres:", "postgresql:"].includes(url.protocol)
    || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
    || url.pathname !== `/${DATABASE}` || url.search || url.hash || !url.username) {
    throw new Error("Concurrencia SQL requiere loopback, fdf_test_concurrency y una URL sin opciones adicionales.");
  }
  if (env.FDF_TEST_MODE === "fast") throw new Error("La concurrencia PostgreSQL no admite una validacion parcial.");
  let user, password;
  try { user = decodeURIComponent(url.username); password = decodeURIComponent(url.password); }
  catch { throw new Error("Credenciales locales invalidas; contenido omitido."); }
  return {
    host: url.hostname === "[::1]" ? "::1" : url.hostname,
    port: Number(url.port || 5432), database: DATABASE, user, password,
    ssl: false, connectionTimeoutMillis: 5_000, statement_timeout: 12_000,
    query_timeout: 15_000, idle_in_transaction_session_timeout: 12_000,
    application_name: "fdf-synthetic-concurrency"
  };
}

/** PostgreSQL diagnostics can include an entire ignored SQL function body. */
export class PrivatePostgresError extends Error {
  constructor(label, error) {
    const code = error && typeof error.code === "string" && /^[A-Z0-9]{5}$/.test(error.code) ? error.code : "unknown";
    super(`${label} fallo (SQLSTATE ${code}); consulta y fuente privadas omitidas.`);
    this.code = code;
    this.label = label;
  }
}

export function assertLoopbackSocket(address) {
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address)) {
    throw new Error("El socket PostgreSQL debe conectar al endpoint TCP loopback local.");
  }
}

export async function privateQuery(client, text, values = [], label = "Consulta privada") {
  try { return await client.query(text, values); }
  catch (error) { throw new PrivatePostgresError(label, error); }
}

/** Recovery must be its own command: an aborted transaction rejects RESET. */
export async function rollbackThenReset(client) {
  await privateQuery(client, "rollback", [], "Rollback de transaccion sintetica");
  await privateQuery(client, "reset role", [], "Restaurar rol sintetico");
}

// Only this module creates this class, exclusively from already sanitized
// diagnostic messages. Nested recovery must preserve those earlier SQLSTATEs.
class CombinedPrivateFailure extends Error {}

export async function preserveFailureDuringCleanup(operation, cleanup) {
  let value, primary, failed = false;
  try { value = await operation(); }
  catch (error) { primary = error; failed = true; }
  try { await cleanup(); }
  catch (cleanupError) {
    if (!failed) throw cleanupError;
    const safe = (error) => error instanceof PrivatePostgresError || error instanceof CombinedPrivateFailure
      ? error.message : "Error no SQL; diagnostico omitido.";
    // Keep both SQLSTATE/operation labels without attaching raw errors, query
    // bodies, cause or provider diagnostics to the combined exception.
    throw new CombinedPrivateFailure(`Fallo original: ${safe(primary)} Cleanup adicional: ${safe(cleanupError)}`);
  }
  if (failed) throw primary;
  return value;
}

export async function connectPrivate(client) {
  let connected = false;
  try {
    await client.connect(); connected = true;
    // Docker forwards loopback to a container interface. Validate our TCP peer,
    // rather than inet_server_addr() inside that container.
    assertLoopbackSocket(client.connection.stream.remoteAddress);
  } catch (error) {
    if (connected) await client.end().catch(() => {});
    throw new PrivatePostgresError("Conexion a PostgreSQL local", error);
  }
}

export async function claimEmptyDatabase(client) {
  assertLoopbackSocket(client.connection.stream.remoteAddress);
  const info = (await privateQuery(client, `select current_database() as database,
    current_setting('server_version_num')::int as version`)).rows[0];
  if (info.database !== DATABASE || info.version < 170000 || info.version >= 180000) {
    throw new Error("El servidor debe ser PostgreSQL 17 local en la base fdf_test_concurrency.");
  }
  const lock = (await privateQuery(client, "select pg_try_advisory_lock($1,$2) as acquired", ADVISORY_LOCK)).rows[0];
  if (!lock.acquired) throw new Error("Otra ejecucion ya posee la base sintetica de concurrencia.");
  const state = await databaseObjectState(client);
  if (Object.values(state).some((value) => value !== 0)) {
    throw new Error("La suite exige una base vacia y roles sinteticos inexistentes; no modifico datos preexistentes.");
  }
}

async function databaseObjectState(client) {
  return (await privateQuery(client, `select
    (select count(*)::int from pg_namespace where nspname !~ '^pg_' and nspname not in ('public','information_schema')) as schemas,
    (select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public') as relations,
    (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public') as functions,
    (select count(*)::int from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public') as types,
    (select count(*)::int from pg_roles where rolname=any($1::text[])) as roles`, [ROLES])).rows[0];
}

export const syntheticBootstrap = `
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; create schema storage;
  create table auth.users(id uuid primary key,email text);
  create table auth.mfa_factors(user_id uuid,status text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('aal',current_setting('test.aal',true)) $$;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,
    updated_at timestamptz default clock_timestamp(),created_at timestamptz default clock_timestamp(),owner uuid);
  alter table storage.objects enable row level security;
  grant usage on schema auth,storage to anon,authenticated,service_role;
  grant select on storage.objects to anon,authenticated;
  grant insert,update,delete on storage.objects to authenticated;
  grant select,insert,update on storage.objects to service_role;
`;

export async function authenticate(client, userId, role = "authenticated") {
  if (!["authenticated", "service_role"].includes(role)) throw new Error("Rol sintetico invalido.");
  await privateQuery(client, "reset role");
  await privateQuery(client, "select set_config('test.uid',$1,false),set_config('test.aal','aal1',false)", [userId ?? ""]);
  await privateQuery(client, `set role ${role}`);
}

/** Resolve the worker immediately on either outcome; no unhandled DB rejection. */
export function observeQuery(promise) {
  const observation = { settled: false, outcome: null, promise: null };
  observation.promise = promise.then(
    (result) => ({ ok: true, result }), (error) => ({ ok: false, error })
  ).then((outcome) => { observation.settled = true; observation.outcome = outcome; return outcome; });
  return observation;
}

export async function waitForDatabaseLock(controller, controllerPid, workerPid, observation) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (observation.settled) throw new Error("La operacion termino antes de observar el lock real esperado.");
    const row = (await privateQuery(controller, `select wait_event_type,
      $1::int=any(pg_blocking_pids(pid)) as blocked_by_controller
      from pg_stat_activity where pid=$2`, [controllerPid, workerPid], "Observar lock real")).rows[0];
    if (row?.wait_event_type === "Lock" && row.blocked_by_controller) return;
    await delay(25);
  }
  throw new Error("No se observo un bloqueo PostgreSQL real dentro del plazo de la carrera.");
}

/** Only callable after the empty-database guard and a committed bootstrap. */
export async function cleanupSyntheticDatabase(client) {
  await rollbackThenReset(client);
  await privateQuery(client, "set statement_timeout='5000ms'; set lock_timeout='2000ms'", [], "Preparar cleanup sintetico");
  await privateQuery(client, `begin;
    drop schema if exists app_dev_private,app_dev,auth,storage_private,storage cascade;
    drop extension if exists pgcrypto cascade;
    -- The template's public schema and ACL existed before the suite. Preserve
    -- them; the empty-database guard proved every function here is ours.
    do $$ declare target text; begin
      for target in select format('%I.%I(%s)',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid))
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
      loop execute 'drop function if exists '||target||' cascade'; end loop;
    end $$;
    drop owned by anon,authenticated,service_role;
    drop role anon; drop role authenticated; drop role service_role;
    commit;`, [], "Cleanup de la base sintetica");
  if (Object.values(await databaseObjectState(client)).some((value) => value !== 0)) {
    throw new Error("El cleanup no devolvio la base sintetica al estado vacio; no acredita una ejecucion repetible.");
  }
}
