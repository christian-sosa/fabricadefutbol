import { readFileSync } from "node:fs";
import { assertSupportedRuntime } from "./lib/runtime.mjs";

try {
  assertSupportedRuntime(process.version, readFileSync(new URL("../.nvmrc", import.meta.url), "utf8").trim());
} catch (error) {
  console.error(error instanceof Error ? error.message : "No se pudo verificar el runtime de Node.");
  process.exitCode = 1;
}
