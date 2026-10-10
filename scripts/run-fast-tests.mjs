import { spawn } from "node:child_process";

console.log("Modo rapido: unitarios, UI e integraciones locales. Las suites SQL/upgrade se omiten explicitamente; esto no acredita un release. Usa npm run verify para la validacion completa.");
const child = spawn(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "--project", "unit", "--project", "integration", "--project", "ui", ...process.argv.slice(2)], {
  env: {...process.env, FDF_TEST_MODE: "fast"}, stdio: "inherit", windowsHide: true
});
child.once("error", () => { console.error("No se pudo iniciar la suite rapida."); process.exitCode = 1; });
child.once("exit", (code, signal) => { process.exitCode = signal ? 1 : code ?? 1; });
