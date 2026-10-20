import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { downloadArtifact } from "./lib/sql-artifact.mjs";
import { decodeUpgradeArtifact, validateUpgradeManifest } from "./lib/sql-upgrade-artifact.mjs";

const manifest = validateUpgradeManifest(JSON.parse(await readFile("config/sql-upgrade-manifest.json", "utf8")));
const sources = decodeUpgradeArtifact(await downloadArtifact(manifest, process.env), manifest);
for (const [name, source] of Object.entries(sources)) {
  const destination = path.join("supabase/upgrade-artifacts", name);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, source, "utf8");
}
console.log(`Upgrade privado restaurado sin sustituciones: ${manifest.revision}, SHA-256 ${manifest.sha256}.`);
