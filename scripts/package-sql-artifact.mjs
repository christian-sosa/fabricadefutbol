import { mkdir, readFile, writeFile } from "node:fs/promises";
import { encodeSources, SQL_FILES } from "./lib/sql-artifact.mjs";

const revision = process.argv[2];
if (!/^[a-z0-9][a-z0-9_-]{4,100}$/.test(revision ?? "")) throw new Error("Uso: node scripts/package-sql-artifact.mjs <revision-de-migracion>");
const sources = Object.fromEntries(await Promise.all(SQL_FILES.map(async (name) => [name, await readFile(`supabase/${name}`, "utf8")])));
const artifact = encodeSources(sources);
const manifest = {formatVersion: 1, revision, sha256: artifact.sha256, bucket: "groups-sql-artifacts", object: `${artifact.sha256}.json.gz`};
await mkdir("config", {recursive: true});
await mkdir("tmp/sql-artifacts", {recursive: true});
await writeFile(`tmp/sql-artifacts/${manifest.object}`, artifact.gzip);
await writeFile("config/sql-artifact-manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Manifiesto generado. Artefacto privado: tmp/sql-artifacts/${manifest.object}. Publicar antes de ejecutar CI para esta revision.`);
