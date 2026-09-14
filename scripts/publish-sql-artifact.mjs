import { readFile } from "node:fs/promises";
import { publishArtifact, validateManifest } from "./lib/sql-artifact.mjs";

if (!process.argv.includes("--publish")) throw new Error("La publicacion requiere --publish; ejecutala solo como parte de la release autorizada.");
const manifest = validateManifest(JSON.parse(await readFile("config/sql-artifact-manifest.json", "utf8")));
const artifact = await readFile(`tmp/sql-artifacts/${manifest.object}`);
await publishArtifact(artifact, manifest, process.env);
console.log(`Artefacto SQL inmutable publicado y verificado: ${manifest.sha256}.`);
