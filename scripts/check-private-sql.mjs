import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { encodeSources, SQL_FILES, validateManifest } from "./lib/sql-artifact.mjs";
import { readUpgradeSources } from "./lib/sql-upgrade-artifact.mjs";

export function assertPrivateSqlSources(root = process.cwd()) {
  const manifest = validateManifest(JSON.parse(readFileSync(path.join(root, "config/sql-artifact-manifest.json"), "utf8")));
  const sources = Object.fromEntries(SQL_FILES.map((name) => [name, readFileSync(path.join(root, "supabase", name), "utf8")]));
  const encoded = encodeSources(sources);
  if (encoded.sha256 !== manifest.sha256) throw new Error("Las fuentes SQL locales no coinciden con el manifiesto. Empaqueta y publica la revision exacta antes de verificarla.");
  return JSON.parse(encoded.bytes.toString("utf8"));
}

export function verifyPrivateSql(root = process.cwd(), { canonicalOnly = false } = {}) {
  if (process.env.FDF_TEST_MODE === "fast") throw new Error("La verificacion completa no admite FDF_TEST_MODE=fast. Usa test:fast para una validacion parcial explicita.");
  const sources = assertPrivateSqlSources(root);
  if (!canonicalOnly) readUpgradeSources(root);
  for (const schema of ["app_dev", "app_prod"]) {
    execFileSync(process.execPath, [path.join(root, "scripts/build-schema-sql.mjs"), schema], { cwd: root, stdio: "inherit", windowsHide: true });
  }
  return sources;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    verifyPrivateSql(process.cwd(), { canonicalOnly: process.argv.includes("--canonical-only") });
    console.log("SQL privado: hashes verificados y ambos entornos regenerados.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "No se pudo verificar el SQL privado.");
    process.exitCode = 1;
  }
}
