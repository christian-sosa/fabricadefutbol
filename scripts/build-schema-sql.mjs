import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

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
const outputDir = path.join(root, "supabase", "generated");

function replacePublicSchema(sql, targetSchema) {
  return sql
    .replace(/set search_path = public\b/g, `set search_path = ${targetSchema}, public`)
    .replace(/\bgrant usage on schema public\b/g, `grant usage on schema ${targetSchema}`)
    .replace(/\bpublic\./g, `${targetSchema}.`)
    .replace(/'public'/g, `'${targetSchema}'`);
}

function splitStoragePolicies(sql) {
  const marker = "create or replace function public.can_manage_player_photo_object";
  const markerIndex = sql.indexOf(marker);
  if (markerIndex < 0) {
    return { core: sql, storage: "" };
  }
  return {
    core: sql.slice(0, markerIndex).trimEnd() + "\n",
    storage: sql.slice(markerIndex).trimStart()
  };
}

async function main() {
  const [schemaSqlRaw, policiesSqlRaw] = await Promise.all([
    readFile(schemaSqlPath, "utf8"),
    readFile(policiesSqlPath, "utf8")
  ]);

  const { core: policiesCoreRaw, storage: storagePoliciesRaw } = splitStoragePolicies(policiesSqlRaw);
  const transformedSchema = replacePublicSchema(schemaSqlRaw, schemaName);
  const transformedPolicies = replacePublicSchema(policiesCoreRaw, schemaName);

  await mkdir(outputDir, { recursive: true });

  const outSchemaPath = path.join(outputDir, `schema.${schemaName}.sql`);
  const outPoliciesPath = path.join(outputDir, `policies.${schemaName}.sql`);
  const outStoragePoliciesPath = path.join(outputDir, "policies.storage.sql");

  await Promise.all([
    writeFile(outSchemaPath, transformedSchema, "utf8"),
    writeFile(outPoliciesPath, transformedPolicies, "utf8"),
    writeFile(outStoragePoliciesPath, storagePoliciesRaw, "utf8")
  ]);

  console.log(`Generado: ${path.relative(root, outSchemaPath)}`);
  console.log(`Generado: ${path.relative(root, outPoliciesPath)}`);
  console.log(`Generado: ${path.relative(root, outStoragePoliciesPath)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
