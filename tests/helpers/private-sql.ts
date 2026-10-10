/** Do not attach the PostgreSQL error: it can contain the entire ignored SQL source. */
export async function executePrivateSql(db: {exec: (source: string) => Promise<unknown>}, source: string, label: string) {
  try { await db.exec(source); }
  catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
    const message = error instanceof Error ? error.message.split(/\r?\n/)[0].slice(0, 240) : "Unknown SQL error";
    throw new Error(`Private SQL validation failed in ${label} (SQLSTATE ${code}): ${message}. Source and query omitted.`);
  }
}
import { existsSync } from "node:fs";

export function privateSqlAvailable(file: string, mode = process.env.FDF_TEST_MODE) {
  if (mode && mode !== "full" && mode !== "fast") throw new Error("Unknown private SQL test mode.");
  if (mode === "fast") return false;
  const present = existsSync(file);
  if (!present) throw new Error(`Missing mandatory private SQL artifact: ${file}. Restore this revision's verified bundle before complete tests; use test:fast only for explicit partial validation.`);
  return present;
}
