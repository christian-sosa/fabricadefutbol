import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { artifactConnection, downloadArtifact, encodeSources, SQL_FILES, validateManifest } from "./sql-artifact.mjs";

export const UPGRADE_MIGRATIONS = {
  auditDevAdditive: "audit-migrations/dev-additive.sql",
  auditDevActivation: "audit-migrations/dev-activation.sql",
  auditProdAdditive: "audit-migrations/prod-additive.sql",
  auditProdActivation: "audit-migrations/prod-activation.sql",
  positionsPrerequisiteDev: "positions-prerequisites/app_dev.sql",
  positionsPrerequisiteProd: "positions-prerequisites/app_prod.sql",
  positionsDev: "positions-migrations/app_dev.sql",
  positionsProd: "positions-migrations/app_prod.sql"
};
export const UPGRADE_FILES = [
  ...["audit", "positions"].flatMap((release) => SQL_FILES.map((name) => `${release}-baseline/${name}`)),
  ...Object.values(UPGRADE_MIGRATIONS)
].sort();
export const MAX_UPGRADE_BYTES = 2_000_000;
const hash = (source) => createHash("sha256").update(source).digest("hex");
const sameKeys = (object, keys) => object && typeof object === "object" && !Array.isArray(object) && Object.keys(object).sort().join("\n") === [...keys].sort().join("\n");

export function encodeUpgradeSources(sources) {
  if (!sameKeys(sources, UPGRADE_FILES)) throw new Error("Fuentes de upgrade incompletas o inesperadas.");
  const normalized = Object.fromEntries(UPGRADE_FILES.map((name) => {
    if (typeof sources[name] !== "string" || sources[name].length < 100) throw new Error(`Fuente de upgrade incompleta: ${name}`);
    return [name, sources[name].replace(/\r+\n/g, "\n").replace(/\r/g, "\n")];
  }));
  const bytes = Buffer.from(JSON.stringify(normalized));
  if (bytes.length > MAX_UPGRADE_BYTES) throw new Error("El bundle de upgrades supera el limite permitido.");
  return { bytes, gzip: gzipSync(bytes), sha256: hash(bytes), fileSha256: Object.fromEntries(UPGRADE_FILES.map((name) => [name, hash(normalized[name])])) };
}

export function validateUpgradeManifest(manifest) {
  validateManifest(manifest);
  if (manifest.artifactKind !== "sql-upgrades" || !sameKeys(manifest.fileSha256, UPGRADE_FILES) || Object.values(manifest.fileSha256).some((value) => !/^[a-f0-9]{64}$/.test(value))) throw new Error("Manifiesto de upgrades invalido.");
  if (!sameKeys(manifest.baselines, ["audit", "positions"]) || !sameKeys(manifest.migrations, Object.keys(UPGRADE_MIGRATIONS))) throw new Error("Proveniencia de upgrades incompleta.");
  for (const baseline of Object.values(manifest.baselines)) validateManifest(baseline);
  for (const migration of Object.values(manifest.migrations)) {
    if (!/^\d{14}$/.test(migration.version ?? "") || !/^[a-z0-9_]{5,100}$/.test(migration.name ?? "")) throw new Error("Historia de migracion invalida.");
  }
  return manifest;
}

export function verifyUpgradeSources(sources, manifest) {
  validateUpgradeManifest(manifest);
  const encoded = encodeUpgradeSources(sources);
  if (encoded.sha256 !== manifest.sha256 || UPGRADE_FILES.some((name) => encoded.fileSha256[name] !== manifest.fileSha256[name])) throw new Error("El upgrade no coincide con los hashes de esta revision.");
  for (const release of ["audit", "positions"]) {
    const baseline = Object.fromEntries(SQL_FILES.map((name) => [name, sources[`${release}-baseline/${name}`]]));
    if (encodeSources(baseline).sha256 !== manifest.baselines[release].sha256) throw new Error(`Baseline historico incorrecto: ${release}`);
  }
  return JSON.parse(encoded.bytes.toString("utf8"));
}

export function decodeUpgradeArtifact(gzip, manifest) {
  let sources;
  try { sources = JSON.parse(gunzipSync(gzip, { maxOutputLength: MAX_UPGRADE_BYTES }).toString("utf8")); }
  catch { throw new Error("Artefacto privado de upgrades ilegible; contenido omitido."); }
  return verifyUpgradeSources(sources, manifest);
}

export function readUpgradeSources(root = process.cwd()) {
  const manifest = JSON.parse(readFileSync(path.join(root, "config/sql-upgrade-manifest.json"), "utf8"));
  const sources = Object.fromEntries(UPGRADE_FILES.map((name) => [name, readFileSync(path.join(root, "supabase/upgrade-artifacts", name), "utf8")]));
  return verifyUpgradeSources(sources, manifest);
}

export async function publishUpgradeArtifact(artifact, manifest, env, fetcher = fetch) {
  decodeUpgradeArtifact(artifact, manifest);
  const connection = artifactConnection(env);
  const response = await fetcher(`${connection.url}/storage/v1/object/${manifest.bucket}/${manifest.object}`, {
    method: "POST", headers: { ...connection.headers, "content-type": "application/gzip", "x-upsert": "false" }, body: artifact, signal: AbortSignal.timeout(30_000), redirect: "error"
  });
  if (!response.ok && ![400, 409].includes(response.status)) throw new Error(`Publicacion de upgrades rechazada (HTTP ${response.status}).`);
  decodeUpgradeArtifact(await downloadArtifact(manifest, env, fetcher), manifest);
}
