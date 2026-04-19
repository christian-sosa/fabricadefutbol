import { createClient } from "@supabase/supabase-js";

import { getSupabaseDbSchema, getSupabaseServiceRoleKey, getSupabaseUrl } from "../../src/lib/env";
import { loadEnvFile } from "../helpers/load-env-file";
import { E2E_ORGANIZATION_ID, E2E_PLAYER_IDS } from "./test-data";

loadEnvFile(".env.test");

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Falta ${name} en .env.test para correr Playwright.`);
  }
  return value;
}

function createServiceClient() {
  const serviceRoleKey = getSupabaseServiceRoleKey();
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY_DEV es obligatoria para preparar el entorno E2E.");
  }

  return createClient(getSupabaseUrl(), serviceRoleKey, {
    db: {
      schema: getSupabaseDbSchema()
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

async function ensureAdminUser(client: ReturnType<typeof createServiceClient>) {
  const email = requireEnv("E2E_ADMIN_EMAIL").toLowerCase();
  const password = requireEnv("E2E_ADMIN_PASSWORD");

  const { data: listed, error: listError } = await client.auth.admin.listUsers({
    page: 1,
    perPage: 200
  });
  if (listError) throw listError;

  const existing = listed.users.find((user) => user.email?.toLowerCase() === email) ?? null;
  if (!existing) {
    const { data, error } = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: "E2E Admin"
      }
    });
    if (error || !data.user) {
      throw error ?? new Error("No se pudo crear el usuario E2E.");
    }
    return data.user;
  }

  const { data, error } = await client.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
    user_metadata: {
      display_name: "E2E Admin"
    }
  });
  if (error || !data.user) {
    throw error ?? new Error("No se pudo actualizar el usuario E2E.");
  }

  return data.user;
}

async function ensureOrganization(client: ReturnType<typeof createServiceClient>, adminId: string) {
  const slug = requireEnv("E2E_ORG_SLUG");
  const name = process.env.E2E_ORG_NAME?.trim() || "Organizacion E2E";
  const now = new Date().toISOString();

  const { data: existing, error: existingError } = await client
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existingError) throw existingError;

  const organizationId = existing?.id ?? E2E_ORGANIZATION_ID;

  const { error: orgError } = await client.from("organizations").upsert(
    {
      id: organizationId,
      name,
      slug,
      is_public: true,
      created_by: adminId,
      created_at: now,
      updated_at: now
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
  const { data: matches, error: matchesError } = await client
    .from("matches")
    .select("id")
    .eq("organization_id", organizationId);
  if (matchesError) throw matchesError;

  const matchIds = (matches ?? []).map((row) => String(row.id));
  if (!matchIds.length) return;

  const { data: options, error: optionsError } = await client
    .from("team_options")
    .select("id")
    .in("match_id", matchIds);
  if (optionsError) throw optionsError;

  const optionIds = (options ?? []).map((row) => String(row.id));

  await client.from("rating_history").delete().in("match_id", matchIds);
  await client.from("match_result").delete().in("match_id", matchIds);
  if (optionIds.length) {
    await client.from("team_option_players").delete().in("team_option_id", optionIds);
    await client.from("team_option_guests").delete().in("team_option_id", optionIds);
  }
  await client.from("team_options").delete().in("match_id", matchIds);
  await client.from("match_guests").delete().in("match_id", matchIds);
  await client.from("match_players").delete().in("match_id", matchIds);
  await client.from("matches").delete().in("id", matchIds);
}

async function seedPlayers(client: ReturnType<typeof createServiceClient>, organizationId: string) {
  const rows = E2E_PLAYER_IDS.map((id, index) => ({
    id,
    organization_id: organizationId,
    full_name: `E2E Jugador ${index + 1}`,
    initial_rank: index + 1,
    current_rating: 1000,
    active: true,
    notes: "e2e"
  }));

  const { error } = await client.from("players").upsert(rows, { onConflict: "id" });
  if (error) throw error;
}

export default async function globalSetup() {
  const client = createServiceClient();
  const adminUser = await ensureAdminUser(client);

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
