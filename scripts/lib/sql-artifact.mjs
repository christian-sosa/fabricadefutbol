import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";

export const SQL_FILES = ["schema.sql", "policies.sql", "group-match-workflow.sql"];
export const MAX_SQL_BYTES = 1_000_000;
export function encodeSources(sources) {
  const normalized = {};
  for (const name of SQL_FILES) {
    if (typeof sources[name] !== "string" || sources[name].length < 100) throw new Error(`Fuente SQL incompleta: ${name}`);
    // Some Windows tooling leaves CRCRLF. Collapse its CR run in one pass so
    // encoding already-normalized sources is idempotent on every platform.
    normalized[name] = sources[name].replace(/\r+\n/g, "\n").replace(/\r/g, "\n");
  }
  const bytes = Buffer.from(JSON.stringify(normalized));
  if (bytes.length > MAX_SQL_BYTES) throw new Error("El bundle SQL supera el limite permitido.");
  return { bytes, gzip: gzipSync(bytes), sha256: createHash("sha256").update(bytes).digest("hex") };
}
export function validateManifest(manifest) {
  if (manifest.formatVersion !== 1 || !/^[a-f0-9]{64}$/.test(manifest.sha256 ?? "") || !/^[a-z0-9][a-z0-9_-]{4,100}$/.test(manifest.revision ?? "") || manifest.bucket !== "groups-sql-artifacts" || manifest.object !== `${manifest.sha256}.json.gz`) throw new Error("Manifiesto SQL invalido.");
  return manifest;
}
export function decodeArtifact(gzip, manifest) {
  validateManifest(manifest);
  const source = JSON.parse(gunzipSync(gzip, { maxOutputLength: MAX_SQL_BYTES }).toString("utf8"));
  const normalized = encodeSources(source);
  if (normalized.sha256 !== manifest.sha256) throw new Error("El artefacto SQL no coincide con el hash de esta revision.");
  return JSON.parse(normalized.bytes.toString("utf8"));
}
export function artifactConnection(env) {
  const url = new URL(env.GROUPS_SQL_STORAGE_URL || env.NEXT_PUBLIC_SUPABASE_URL_DEV || "");
  if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co") || url.username || url.password) throw new Error("URL de storage SQL invalida.");
  const key = env.GROUPS_SQL_STORAGE_TOKEN || env.SUPABASE_SERVICE_ROLE_KEY_DEV;
  if (!key) throw new Error("Falta la credencial privada para el artefacto SQL.");
  return { url: url.origin, headers: { Authorization: `Bearer ${key}`, apikey: key } };
}
export async function downloadArtifact(manifest, env, fetcher = fetch) {
  validateManifest(manifest);
  const connection = artifactConnection(env);
  const response = await fetcher(`${connection.url}/storage/v1/object/authenticated/${manifest.bucket}/${manifest.object}`, {headers: connection.headers, signal: AbortSignal.timeout(30_000), redirect: "error"});
  if (!response.ok) throw new Error(`No se pudo obtener el artefacto SQL privado (HTTP ${response.status}).`);
  if (Number(response.headers.get("content-length")) > MAX_SQL_BYTES) throw new Error("Artefacto SQL demasiado grande.");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_SQL_BYTES) throw new Error("Artefacto SQL demasiado grande.");
  return bytes;
}

export async function publishArtifact(artifact, manifest, env, fetcher = fetch) {
  decodeArtifact(artifact, manifest);
  const connection = artifactConnection(env);
  const response = await fetcher(`${connection.url}/storage/v1/object/${manifest.bucket}/${manifest.object}`, {
    method: "POST", headers: {...connection.headers, "content-type": "application/gzip", "x-upsert": "false"}, body: artifact, signal: AbortSignal.timeout(30_000), redirect: "error"
  });
  if (!response.ok && ![400, 409].includes(response.status)) throw new Error(`Publicacion SQL rechazada (HTTP ${response.status}).`);
  // A retry may reuse an existing object only if its content is the expected immutable release.
  decodeArtifact(await downloadArtifact(manifest, env, fetcher), manifest);
}
