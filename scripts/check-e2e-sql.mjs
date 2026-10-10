import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { readE2eEnvironment, validateE2eEnvironment } from "./lib/e2e-env.mjs";
import { buildExpectedSqlContract, checkE2eSqlContract, getE2eSqlContractProbeSql } from "./lib/e2e-sql-contract.mjs";

try {
  const root = process.cwd();
  if (process.argv.includes("--write-probe")) {
    const directory = path.join(root, "tmp/e2e-sql-contract");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "install-probe.app_dev.sql"), getE2eSqlContractProbeSql(), "utf8");
    console.log("Probe DEV generado en tmp/e2e-sql-contract/install-probe.app_dev.sql; no se aplico SQL remoto.");
  } else if (process.argv.includes("--expected-only")) {
    const expected = await buildExpectedSqlContract(root);
    console.log(`Contrato SQL local construido: artefacto ${expected.artifactSha256}; ${Object.keys(expected.objects).length} objetos canonicos.`);
  } else {
    const result = await checkE2eSqlContract({ env: validateE2eEnvironment(readE2eEnvironment()), root });
    console.log(`SQL DEV coincide con el artefacto ${result.artifactSha256}; ${result.checkedObjects} objetos canonicos verificados.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "No se pudo verificar el contrato SQL E2E.");
  process.exitCode = 1;
}
