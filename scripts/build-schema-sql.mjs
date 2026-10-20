import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildSchemaSources } from "./lib/schema-sql.mjs";

const schemaName = (process.argv[2] || process.env.APP_SCHEMA || "").trim();

if (!schemaName) {
  console.error("Uso: node scripts/build-schema-sql.mjs <schema_name>");
  process.exit(1);
}

if (!/^[a-z_][a-z0-9_]*$/i.test(schemaName)) {
  console.error("Schema invalido. Usa letras, numeros y guion bajo.");
  process.exit(1);
}

const root = process.cwd();
const schemaSqlPath = path.join(root, "supabase", "schema.sql");
const policiesSqlPath = path.join(root, "supabase", "policies.sql");
const matchWorkflowSqlPath = path.join(root, "supabase", "group-match-workflow.sql");
const outputDir = path.join(root, "supabase", "generated");

async function main() {
  const [schemaSqlRaw, policiesSqlRaw, matchWorkflowSqlRaw] = await Promise.all([
    readFile(schemaSqlPath, "utf8"),
    readFile(policiesSqlPath, "utf8"),
    readFile(matchWorkflowSqlPath, "utf8")
  ]);

  const generated = buildSchemaSources({ "schema.sql": schemaSqlRaw, "policies.sql": policiesSqlRaw, "group-match-workflow.sql": matchWorkflowSqlRaw }, schemaName);

  await mkdir(outputDir, { recursive: true });

  const outSchemaPath = path.join(outputDir, `schema.${schemaName}.sql`);
  const outPoliciesPath = path.join(outputDir, `policies.${schemaName}.sql`);
  const outStoragePoliciesPath = path.join(outputDir, "policies.storage.sql");

  await Promise.all([
    writeFile(outSchemaPath, generated[`schema.${schemaName}.sql`], "utf8"),
    writeFile(outPoliciesPath, generated[`policies.${schemaName}.sql`], "utf8"),
    writeFile(outStoragePoliciesPath, generated["policies.storage.sql"], "utf8")
  ]);

  console.log(`Generado: ${path.relative(root, outSchemaPath)}`);
  console.log(`Generado: ${path.relative(root, outPoliciesPath)}`);
  console.log(`Generado: ${path.relative(root, outStoragePoliciesPath)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
