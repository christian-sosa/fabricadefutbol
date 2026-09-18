import { readFile, writeFile } from "node:fs/promises";

import { getSupabaseDbSchema, getSupabaseServiceRoleKey, getSupabaseUrl } from "../../src/lib/env";
import { loadEnvFile } from "../helpers/load-env-file";
import { E2E_ORGANIZATION_ID, E2E_PLAYER_IDS } from "./test-data";
import { createFixtureClient, resolveFixtureUser } from "../helpers/e2e-fixture-identity";
import { fixtureLeaseRpc } from "../../scripts/lib/e2e-lease.mjs";

loadEnvFile(".env.test");

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Falta ${name} en .env.test para correr Playwright.`);
  }
  return value;
}

function createServiceClient() {
  if (getSupabaseDbSchema() !== "app_dev") throw new Error("E2E solo puede preparar app_dev.");
  const serviceRoleKey = getSupabaseServiceRoleKey();
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY_DEV es obligatoria para preparar el entorno E2E.");
  }

  return createFixtureClient(getSupabaseUrl(), serviceRoleKey);
}

async function ensureOrganization(client: ReturnType<typeof createServiceClient>, adminId: string) {
  const slug = requireEnv("E2E_ORG_SLUG");
  const name = process.env.E2E_ORG_NAME?.trim() || "Organizacion E2E";

  const { data: existing, error: existingError } = await client
    .from("organizations")
    .select("id, created_by")
    .eq("slug", slug)
    .maybeSingle();
  if (existingError) throw existingError;

  const organizationId = existing?.id ?? E2E_ORGANIZATION_ID;
  if (existing && (existing.id !== E2E_ORGANIZATION_ID || existing.created_by !== adminId)) {
    throw new Error("El grupo E2E existente no pertenece al fixture autorizado.");
  }

  const { error: orgError } = await client.from("organizations").upsert(
    {
      id: organizationId,
      name,
      slug,
      is_public: true,
      created_by: adminId
    },
    { onConflict: "id" }
  );
  if (orgError) throw orgError;

  const { error: adminLinkError } = await client.from("organization_admins").upsert(
    {
      organization_id: organizationId,
      admin_id: adminId,
      created_by: adminId
    },
    { onConflict: "organization_id,admin_id" }
  );
  if (adminLinkError) throw adminLinkError;

  return organizationId;
}

async function cleanupOrganizationMatches(
  client: ReturnType<typeof createServiceClient>,
  organizationId: string
) {
  // Foreign keys cascade all match children in one transaction, without a 1,000-row read cap.
  await client.from("matches").delete().eq("organization_id", organizationId).throwOnError();
  const {count} = await client.from("matches").select("id", {count: "exact", head: true})
    .eq("organization_id", organizationId).throwOnError();
  if (count !== 0) throw new Error("La limpieza del fixture dejo partidos pendientes.");
}

async function seedPlayers(client: ReturnType<typeof createServiceClient>, organizationId: string) {
  const rows = E2E_PLAYER_IDS.map((id, index) => ({
    id,
    organization_id: organizationId,
    full_name: `E2E Jugador ${index + 1}`,
    initial_rank: index + 1,
    current_rating: 1000,
    active: true,
    is_injured: false,
    notes: "e2e"
  }));

  const { error } = await client.from("players").upsert(rows, { onConflict: "id" });
  if (error) throw error;

  // Previous runs also changed seasonal balances and cached public rankings.
  // Reset only the disposable group's players after removing its matches.
  await client.from("organization_season_player_ratings")
    .update({ current_rating: 1000 })
    .eq("organization_id", organizationId)
    .in("player_id", [...E2E_PLAYER_IDS])
    .throwOnError();
  await client.from("organization_public_snapshots")
    .delete().eq("organization_id", organizationId).throwOnError();
}

export default async function globalSetup() {
  const token = requireEnv("E2E_RUN_TOKEN");
  if (!/^[0-9a-f-]{36}$/.test(token)) throw new Error("Ejecuta E2E mediante npm run test:e2e.");
  const lock = JSON.parse(await readFile(requireEnv("E2E_RUN_LOCK_PATH"), "utf8"));
  if (lock.token !== token) throw new Error("No existe un bloqueo E2E valido.");
  if (!await fixtureLeaseRpc("heartbeat", token, process.env)) throw new Error("No existe una reserva compartida del fixture E2E.");
  const client = createServiceClient();
  const adminUser = await resolveFixtureUser(client, process.env);
  await writeFile(`tmp/e2e/identity-${token}.json`, JSON.stringify({token, userId: adminUser.id}));

  const { error: adminError } = await client.from("admins").upsert(
    {
      id: adminUser.id,
      display_name: "E2E Admin"
    },
    { onConflict: "id" }
  );
  if (adminError) throw adminError;

  const organizationId = await ensureOrganization(client, adminUser.id);
  await cleanupOrganizationMatches(client, organizationId);
  await seedPlayers(client, organizationId);
}
