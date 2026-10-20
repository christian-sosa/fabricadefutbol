import { readE2eEnvironment, validateE2eEnvironment } from "./lib/e2e-env.mjs";
import { checkE2eSqlContract } from "./lib/e2e-sql-contract.mjs";

try {
  const env = validateE2eEnvironment(readE2eEnvironment(process.env, process.argv[2] || ".env.test"));
  const sql = await checkE2eSqlContract({ env });
  console.log(`Entorno E2E verificado: app_dev, servidor local, usuario reservado y ${sql.checkedObjects} objetos SQL del artefacto ${sql.artifactSha256}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "No se pudo validar el entorno E2E.");
  process.exitCode = 1;
}
