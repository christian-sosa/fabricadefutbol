import { execFileSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();

function git(args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

const trackedFiles = git(["ls-files"])
  .split(/\r?\n/)
  .map((file) => file.trim())
  .filter(Boolean)
  .map((file) => file.replace(/\\/g, "/"));

const forbiddenExtensions = new Set([".md", ".sql"]);
const forbiddenPrefixes = [
  "docs/",
  "ops/",
  "supabase/",
  "output/",
  "outputs/",
  "brand-assets/",
  "player-photo-import/",
  "tmp/",
  "public/players/"
];

const offenders = trackedFiles.filter((file) => {
  const extension = path.posix.extname(file).toLowerCase();
  return forbiddenExtensions.has(extension) || forbiddenPrefixes.some((prefix) => file.startsWith(prefix));
});

if (offenders.length > 0) {
  console.error("Guardrail de Git fallo: estos archivos no deben estar versionados:");
  for (const offender of offenders) {
    console.error(`- ${offender}`);
  }
  console.error("");
  console.error("Regla: no trackear .md, .sql, supabase/, output/, outputs/ ni artefactos privados.");
  console.error("Si ya se agregaron, quitalos del indice con git rm --cached o borralos antes de pushear.");
  process.exit(1);
}

console.log("Guardrails de Git OK.");
