import { mkdir, readFile, writeFile } from "node:fs/promises";
import { decodeArtifact, downloadArtifact, SQL_FILES, validateManifest } from "./lib/sql-artifact.mjs";

const manifest = validateManifest(JSON.parse(await readFile("config/sql-artifact-manifest.json", "utf8")));
let artifact;
try { artifact = await downloadArtifact(manifest, process.env); }
catch (error) {
  if (!process.env.GROUPS_SQL_BUNDLE_GZIP_BASE64) throw error;
  // Transitional fallback is accepted only for the exact hash committed in this revision.
  artifact = Buffer.from(process.env.GROUPS_SQL_BUNDLE_GZIP_BASE64, "base64");
}
const sources = decodeArtifact(artifact, manifest);
await mkdir("supabase", { recursive: true });
for (const name of SQL_FILES) await writeFile(`supabase/${name}`, sources[name], "utf8");
console.log(`SQL privado verificado: ${manifest.revision}, SHA-256 ${manifest.sha256}.`);
