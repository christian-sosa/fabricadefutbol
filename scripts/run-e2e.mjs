import { randomUUID, createHash } from "node:crypto";
import { mkdir, open, readFile, unlink } from "node:fs/promises";
import { tmpdir, hostname } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { existsSync } from "node:fs";
import { readE2eEnvironment, validateE2eEnvironment } from "./lib/e2e-env.mjs";
import { fixtureLeaseRpc, startLeaseHeartbeat } from "./lib/e2e-lease.mjs";

const env = validateE2eEnvironment(readE2eEnvironment());
const lockKey = createHash("sha256").update(`${env.NEXT_PUBLIC_SUPABASE_URL_DEV}:fdf-e2e`).digest("hex").slice(0, 16);
const lockPath = path.join(tmpdir(), `fdf-e2e-${lockKey}.lock`);
const token = randomUUID();
let lock;
try { lock = await open(lockPath, "wx"); }
catch { throw new Error(`Ya hay una ejecucion E2E o un bloqueo pendiente: ${lockPath}. Verifica que su proceso termino antes de retirar el bloqueo.`); }
await lock.writeFile(JSON.stringify({pid: process.pid, hostname: hostname(), token, startedAt: new Date().toISOString()}));
await lock.close();
env.E2E_RUN_TOKEN = token;
env.E2E_RUN_LOCK_PATH = lockPath;
env.NEXT_PUBLIC_SUPABASE_TARGET_ENV = "development";
env.SUPABASE_TARGET_ENV = "development";
env.NODE_ENV = "production";
const args = process.argv.slice(2);
const requested = args.filter((arg) => arg.startsWith("--project=")).map((arg) => arg.slice(10));
const projects = requested.length ? requested : ["chromium", "mobile-chromium"];
const forwarded = args.filter((arg) => !arg.startsWith("--project="));
const abort = new AbortController();
let leaseHeld = false;
let leaseFailure;
let stopHeartbeat;
const interrupt = () => {
  leaseFailure = new Error("Ejecucion E2E interrumpida; se detiene el proceso antes de liberar el fixture.");
  abort.abort(leaseFailure);
};
process.once("SIGINT", interrupt);
process.once("SIGTERM", interrupt);
async function run(script, parameters) {
  if (leaseFailure) throw leaseFailure;
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...parameters], {env, stdio: "inherit", windowsHide: true, signal: abort.signal});
    // AbortError fires before the child has exited. Keep the shared lease until exit.
    child.once("error", (error) => { if (error.name !== "AbortError") reject(error); });
    child.once("exit", (code, signal) => code === 0 && !leaseFailure ? resolve() : reject(leaseFailure ?? new Error(`La validacion termino con ${signal || code}.`)));
  });
}
try {
  if (projects.some((project) => !["chromium", "mobile-chromium"].includes(project))) throw new Error("Proyecto E2E desconocido.");
  if (existsSync(".next/dev/lock")) throw new Error("Cierra next dev antes de compilar y validar E2E.");
  const base = new URL(env.E2E_BASE_URL);
  const occupied = await new Promise((resolve) => {
    const socket = createConnection({host: base.hostname.replace(/^\[|\]$/g, ""), port: Number(base.port)});
    socket.setTimeout(2_000, () => {socket.destroy(); resolve(false);});
    socket.once("connect", () => {socket.destroy(); resolve(true);});
    socket.once("error", () => resolve(false));
  });
  if (occupied) throw new Error("El puerto E2E esta ocupado. Cierra el servidor anterior antes de validar la version compilada.");
  leaseHeld = await fixtureLeaseRpc("acquire", token, env);
  if (!leaseHeld) throw new Error("Otra ejecucion local o CI esta usando el fixture compartido. Reintenta al terminar.");
  stopHeartbeat = startLeaseHeartbeat(() => fixtureLeaseRpc("heartbeat", token, env), (error) => {
    leaseFailure = error;
    abort.abort(error);
  });
  await mkdir("tmp/e2e", {recursive: true});
  await run("node_modules/next/dist/bin/next", ["build"]);
  for (const project of projects) {
    env.E2E_REPORT_PROJECT = project;
    await run("node_modules/@playwright/test/cli.js", ["test", `--project=${project}`, ...forwarded]);
    const identityPath = `tmp/e2e/identity-${token}.json`;
    try {
      const identity = JSON.parse(await readFile(identityPath, "utf8"));
      if (identity.token === token && identity.userId) env.E2E_ADMIN_USER_ID = identity.userId;
    } catch { /* Existing accredited identities require no handoff. */ }
  }
} finally {
  try {
    await stopHeartbeat?.();
    if (leaseHeld) await fixtureLeaseRpc("release", token, env);
  } finally {
    const current = JSON.parse(await readFile(lockPath, "utf8"));
    if (current.token === token) await unlink(lockPath);
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", interrupt);
  }
}
