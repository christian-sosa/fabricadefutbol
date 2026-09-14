import { readE2eEnvironment, validateE2eEnvironment } from "./lib/e2e-env.mjs";

try {
  validateE2eEnvironment(readE2eEnvironment(process.env, process.argv[2] || ".env.test"));
  console.log("Entorno E2E verificado: app_dev, servidor local y usuario reservado.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "No se pudo validar el entorno E2E.");
  process.exitCode = 1;
}
