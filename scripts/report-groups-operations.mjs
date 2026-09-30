import { createClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";
import { readAllRows } from "../src/lib/supabase/pagination.ts";

const DAY = 86_400_000;
const NUMERIC_OPTIONS = {
  "monthly-infrastructure-cost": "monthlyInfrastructureCost",
  "monthly-email-cost": "monthlyEmailCost",
  "monthly-email-count": "monthlyEmailCount",
  "monthly-support-minutes": "monthlySupportMinutes",
  "support-hourly-cost": "supportHourlyCost"
};

export function parseOperationsArguments(args) {
  const options = { help: false, envFile: null, costs: {} };
  const seen = new Set();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help") { options.help = true; continue; }
    const match = /^--([a-z-]+)(?:=(.*))?$/.exec(argument);
    if (!match || seen.has(match[1])) throw new Error("Argumentos inválidos.");
    const key = match[1];
    const value = match[2] ?? args[++index];
    if (!value || value.startsWith("--")) throw new Error("Falta un valor de configuración.");
    seen.add(key);
    if (key === "env-file") options.envFile = value;
    else if (key === "currency" && /^[A-Z]{3}$/.test(value)) options.costs.currency = value;
    else if (key in NUMERIC_OPTIONS && /^\d+(?:\.\d+)?$/.test(value) && Number.isFinite(Number(value))) {
      if (key === "monthly-email-count" && !Number.isSafeInteger(Number(value))) throw new Error("El conteo de emails debe ser entero.");
      options.costs[NUMERIC_OPTIONS[key]] = Number(value);
    } else throw new Error("Opción o valor inválido.");
  }
  if (["monthlyInfrastructureCost", "monthlyEmailCost", "supportHourlyCost"].some((key) => options.costs[key] !== undefined) && !options.costs.currency) {
    throw new Error("Indicá la moneda de los importes.");
  }
  return options;
}

export async function resolveOperationsConfiguration() {
  // Load after an explicitly selected env file, so env.ts snapshots the chosen public values.
  if (!["development", "production"].includes(process.env.NEXT_PUBLIC_SUPABASE_TARGET_ENV?.trim())) {
    throw new Error("Seleccioná explícitamente el entorno de Supabase.");
  }
  const env = await import("../src/lib/env.ts");
  const key = env.getSupabaseServiceRoleKey();
  if (!key) throw new Error("Falta la credencial operativa del entorno seleccionado.");
  return {
    target: env.getSupabaseTargetEnv(), schema: env.getSupabaseDbSchema(),
    url: env.getSupabaseUrl(), key,
    photosBucket: env.getPlayerPhotosBucket(), imagesBucket: env.getOrganizationImagesBucket()
  };
}

/** Only Storage list calls: no downloads, writes, signed URLs or object content. */
export async function listStorageObjects(storage, bucket, prefix) {
  const pending = [prefix];
  const visited = new Set();
  const objects = [];
  while (pending.length) {
    const folder = pending.pop();
    if (visited.has(folder)) continue;
    visited.add(folder);
    for (let offset = 0; ;) {
      const { data, error } = await storage.from(bucket).list(folder, {
        limit: 200, offset, sortBy: { column: "name", order: "asc" }
      });
      if (error) throw new Error("No se pudo consultar el inventario de Storage.");
      const page = data ?? [];
      if (!page.length) break;
      for (const item of page) {
        if (typeof item.name !== "string" || !item.name || /[\\/]/.test(item.name) || [".", ".."].includes(item.name)) {
          throw new Error("El inventario de Storage contiene una ruta inválida.");
        }
        const path = `${folder}/${item.name}`;
        if (item.id === null) pending.push(path);
        else objects.push({ bucket, path, size: item.metadata?.size });
      }
      // Continue to an empty page, including when the server applies a smaller cap.
      offset += page.length;
    }
  }
  return objects;
}

