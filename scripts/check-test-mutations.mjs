import { cp, mkdir, readFile, writeFile, symlink, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const root = process.cwd();
const scratchParent = path.resolve(root, "tmp");
const scratch = path.resolve(scratchParent, `test-mutations-${randomUUID()}`);
if (path.dirname(scratch) !== scratchParent) throw new Error("Directorio de mutaciones invalido.");
const cases = [
  {
    name: "invite-rate-limit",
    source: "src/app/invite/[token]/actions.ts",
    before: "if (!rateLimit.allowed)", after: "if (false && !rateLimit.allowed)", count: 1,
    assertion: "rechaza una invitación limitada antes de leer datos o modificar perfiles",
    tests: ["tests/unit/invite-acceptance-source.test.ts", "tests/integration/invite-security.test.ts"]
  },
  {
    name: "player-position-projection",
    source: "src/lib/queries/admin.ts",
    before: '.select("id, full_name, current_rating, initial_rank, skill_level, display_order, photo_path, photo_updated_at, preferred_position, secondary_position", { count: "exact" })',
    after: '.select("id, full_name, current_rating, initial_rank, skill_level, display_order, photo_path, photo_updated_at", { count: "exact" })', count: 1,
    assertion: "devuelve las posiciones guardadas con el SELECT que envía el cliente Supabase real",
    tests: ["tests/integration/admin-queries.test.ts"]
  },
  {
    name: "team-rating-difference",
    source: "src/lib/domain/team-generator.ts",
    before: "ratingDiff: option.ratingDiff", after: "ratingDiff: 0", count: 2,
    assertion: "finds a rare feasible large partition rather than depending on sampled separation luck",
    tests: ["tests/unit/team-generator.test.ts"]
  }
];
let completed = false;

function runTests(tests, label) {
  const reportPath = path.join(scratch, `${label}.json`);
  const result = spawnSync(process.execPath, [path.join(root, "node_modules/vitest/vitest.mjs"), "run", "--project", "unit", "--project", "integration", "--maxWorkers=2", "--reporter=default", "--reporter=json", `--outputFile.json=${reportPath}`, ...tests], {
    cwd: scratch, env: process.env, encoding: "utf8", windowsHide: true, maxBuffer: 10_000_000, timeout: 120_000
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (result.error || result.signal) throw new Error(`${label}: el runner no termino normalmente.`);
  let report;
  try { report = JSON.parse(readFileSync(reportPath, "utf8")); }
  catch { throw new Error(`${label}: falta el reporte estructurado de Vitest.`); }
  return {status: result.status, output, report};
}

function isAssertionFailure(message) {
  // Vitest's JSON reporter serializes rejects/toThrow assertion failures as
  // "Error: expected ..."; identify their assertion stack as well as the text.
  if (typeof message !== "string") return false;
  if (message.startsWith("AssertionError:")) return true;
  return message.startsWith("Error: expected ") &&
    /(?:_Assertion|node_modules[\\/]chai[\\/]|node_modules[\\/]@vitest[\\/]expect[\\/])/.test(message);
}

try {
  await mkdir(scratch, {recursive: true});
  for (const item of ["src", "tests/helpers", "tests/setup", "vitest.config.mts", "tsconfig.json", "package.json", ".nvmrc"]) {
    await cp(path.join(root, item), path.join(scratch, item), {recursive: true});
  }
  const testFiles = [...new Set(cases.flatMap((item) => item.tests))];
  for (const file of testFiles) {
    await mkdir(path.dirname(path.join(scratch, file)), {recursive: true});
    await cp(path.join(root, file), path.join(scratch, file));
  }
  await symlink(path.join(root, "node_modules"), path.join(scratch, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  const baseline = runTests(testFiles, "baseline");
  await writeFile(path.join(scratch, "baseline.log"), baseline.output);
  if (baseline.status !== 0 || !baseline.report.success || baseline.report.numTotalTests < 1 || baseline.report.numPassedTests !== baseline.report.numTotalTests) throw new Error(`Baseline invalido. Revisa ${path.relative(root, scratch)}/baseline.log.`);
  console.log("Baseline focalizado aprobado en copia aislada.");
  for (const item of cases) {
    const original = await readFile(path.join(root, item.source), "utf8");
    if (original.split(item.before).length - 1 !== item.count) throw new Error(`La mutacion ${item.name} requiere actualizar su edicion tras el refactor.`);
    const target = path.join(scratch, item.source);
    await writeFile(target, original.split(item.before).join(item.after));
    const result = runTests(item.tests, item.name);
    await writeFile(path.join(scratch, `${item.name}.log`), result.output);
    await writeFile(target, original);
    const failed = result.report.testResults.flatMap((suite) => suite.assertionResults).filter((test) => test.status === "failed");
    const targetFailed = failed.some((test) => test.title === item.assertion && test.failureMessages.some(isAssertionFailure));
    const assertionFailuresOnly = failed.length > 0 && failed.every((test) => test.failureMessages.length > 0 && test.failureMessages.every(isAssertionFailure));
    if (result.status !== 1 || !targetFailed || !assertionFailuresOnly || result.report.numRuntimeErrorTestSuites > 0 || result.report.unhandledErrors?.length) {
      throw new Error(`La mutacion ${item.name} no fue detectada por una assertion. Revisa ${path.relative(root, scratch)}/${item.name}.log.`);
    }
    console.log(`Detectada: ${item.name}.`);
  }
  console.log("Las tres regresiones fallan por expectativas de comportamiento; el proyecto original no fue modificado.");
  completed = true;
} finally {
  // The only link is our dependency junction; unlink it before recursive cleanup.
  // The validated scratch directory is always a direct child of this repo's tmp/.
  await rm(path.join(scratch, "node_modules"), {force: true, recursive: false}).catch(() => {});
  if (path.dirname(scratch) !== scratchParent) throw new Error("Limpieza de mutaciones fuera del directorio permitido.");
  if (completed) await rm(scratch, {recursive: true, force: true});
}
