import { readFile } from "node:fs/promises";
import { publishUpgradeArtifact, validateUpgradeManifest } from "./lib/sql-upgrade-artifact.mjs";

if (!process.argv.includes("--publish")) throw new Error("La publicacion de upgrades requiere --publish como parte de la release autorizada.");
const manifest = validateUpgradeManifest(JSON.parse(await readFile("config/sql-upgrade-manifest.json", "utf8")));
await publishUpgradeArtifact(await readFile(`tmp/sql-artifacts/${manifest.object}`), manifest, process.env);
console.log(`Upgrade privado inmutable publicado y verificado: ${manifest.sha256}.`);
