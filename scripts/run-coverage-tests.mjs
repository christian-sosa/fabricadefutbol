import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";

function run(script, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { stdio: "inherit", windowsHide: true });
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve(signal ? 1 : code ?? 1));
  });
}

const args = process.argv.slice(2);
if (args.some((arg) => /^(?:--no-coverage|--coverage(?:[.=]|$)|--config(?:=|$))/.test(arg))) {
  throw new Error("La cobertura completa no admite desactivarla ni reducir su alcance por CLI.");
}
await rm("coverage/coverage-summary.json", { force: true });
await rm("coverage/scope.json", { force: true });
const status = await run("node_modules/vitest/vitest.mjs", [
  "run", "--coverage", "--project", "unit", "--project", "integration", "--project", "ui", ...args
]);
process.exitCode = status;
if (status === 0) process.exitCode = await run("scripts/report-test-coverage.mjs", []);