function emptyStorage() { return { objects: 0, playerPhotoObjects: 0, organizationImageObjects: 0, measuredBytes: 0, objectsWithUnknownSize: 0 }; }
function addObject(target, size, isOrganizationImage) {
  target.objects += 1;
  if (isOrganizationImage) target.organizationImageObjects += 1;
  else target.playerPhotoObjects += 1;
  const valid = (typeof size === "number" || typeof size === "string" && /^\d+$/.test(size)) && Number.isSafeInteger(Number(size)) && Number(size) >= 0;
  if (valid) target.measuredBytes += Number(size);
  else target.objectsWithUnknownSize += 1;
}
function storageReport(value) {
  return { ...value, bytes: value.objectsWithUnknownSize ? null : value.measuredBytes };
}
function rounded(value) { return Number(value.toFixed(4)); }

export function buildGroupsOperationsReport({ organizations, players, matches, objects, schema, target, now = new Date(), costs = {} }) {
  const cutoff = now.getTime() - 30 * DAY;
  const groups = new Map([...organizations].sort((a, b) => a.id.localeCompare(b.id)).map((organization, index) => [organization.id, {
    groupNumber: index + 1, archived: Boolean(organization.archived_at), players: 0, activePlayers: 0,
    playersWithPhoto: 0, finishedMatchesLast30Days: 0, storage: emptyStorage()
  }]));
  for (const player of players) {
    const group = groups.get(player.organization_id);
    if (!group) continue;
    group.players += 1;
    if (player.active) group.activePlayers += 1;
    if (player.photo_path) group.playersWithPhoto += 1;
  }
  for (const match of matches) {
    const finished = Date.parse(match.finished_at);
    if (match.status === "finished" && finished >= cutoff && finished <= now.getTime()) {
      const group = groups.get(match.organization_id);
      if (group) group.finishedMatchesLast30Days += 1;
    }
  }
  const storage = emptyStorage();
  const unattributed = emptyStorage();
  const seen = new Set();
  for (const object of objects) {
    const key = `${object.bucket}:${object.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const segments = object.path.split("/");
    const organizationId = segments[0] === schema
      ? segments[1] === "organizations" ? segments[2]?.replace(/\.webp$/, "") : segments[1]
      : segments[0];
    const isOrganizationImage = segments[0] === schema && segments[1] === "organizations";
    addObject(storage, object.size, isOrganizationImage);
    addObject(groups.get(organizationId)?.storage ?? unattributed, object.size, isOrganizationImage);
  }
  const rows = [...groups.values()].map((group) => ({ ...group, activeLast30Days: !group.archived && group.finishedMatchesLast30Days > 0, storage: storageReport(group.storage) }));
  const activeGroups = rows.filter((group) => group.activeLast30Days).length;
  const supportCost = costs.monthlySupportMinutes !== undefined && costs.supportHourlyCost !== undefined
    ? rounded(costs.monthlySupportMinutes / 60 * costs.supportHourlyCost) : null;
  const completeCosts = costs.monthlyInfrastructureCost !== undefined && costs.monthlyEmailCost !== undefined && supportCost !== null;
  const totalCost = completeCosts ? rounded(costs.monthlyInfrastructureCost + costs.monthlyEmailCost + supportCost) : null;
  const perActive = (value) => value !== null && value !== undefined && activeGroups ? rounded(value / activeGroups) : null;
  return {
    generatedAt: now.toISOString(), target, schema,
    activityWindow: { from: new Date(cutoff).toISOString(), to: now.toISOString(), days: 30, definition: "Grupo no archivado con al menos un partido terminado (finished_at) dentro de la ventana." },
    scope: "Lecturas paginadas, sin snapshot transaccional. Metadatos del esquema seleccionado; Storage bajo su prefijo y fotos legacy referidas por esos grupos. No incluye otros esquemas, tráfico, backups ni facturación del proveedor. Los números de grupo son ordinales del reporte, no identificadores.",
    totals: {
      groups: rows.length, activeGroups, archivedGroups: rows.filter((group) => group.archived).length,
      players: rows.reduce((sum, group) => sum + group.players, 0),
      activePlayers: rows.reduce((sum, group) => sum + group.activePlayers, 0),
      playersWithPhoto: rows.reduce((sum, group) => sum + group.playersWithPhoto, 0),
      finishedMatchesLast30Days: rows.reduce((sum, group) => sum + group.finishedMatchesLast30Days, 0),
      storage: storageReport(storage), unattributedStorage: storageReport(unattributed)
    },
    groups: rows,
    economics: {
      basis: "Importes mensuales y conteos aportados explícitamente, divididos por grupos activos en los últimos 30 días. No es una factura ni una atribución de costo individual.",
      currency: costs.currency ?? null,
      monthlyInfrastructureCost: costs.monthlyInfrastructureCost ?? null,
      monthlyEmailCost: costs.monthlyEmailCost ?? null,
      monthlyEmailCount: costs.monthlyEmailCount ?? null,
      monthlySupportMinutes: costs.monthlySupportMinutes ?? null,
      supportHourlyCost: costs.supportHourlyCost ?? null,
      monthlySupportCost: supportCost, monthlyOperatingCost: totalCost,
      monthlyOperatingCostPerActiveGroup: perActive(totalCost),
      monthlyInfrastructureCostPerActiveGroup: perActive(costs.monthlyInfrastructureCost),
      monthlyEmailCostPerActiveGroup: perActive(costs.monthlyEmailCost),
      monthlySupportCostPerActiveGroup: perActive(supportCost),
      monthlyEmailCountPerActiveGroup: perActive(costs.monthlyEmailCount),
      monthlySupportMinutesPerActiveGroup: perActive(costs.monthlySupportMinutes),
      missingInputs: [...Object.values(NUMERIC_OPTIONS)].filter((key) => costs[key] === undefined)
    }
  };
}

export async function collectGroupsOperationsReport({ client, configuration, now = new Date(), costs = {} }) {
  const cutoff = new Date(now.getTime() - 30 * DAY).toISOString();
  const [organizations, players, matches] = await Promise.all([
    readAllRows((from, to) => client.from("organizations").select("id, archived_at", { count: "exact" }).order("id").range(from, to)),
    readAllRows((from, to) => client.from("players").select("organization_id, active, photo_path", { count: "exact" }).order("id").range(from, to)),
    readAllRows((from, to) => client.from("matches").select("organization_id, status, finished_at", { count: "exact" }).eq("status", "finished").gte("finished_at", cutoff).lte("finished_at", now.toISOString()).order("id").range(from, to))
  ]);
  const organizationIds = new Set(organizations.map((organization) => organization.id));
  const legacyGroups = new Set(players.filter((player) => player.photo_path && organizationIds.has(player.organization_id) && player.photo_path.startsWith(`${player.organization_id}/`)).map((player) => player.organization_id));
  const objects = [
    ...await listStorageObjects(client.storage, configuration.photosBucket, configuration.schema),
    ...await listStorageObjects(client.storage, configuration.imagesBucket, `${configuration.schema}/organizations`)
  ];
  for (const organizationId of legacyGroups) {
    objects.push(...await listStorageObjects(client.storage, configuration.photosBucket, organizationId));
  }
  return buildGroupsOperationsReport({ organizations, players, matches, objects, schema: configuration.schema, target: configuration.target, now, costs });
}

async function main() {
  const options = parseOperationsArguments(process.argv.slice(2));
  if (options.help) {
    console.log("Reporte de sólo lectura, sin PII. Requiere Node 24.19+ y NEXT_PUBLIC_SUPABASE_TARGET_ENV explícito.\nUso: npm run ops:groups -- [--env-file ARCHIVO] [--currency ARS|USD] [--monthly-infrastructure-cost IMPORTE] [--monthly-email-cost IMPORTE] [--monthly-email-count CANTIDAD] [--monthly-support-minutes MINUTOS] [--support-hourly-cost IMPORTE]\nUsa las credenciales y buckets del selector existente; no escribe ni descarga archivos. Sin inputs, los costos/emails/soporte quedan sin datos.");
    return;
  }
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major !== 24 || minor < 19) throw new Error("Se requiere Node 24.19 o posterior de la rama 24.");
  if (options.envFile) process.loadEnvFile(options.envFile);
  const configuration = await resolveOperationsConfiguration();
  const client = createClient(configuration.url, configuration.key, {
    db: { schema: configuration.schema }, auth: { autoRefreshToken: false, persistSession: false }
  });
  console.log(JSON.stringify(await collectGroupsOperationsReport({ client, configuration, costs: options.costs }), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    // Provider errors can contain paths, IDs or secrets. Never serialize them.
    console.error("No se pudo generar el reporte. Revisá Node 24, argumentos, entorno seleccionado, credencial operativa y permisos de lectura. No se inició ninguna escritura.");
    process.exitCode = 1;
  });
}
