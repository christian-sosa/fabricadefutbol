import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(entries.map((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(file) : /\.(ts|tsx)$/.test(entry.name) ? [file] : [];
  }));
  return groups.flat();
}

const root = process.cwd();
const summary = JSON.parse(await readFile(path.join(root, "coverage/coverage-summary.json"), "utf8"));
const files = await sourceFiles(path.join(root, "src"));
const measured = Object.keys(summary).filter((file) => file !== "total");
const report = {
  scope: "selected-modules",
  sourceFiles: files.length,
  measuredFiles: measured.length,
  metrics: summary.total,
  measured: measured.map((file) => path.relative(root, file).replaceAll("\\", "/")).sort(),
  reviewRule: "Review reductions in coverage include, thresholds, assertions and executed suites. This percentage covers selected modules only."
};
await writeFile(path.join(root, "coverage/scope.json"), JSON.stringify(report, null, 2) + "\n");
console.log(`Cobertura seleccionada: ${report.measuredFiles} de ${report.sourceFiles} archivos TS/TSX de src. Los porcentajes representan esos modulos; detalle en coverage/scope.json.`);
