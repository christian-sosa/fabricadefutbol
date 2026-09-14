import { createClient, type User } from "@supabase/supabase-js";
import { E2E_ORGANIZATION_ID, E2E_PLAYER_IDS } from "../e2e/test-data";

export const E2E_AUTH_MARKER = "fabricadefutbol-e2e-v1";
export function createFixtureClient(url: string, serviceKey: string) {
  return createClient(url, serviceKey, {db: {schema: "app_dev"}, auth: {autoRefreshToken: false, persistSession: false}});
}
type FixtureClient = ReturnType<typeof createFixtureClient>;

export async function validateFixtureData(client: FixtureClient, slug: string, userId: string | null) {
  const results = await Promise.all([
    client.from("organizations").select("id, slug, created_by").eq("id", E2E_ORGANIZATION_ID).maybeSingle(),
    client.from("organizations").select("id, slug, created_by").eq("slug", slug).maybeSingle(),
    client.from("players").select("id, organization_id").in("id", [...E2E_PLAYER_IDS])
  ]);
  for (const result of results) if (result.error) throw new Error("No se pudo comprobar la identidad del fixture E2E.");
  for (const organization of [results[0].data, results[1].data]) {
    if (organization && (organization.id !== E2E_ORGANIZATION_ID || organization.slug !== slug || organization.created_by !== userId)) throw new Error("El grupo existente no coincide con el fixture E2E autorizado.");
  }
  if (results[2].data?.some((player) => player.organization_id !== E2E_ORGANIZATION_ID)) throw new Error("Un jugador fijo de testing pertenece a otro grupo.");
}

export async function assertNoProductionAuthority(client: FixtureClient, email: string, userId: string | null) {
  const production = client.schema("app_prod");
  const checks = [production.from("super_admin_emails").select("email").ilike("email", email).limit(1)];
  if (userId) {
    const results = await Promise.all([
      production.from("admins").select("id").eq("id", userId).limit(1),
      production.from("organizations").select("id").eq("created_by", userId).limit(1),
      production.from("organization_admins").select("id").eq("admin_id", userId).limit(1)
    ]);
    for (const result of results) {
      if (result.error) throw new Error("No se pudo descartar autoridad productiva del usuario E2E.");
      if (result.data?.length) throw new Error("El usuario E2E tiene afiliacion productiva y no puede usarse para testing.");
    }
  }
  for (const check of checks) {
    const result = await check;
    if (result.error) throw new Error("No se pudo descartar autoridad productiva del usuario E2E.");
    if (result.data?.length) throw new Error("Un superadmin productivo no puede usarse como fixture E2E.");
  }
}

export async function resolveFixtureUser(client: FixtureClient, env: Record<string, string | undefined>): Promise<User> {
  const email = env.E2E_ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const slug = env.E2E_ORG_SLUG ?? "";
  if (!/^[a-z0-9._+-]+@example\.test$/.test(email) || !/^e2e-[a-z0-9-]+$/.test(slug)) throw new Error("Email o grupo fuera del espacio reservado de testing.");
  if (env.SUPER_ADMIN_EMAIL?.trim().toLowerCase() === email || env.SUPER_ADMIN_EMAIL_PROD?.trim().toLowerCase() === email) throw new Error("El email E2E coincide con una autoridad configurada.");
  if (env.E2E_ADMIN_USER_ID) {
    const {data, error} = await client.auth.admin.getUserById(env.E2E_ADMIN_USER_ID);
    if (error || !data.user) throw new Error("No se pudo verificar E2E_ADMIN_USER_ID.");
    const user = data.user;
    if (user.id !== env.E2E_ADMIN_USER_ID || user.email?.toLowerCase() !== email || user.app_metadata.fdf_e2e_fixture !== E2E_AUTH_MARKER || user.app_metadata.fdf_e2e_organization_id !== E2E_ORGANIZATION_ID) throw new Error("El usuario existente no esta acreditado como fixture E2E.");
    await assertNoProductionAuthority(client, email, user.id);
    await validateFixtureData(client, slug, user.id);
    return user; // Never reset an existing password, confirmation state or metadata.
  }
  if (env.E2E_CREATE_FIXTURE_USER !== "1") throw new Error("Un usuario existente requiere E2E_ADMIN_USER_ID.");
  for (let page = 1; ; page++) {
    const {data, error} = await client.auth.admin.listUsers({page, perPage: 200});
    if (error) throw new Error("No se pudieron comprobar los usuarios de Auth.");
    if (data.users.some((user) => user.email?.toLowerCase() === email)) throw new Error("El email ya existe. Requiere E2E_ADMIN_USER_ID y acreditacion previa.");
    if (data.users.length < 200) break;
  }
  await assertNoProductionAuthority(client, email, null);
  await validateFixtureData(client, slug, null);
  const {data, error} = await client.auth.admin.createUser({email, password: env.E2E_ADMIN_PASSWORD, email_confirm: true,
    app_metadata: {fdf_e2e_fixture: E2E_AUTH_MARKER, fdf_e2e_organization_id: E2E_ORGANIZATION_ID}, user_metadata: {display_name: "E2E Admin"}});
  if (error || !data.user) throw new Error("No se pudo crear el usuario descartable E2E.");
  return data.user;
}
