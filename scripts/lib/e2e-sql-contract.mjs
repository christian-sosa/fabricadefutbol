import { mkdir, readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { assertPrivateSqlSources } from "../check-private-sql.mjs";
import { buildSchemaSources } from "./schema-sql.mjs";
import { artifactConnection, encodeSources, validateManifest } from "./sql-artifact.mjs";

const HASH = /^[a-f0-9]{64}$/;
const FORMAT_VERSION = 1;
const providerManifest = JSON.parse(readFileSync(new URL("../../config/e2e-storage-provider-manifest.json", import.meta.url), "utf8"));
if (providerManifest.formatVersion !== 1 || !Array.isArray(providerManifest.triggers) || providerManifest.triggers.length !== 2 ||
    providerManifest.triggers.some((trigger) => !["protect_objects_delete", "update_objects_updated_at"].includes(trigger.name) || !HASH.test(trigger.sha256)) ||
    new Set(providerManifest.triggers.map((trigger) => trigger.name)).size !== 2) {
  throw new Error("El baseline revisado de triggers Supabase Storage es invalido.");
}
export const STORAGE_PROVIDER_TRIGGER_HASHES = Object.freeze(Object.fromEntries(providerManifest.triggers.map(({ name, sha256 }) => [name, sha256])));
const providerTriggerValues = Object.entries(STORAGE_PROVIDER_TRIGGER_HASHES).map(([name, hash]) => `('${name}','${hash}')`).join(",");

// This query reads catalog metadata only. Object owners and OIDs are deliberately
// omitted because the local verifier and Supabase have different identities.
// Every definition is hashed inside PostgreSQL; no SQL body or row data leaves it.
export const E2E_SQL_CONTRACT_QUERY = String.raw`
with provider_triggers(name,sha256) as (values ${providerTriggerValues}), storage_triggers as (
  select t.tgname,
    jsonb_build_object('definition',pg_catalog.pg_get_triggerdef(t.oid,false),'enabled',t.tgenabled,
      'functionSha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.pg_get_functiondef(t.tgfoid),'UTF8')),'hex')) definition
  from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid=t.tgrelid
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='storage' and c.relname='objects' and not t.tgisinternal
), managed_relations as (
  select c.*, n.nspname from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname in ('app_dev','app_dev_private') and c.relkind in ('r','p','v','m')
), managed_functions as (
  select p.*, n.nspname, l.lanname from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  join pg_catalog.pg_language l on l.oid=p.prolang
  where n.nspname in ('app_dev','app_dev_private','storage_private','public')
    and not (n.nspname='app_dev' and p.proname='get_e2e_sql_contract')
    and p.prokind in ('f','p')
), objects as (
  select 'schema:'||n.nspname object_key,
    jsonb_build_object('anonUsage',pg_catalog.has_schema_privilege('anon',n.oid,'USAGE'),
      'authenticatedUsage',pg_catalog.has_schema_privilege('authenticated',n.oid,'USAGE'),
      'serviceUsage',pg_catalog.has_schema_privilege('service_role',n.oid,'USAGE')) definition
  from pg_catalog.pg_namespace n where n.nspname in ('app_dev','app_dev_private','storage_private','public')
  union all
  select 'relation:'||nspname||'.'||relname object_key,
    jsonb_build_object('kind',relkind,'rls',relrowsecurity,'forceRls',relforcerowsecurity,
      'options',coalesce((select jsonb_agg(v order by v) from unnest(reloptions) v),'[]'::jsonb),
      'policies',coalesce((select jsonb_agg(p.polname order by p.polname) from pg_catalog.pg_policy p where p.polrelid=managed_relations.oid),'[]'::jsonb),
      'triggers',coalesce((select jsonb_agg(t.tgname order by t.tgname) from pg_catalog.pg_trigger t where t.tgrelid=managed_relations.oid and not t.tgisinternal),'[]'::jsonb),
      'columns',coalesce((select jsonb_agg(a.attname order by a.attname) from pg_catalog.pg_attribute a where a.attrelid=managed_relations.oid and a.attnum>0 and not a.attisdropped),'[]'::jsonb),
      'constraints',coalesce((select jsonb_agg(c.conname order by c.conname) from pg_catalog.pg_constraint c where c.conrelid=managed_relations.oid and c.contype<>'n'),'[]'::jsonb),
      'indexes',coalesce((select jsonb_agg(i.relname order by i.relname) from pg_catalog.pg_index x join pg_catalog.pg_class i on i.oid=x.indexrelid where x.indrelid=managed_relations.oid),'[]'::jsonb),
      'privileges',(select jsonb_object_agg(role_name,jsonb_build_object(
        'select',pg_catalog.has_table_privilege(role_name,managed_relations.oid,'SELECT'),
        'insert',pg_catalog.has_table_privilege(role_name,managed_relations.oid,'INSERT'),
        'update',pg_catalog.has_table_privilege(role_name,managed_relations.oid,'UPDATE'),
        'delete',pg_catalog.has_table_privilege(role_name,managed_relations.oid,'DELETE')))
        from unnest(array['anon','authenticated','service_role']) role_name)) definition
  from managed_relations
  union all
  select 'column:'||r.nspname||'.'||r.relname||'.'||a.attname,
    jsonb_build_object('type',pg_catalog.format_type(a.atttypid,a.atttypmod),
      'notNull',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,
      'default',pg_catalog.pg_get_expr(d.adbin,d.adrelid))
  from managed_relations r join pg_catalog.pg_attribute a on a.attrelid=r.oid
  left join pg_catalog.pg_attrdef d on d.adrelid=r.oid and d.adnum=a.attnum
  where a.attnum>0 and not a.attisdropped
  union all
  select 'function:'||nspname||'.'||proname||'('||pg_catalog.pg_get_function_identity_arguments(oid)||')',
    jsonb_build_object('language',lanname,'kind',prokind,'returns',pg_catalog.pg_get_function_result(oid),
      'source',btrim(replace(regexp_replace(prosrc,E'\r+\n',E'\n','g'),E'\r',E'\n')),
      'securityDefiner',prosecdef,'strict',proisstrict,'volatility',provolatile,
      'parallel',proparallel,'leakproof',proleakproof,
      'defaults',pg_catalog.pg_get_expr(proargdefaults,0),
      'config',coalesce((select jsonb_agg(v order by v) from unnest(proconfig) v),'[]'::jsonb),
      'anonExecute',pg_catalog.has_function_privilege('anon',oid,'EXECUTE'),
      'authenticatedExecute',pg_catalog.has_function_privilege('authenticated',oid,'EXECUTE'),
      'serviceExecute',pg_catalog.has_function_privilege('service_role',oid,'EXECUTE'))
  from managed_functions
  union all
  select 'function-family:'||nspname||'.'||proname,
    jsonb_agg(pg_catalog.pg_get_function_identity_arguments(oid) order by pg_catalog.pg_get_function_identity_arguments(oid))
  from managed_functions group by nspname,proname
  union all
  select 'storage-inventory:storage.objects',
    jsonb_build_object('policies',coalesce((select jsonb_agg(p.polname order by p.polname)
        from pg_catalog.pg_policy p where p.polrelid=c.oid),'[]'::jsonb),
      'triggers',coalesce((select jsonb_agg(t.tgname order by t.tgname) from storage_triggers t
        where not exists(select 1 from provider_triggers b where b.name=t.tgname
          and b.sha256=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(t.definition::text,'UTF8')),'hex'))),'[]'::jsonb))
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='storage' and c.relname='objects'
  union all
  select 'provider-trigger:storage.objects.'||t.tgname,t.definition
  from storage_triggers t join provider_triggers b on b.name=t.tgname
  union all
  select 'enum:'||n.nspname||'.'||t.typname,
    jsonb_agg(e.enumlabel order by e.enumsortorder)
  from pg_catalog.pg_type t join pg_catalog.pg_namespace n on n.oid=t.typnamespace
  join pg_catalog.pg_enum e on e.enumtypid=t.oid
  where n.nspname in ('app_dev','app_dev_private') group by n.nspname,t.typname
  union all
  select 'constraint:'||r.nspname||'.'||r.relname||'.'||c.conname,
    jsonb_build_object('definition',pg_catalog.pg_get_constraintdef(c.oid,false),'validated',c.convalidated)
  from managed_relations r join pg_catalog.pg_constraint c on c.conrelid=r.oid
  where c.contype <> 'n' -- PostgreSQL 18 adds NOT NULL constraints; column metadata already checks them.
  union all
  select 'index:'||r.nspname||'.'||r.relname||'.'||i.relname,
    jsonb_build_object('definition',pg_catalog.pg_get_indexdef(i.oid),'valid',x.indisvalid,'ready',x.indisready)
  from managed_relations r join pg_catalog.pg_index x on x.indrelid=r.oid
  join pg_catalog.pg_class i on i.oid=x.indexrelid
  union all
  select 'view:'||nspname||'.'||relname,to_jsonb(pg_catalog.pg_get_viewdef(oid,false))
  from managed_relations where relkind in ('v','m')
  union all
  select 'policy:'||n.nspname||'.'||c.relname||'.'||p.polname,
    jsonb_build_object('command',p.polcmd,'permissive',p.polpermissive,
      'roles',(select jsonb_agg(case when role_id=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(role_id)::text end
        order by case when role_id=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(role_id)::text end) from unnest(p.polroles) role_id),
      'using',pg_catalog.pg_get_expr(p.polqual,p.polrelid),'check',pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid))
  from pg_catalog.pg_policy p join pg_catalog.pg_class c on c.oid=p.polrelid
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname in ('app_dev','app_dev_private') or (n.nspname='storage' and c.relname='objects')
  union all
  select 'trigger:'||n.nspname||'.'||c.relname||'.'||t.tgname,
    jsonb_build_object('definition',pg_catalog.pg_get_triggerdef(t.oid,false),'enabled',t.tgenabled)
  from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid=t.tgrelid
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where not t.tgisinternal and (n.nspname in ('app_dev','app_dev_private') or (n.nspname='storage' and c.relname='objects'))
)
select jsonb_build_object('formatVersion',1,'objects',coalesce(jsonb_object_agg(object_key,
  pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(definition::text,'UTF8')),'hex')),'{}'::jsonb)) as contract
from objects`;

export function getE2eSqlContractProbeSql() {
  return `-- DEV-only read-only SQL metadata probe. No artifact revision is stamped here.
begin;
create or replace function app_dev.get_e2e_sql_contract()
returns jsonb language sql stable security invoker set search_path=pg_catalog
as $e2e_contract$
${E2E_SQL_CONTRACT_QUERY};
$e2e_contract$;
revoke all on function app_dev.get_e2e_sql_contract() from public, anon, authenticated;
grant execute on function app_dev.get_e2e_sql_contract() to service_role;
commit;
`;
}

export function validateSqlContract(contract) {
  if (!contract || contract.formatVersion !== FORMAT_VERSION || !contract.objects ||
      typeof contract.objects !== "object" || Array.isArray(contract.objects)) {
    throw new Error("Contrato SQL E2E invalido o incompatible.");
  }
  const entries = Object.entries(contract.objects);
  if (!entries.length || entries.length > 10_000 || entries.some(([key, hash]) =>
    !/^(schema|relation|column|function|function-family|storage-inventory|provider-trigger|enum|constraint|index|view|policy|trigger):/.test(key) ||
    typeof hash !== "string" || !HASH.test(hash))) {
    throw new Error("Las huellas del contrato SQL E2E son invalidas.");
  }
  return contract;
}

export function compareSqlContracts(expected, actual) {
  validateSqlContract(expected);
  validateSqlContract(actual);
  if (!HASH.test(expected.artifactSha256 ?? "")) throw new Error("Falta el hash canonico del contrato SQL E2E.");
  const missing = [], changed = [];
  for (const [key, hash] of Object.entries(expected.objects)) {
    if (!Object.hasOwn(actual.objects, key)) missing.push(key);
    else if (actual.objects[key] !== hash) changed.push(key);
  }
  if (missing.length || changed.length) {
    const details = [...missing.map((key) => `Falta ${key}`), ...changed.map((key) => `Difiere ${key}`)].slice(0, 12);
    throw new Error(`SQL DEV no coincide con el artefacto ${expected.artifactSha256}. ` +
      `${missing.length} objetos faltantes y ${changed.length} diferentes.\n${details.join("\n")}`);
  }
  return { artifactSha256: expected.artifactSha256, checkedObjects: Object.keys(expected.objects).length };
}

const BOOTSTRAP_SQL = `create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create schema storage;
create table auth.users(id uuid primary key,email text);
create table auth.mfa_factors(user_id uuid,status text);
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,updated_at timestamptz,created_at timestamptz,owner uuid);
alter table storage.objects enable row level security;
grant usage on schema auth,storage to anon,authenticated,service_role;
grant select on storage.objects to anon,authenticated;`;

export async function buildExpectedSqlContract(root = process.cwd()) {
  const sources = await assertPrivateSqlSources(root);
  const manifest = validateManifest(JSON.parse(await readFile(path.join(root, "config/sql-artifact-manifest.json"), "utf8")));
  if (encodeSources(sources).sha256 !== manifest.sha256) throw new Error("El manifiesto SQL cambio durante la verificacion E2E.");
  const generated = buildSchemaSources(sources, "app_dev");
  const db = new PGlite();
  try {
    await db.exec(BOOTSTRAP_SQL);
    for (const file of ["schema.app_dev.sql", "policies.app_dev.sql", "policies.storage.sql"]) {
      await db.exec(generated[file].replace("create extension if not exists pgcrypto;", ""));
    }
    await db.exec(getE2eSqlContractProbeSql());
    const { rows } = await db.query("select app_dev.get_e2e_sql_contract() as contract");
    const canonical = validateSqlContract(rows[0].contract);
    // The private bundle owns Storage policies and application triggers. These
    // two platform triggers have a separate, explicitly reviewed public baseline;
    // absent/redefined platform triggers and any extra application trigger fail.
    const providerObjects = Object.fromEntries(Object.entries(STORAGE_PROVIDER_TRIGGER_HASHES)
      .map(([name, hash]) => [`provider-trigger:storage.objects.${name}`, hash]));
    const expected = { ...canonical, objects: { ...canonical.objects, ...providerObjects }, artifactSha256: manifest.sha256 };
    const directory = path.join(root, "tmp/e2e-sql-contract");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "expected.json"), JSON.stringify(expected, null, 2) + "\n", "utf8");
    return expected;
  } catch (error) {
    // PostgreSQL errors can include private SQL bodies. Report only safe codes.
    const code = /^[A-Z0-9]{5}$/.test(error?.code ?? "") ? ` (${error.code})` : "";
    throw new Error(`No se pudo construir el contrato SQL canonico local${code}.`);
  } finally { await db.close(); }
}

