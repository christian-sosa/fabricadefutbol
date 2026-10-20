import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { test as base, expect, type Page } from "@playwright/test";

import { fixtureLeaseRpc } from "../../scripts/lib/e2e-lease.mjs";
import { getSupabaseDbSchema, getSupabaseServiceRoleKey, getSupabaseUrl } from "../../src/lib/env";
import { assertNoProductionAuthority, createFixtureClient, E2E_AUTH_MARKER } from "../helpers/e2e-fixture-identity";

type Client = ReturnType<typeof createFixtureClient>;
type DisposableAdmin = {
  client: Client;
  userId: string;
  email: string;
  password: string;
  groupName: string;
  assertSafe: () => Promise<void>;
  createGroupWithUi: (page: Page) => Promise<{ id: string; slug: string }>;
  seedGroup: () => Promise<{ id: string; slug: string }>;
};

export const test = base.extend<{ disposableAdmin: DisposableAdmin }>({
  disposableAdmin: async ({ baseURL }, provideFixture) => {
    const token = process.env.E2E_RUN_TOKEN ?? "";
    if (!baseURL || !["127.0.0.1", "localhost", "[::1]"].includes(new URL(baseURL).hostname)
      || !/^[0-9a-f-]{36}$/.test(token) || getSupabaseDbSchema() !== "app_dev"
      || process.env.NEXT_PUBLIC_SUPABASE_TARGET_ENV !== "development") {
      throw new Error("Los fixtures descartables requieren un runner autorizado en app_dev.");
    }
    const serviceKey = getSupabaseServiceRoleKey();
    if (!serviceKey) throw new Error("Falta la credencial DEV del fixture.");
    const client = createFixtureClient(getSupabaseUrl(), serviceKey);
    const cleanupFailurePath = `tmp/e2e/abort-${token}.json`;
    const assertSafe = async () => {
      const lock = JSON.parse(await readFile(process.env.E2E_RUN_LOCK_PATH!, "utf8"));
      if (lock.token !== token) throw new Error("El fixture perdió su bloqueo local.");
      try {
        await readFile(cleanupFailurePath, "utf8");
        throw new Error("Se detuvo la preparación de fixtures por una limpieza incompleta.");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      if (!await fixtureLeaseRpc("heartbeat", token, process.env)) throw new Error("El fixture perdió su reserva compartida.");
    };
    await assertSafe();
    const suffix = randomUUID().slice(0, 8);
    const groupName = `e2e-${token}-${suffix}`;
    const email = `${groupName}@example.test`;
    const password = `E2e-${randomUUID()}!`;
    await assertNoProductionAuthority(client, email, null);
    const { data, error } = await client.auth.admin.createUser({
      email, password, email_confirm: true,
      app_metadata: { fdf_e2e_fixture: E2E_AUTH_MARKER, fdf_e2e_run_token: token, fdf_e2e_scenario: suffix },
      user_metadata: { display_name: "E2E Admin descartable" }
    });
    if (error || !data.user) throw new Error("No se pudo crear el admin descartable reservado.");
    const userId = data.user.id;
    const groupIds = new Set<string>();

    async function assertOwnedIdentity() {
      const result = await client.auth.admin.getUserById(userId);
      const user = result.data.user;
      if (result.error || !user || user.email !== email || user.app_metadata.fdf_e2e_fixture !== E2E_AUTH_MARKER
        || user.app_metadata.fdf_e2e_run_token !== token || user.app_metadata.fdf_e2e_scenario !== suffix) {
        throw new Error("La identidad descartable no coincide con esta ejecución.");
      }
      await assertNoProductionAuthority(client, email, userId);
    }

    try {
      await assertOwnedIdentity();
      await provideFixture({
        client, userId, email, password, groupName, assertSafe,
        createGroupWithUi: async (page) => {
          await assertSafe();
          await page.goto(`/admin/login?next=${encodeURIComponent("/admin/new")}`);
          const login = page.locator("form").filter({ has: page.getByRole("button", { name: "Ingresar con email", exact: true }) });
          await login.getByLabel("Email", { exact: true }).fill(email);
          await login.getByLabel("Contraseña", { exact: true }).fill(password);
          await login.getByRole("button", { name: "Ingresar con email", exact: true }).click();
          await expect(page).toHaveURL((url) => url.pathname === "/admin/new");
          const form = page.locator("form").filter({ has: page.getByRole("textbox", { name: "Nombre del nuevo grupo" }) });
          const id = await form.locator('input[name="organizationId"]').inputValue();
          if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("El alta de grupo no proporcionó un UUID válido.");
          const existing = await client.from("organizations").select("id").eq("id", id).maybeSingle().throwOnError();
          if (existing.data) throw new Error("El identificador del nuevo grupo ya está ocupado.");
          groupIds.add(id); // Record before submission so a failed navigation still cleans up.
          await form.getByRole("textbox", { name: "Nombre del nuevo grupo" }).fill(groupName);
          await form.getByRole("button", { name: "Crear grupo", exact: true }).click();
          await expect(page).toHaveURL((url) => url.pathname === "/admin" && url.searchParams.get("org") === groupName);
          const group = await client.from("organizations").select("id, slug, created_by").eq("id", id).single().throwOnError();
          expect(group.data).toMatchObject({ id, slug: groupName, created_by: userId });
          const membership = await client.from("organization_admins").select("admin_id").eq("organization_id", id).throwOnError();
          expect(membership.data).toEqual([{ admin_id: userId }]);
          return { id, slug: groupName };
        },
        seedGroup: async () => {
          await assertSafe();
          const id = randomUUID();
          groupIds.add(id);
          await client.from("admins").insert({ id: userId, display_name: "E2E Admin descartable" }).throwOnError();
          await client.from("organizations").insert({ id, slug: groupName, name: groupName, created_by: userId, is_public: true, is_listed: false }).throwOnError();
          await client.from("organization_admins").insert({ organization_id: id, admin_id: userId, created_by: userId }).throwOnError();
          return { id, slug: groupName };
        }
      });
    } finally {
      try {
        await assertSafe();
        await assertOwnedIdentity();
        const owned = await client.from("organizations").select("id, name, slug, created_by, image_path").eq("created_by", userId).throwOnError();
        if (owned.data?.some((group) => !groupIds.has(group.id) || group.name !== groupName || group.slug !== groupName || group.image_path !== null)) {
          throw new Error("La limpieza encontró un grupo ajeno al fixture o archivos no previstos.");
        }
        const memberships = await client.from("organization_admins").select("organization_id").eq("admin_id", userId).throwOnError();
        if (memberships.data?.some((row) => !groupIds.has(row.organization_id))) throw new Error("El fixture adquirió una afiliación no prevista.");
        for (const group of owned.data ?? []) {
          // Remove matches first: historical player references use ON DELETE RESTRICT.
          await client.from("matches").delete().eq("organization_id", group.id).throwOnError();
          await client.from("organizations").delete().eq("id", group.id).eq("created_by", userId).throwOnError();
        }
        await client.from("analytics_events").delete().eq("admin_id", userId).throwOnError();
        const deleted = await client.auth.admin.deleteUser(userId);
        if (deleted.error) throw new Error("No se pudo eliminar el admin descartable de esta ejecución.");
      } catch (error) {
        await writeFile(cleanupFailurePath, JSON.stringify({ token, userId, email, groupName, groupIds: [...groupIds], reason: "La limpieza del fixture descartable falló; revisar los recursos de esta ejecución." }));
        throw error;
      }
    }
  }
});

export { expect };
