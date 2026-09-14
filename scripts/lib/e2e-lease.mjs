import { artifactConnection } from "./sql-artifact.mjs";

export async function fixtureLeaseRpc(action, token, env, fetcher = fetch) {
  if (!["acquire", "heartbeat", "release"].includes(action) || !/^[0-9a-f-]{36}$/.test(token)) throw new Error("Contrato de bloqueo E2E invalido.");
  if (env.NEXT_PUBLIC_SUPABASE_TARGET_ENV !== "development" || env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA_DEV !== "app_dev") throw new Error("El bloqueo E2E requiere app_dev.");
  const connection = artifactConnection({NEXT_PUBLIC_SUPABASE_URL_DEV: env.NEXT_PUBLIC_SUPABASE_URL_DEV, SUPABASE_SERVICE_ROLE_KEY_DEV: env.SUPABASE_SERVICE_ROLE_KEY_DEV});
  const response = await fetcher(`${connection.url}/rest/v1/rpc/${action}_e2e_fixture_lease`, {
    method: "POST", headers: {...connection.headers, "content-profile": "app_dev", "accept-profile": "app_dev", "content-type": "application/json"},
    body: JSON.stringify({p_token: token}), redirect: "error", signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error(`No se pudo ${action} el bloqueo E2E (HTTP ${response.status}).`);
  if (action === "release") return true;
  return (await response.json()) === true;
}

export function startLeaseHeartbeat(renew, onFailure, intervalMs = 30_000) {
  let stopped = false;
  let pending = Promise.resolve();
  let inFlight = false;
  const timer = setInterval(() => {
    if (stopped || inFlight) return;
    inFlight = true;
    pending = Promise.resolve().then(renew).then((alive) => {
      if (!alive && !stopped) throw new Error("Se perdio el bloqueo compartido E2E. La ejecucion fue detenida.");
    }).catch((error) => {
      if (!stopped) { stopped = true; clearInterval(timer); onFailure(error); }
    }).finally(() => { inFlight = false; });
  }, intervalMs);
  return async () => { stopped = true; clearInterval(timer); await pending; };
}
