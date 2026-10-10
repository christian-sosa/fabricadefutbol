import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { encodeUpgradeSources, UPGRADE_FILES, validateUpgradeManifest, verifyUpgradeSources } from "./lib/sql-upgrade-artifact.mjs";

const [revision, inputPath] = process.argv.slice(2);
if (!/^[a-z0-9][a-z0-9_-]{4,100}$/.test(revision ?? "") || !inputPath) throw new Error("Uso: node scripts/package-sql-upgrade-artifact.mjs <revision> <descriptor-privado.json>");
const input = JSON.parse(await readFile(inputPath, "utf8"));
const sources = Object.fromEntries(await Promise.all(UPGRADE_FILES.map(async (name) => [name, await readFile(path.resolve(input.sources[name]), "utf8")])));
const artifact = encodeUpgradeSources(sources);
const manifest = validateUpgradeManifest({ formatVersion: 1, artifactKind: "sql-upgrades", revision, sha256: artifact.sha256, bucket: "groups-sql-artifacts", object: `${artifact.sha256}.json.gz`, fileSha256: artifact.fileSha256, baselines: input.baselines, migrations: input.migrations });
verifyUpgradeSources(sources, manifest);
await mkdir("config", { recursive: true });
await mkdir("tmp/sql-artifacts", { recursive: true });
await writeFile(`tmp/sql-artifacts/${manifest.object}`, artifact.gzip);
for (const name of UPGRADE_FILES) {
  const destination = path.join("supabase/upgrade-artifacts", name);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, sources[name], "utf8");
}
await writeFile("config/sql-upgrade-manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Upgrade privado empaquetado: ${manifest.revision}, SHA-256 ${manifest.sha256}. Publicar antes de CI.`);
