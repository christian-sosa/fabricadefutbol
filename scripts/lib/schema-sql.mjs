export function buildSchemaSources(sources, schemaName) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(schemaName)) throw new Error("Schema invalido.");
  const replaceSchema = (sql) => sql
    .replace(/\bpublic_private\b/g, `${schemaName}_private`)
    .replace(/\bcreate schema if not exists public\b/gi, `create schema if not exists ${schemaName}`)
    .replace(/'public\//g, `'${schemaName}/`)
    .replace(/set search_path = public\b/g, `set search_path = ${schemaName}, public`)
    .replace(/\bgrant usage on schema public\b/g, `grant usage on schema ${schemaName}`)
    .replace(/\bpublic\./g, `${schemaName}.`)
    .replace(/'public'/g, `'${schemaName}'`);
  const marker = "-- STORAGE POLICIES (GLOBAL)";
  const markerIndex = sources["policies.sql"].indexOf(marker);
  const core = markerIndex < 0 ? sources["policies.sql"] : sources["policies.sql"].slice(0, markerIndex).trimEnd() + "\n";
  const storage = markerIndex < 0 ? "" : sources["policies.sql"].slice(markerIndex).trimStart();
  return {
    [`schema.${schemaName}.sql`]: replaceSchema(`${sources["schema.sql"]}\n${sources["group-match-workflow.sql"]}`),
    [`policies.${schemaName}.sql`]: replaceSchema(core),
    "policies.storage.sql": storage
  };
}