export async function fetchInstalledSqlContract(env, fetcher = fetch) {
  if (env.NEXT_PUBLIC_SUPABASE_TARGET_ENV !== "development" || env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA_DEV !== "app_dev" ||
      (env.SUPABASE_TARGET_ENV && env.SUPABASE_TARGET_ENV !== "development")) {
    throw new Error("La verificacion SQL E2E requiere exclusivamente app_dev.");
  }
  const connection = artifactConnection({
    NEXT_PUBLIC_SUPABASE_URL_DEV: env.NEXT_PUBLIC_SUPABASE_URL_DEV,
    SUPABASE_SERVICE_ROLE_KEY_DEV: env.SUPABASE_SERVICE_ROLE_KEY_DEV
  });
  let response;
  try {
    response = await fetcher(`${connection.url}/rest/v1/rpc/get_e2e_sql_contract`, {
      method: "POST", headers: { ...connection.headers, "content-profile": "app_dev", "accept-profile": "app_dev", "content-type": "application/json" },
      body: "{}", redirect: "error", signal: AbortSignal.timeout(15_000)
    });
  } catch { throw new Error("No se pudo consultar el contrato SQL DEV."); }
  if (!response.ok) throw new Error(`No se pudo consultar el contrato SQL DEV (HTTP ${response.status}). Instala el probe DEV antes de ejecutar E2E.`);
  try { return validateSqlContract(await response.json()); }
  catch { throw new Error("El probe DEV devolvio un contrato SQL invalido."); }
}

export async function checkE2eSqlContract({ env, root = process.cwd(), fetcher = fetch }) {
  const expected = await buildExpectedSqlContract(root);
  const actual = await fetchInstalledSqlContract(env, fetcher);
  return compareSqlContracts(expected, actual);
}
