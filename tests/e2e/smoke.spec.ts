import { test, expect, type Page } from "@playwright/test";

import { E2E_PLAYER_IDS } from "./test-data";

const ORG_SLUG = process.env.E2E_ORG_SLUG ?? "e2e-fabrica";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "e2e-admin@example.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "ChangeMe123!";

test.describe.configure({ mode: "serial" });

function publicNavLink(page: Page, label: string) {
  return page.getByRole("link", { name: label, exact: true }).first();
}

async function expectGroupPath(page: Page, pathname: string) {
  await expect(page).toHaveURL((url) =>
    url.pathname === pathname && url.searchParams.get("org") === ORG_SLUG
  );
}

test("mantiene la organizacion al navegar por la parte publica", async ({ page }) => {
  await page.goto(`/?org=${ORG_SLUG}`);

  await expectGroupPath(page, "/");
  await publicNavLink(page, "Grupos").click();
  await expectGroupPath(page, "/groups");

  await publicNavLink(page, "Ranking").click();
  await expectGroupPath(page, "/ranking");

  await page.goto(`/players?org=${ORG_SLUG}`);
  await expectGroupPath(page, "/ranking");

  await publicNavLink(page, "Historial").click();
  await expectGroupPath(page, "/matches");
});

test("login admin, crea partido, carga resultado y lo ve en publico", async ({ page }) => {
  await page.goto(`/admin/login?next=${encodeURIComponent(`/admin?org=${ORG_SLUG}`)}`);

  const loginForm = page.locator("form").filter({
    has: page.getByRole("button", { name: "Ingresar con email", exact: true })
  });

  await loginForm.getByLabel("Email", { exact: true }).fill(ADMIN_EMAIL);
  await loginForm.getByLabel("Contraseña", { exact: true }).fill(ADMIN_PASSWORD);
  await loginForm.getByRole("button", { name: "Ingresar con email", exact: true }).click();
  await expectGroupPath(page, "/admin");
  await expect(page.getByRole("heading", { name: "Dejá tu grupo listo para jugar" })).toBeVisible();

  await page.goto(`/admin/matches/new?org=${ORG_SLUG}`);

  await page.locator('input[name="scheduledDate"]').fill(new Date().toISOString().slice(0, 10));
  await page.locator('input[name="scheduledTime"]').fill("20:00");
  await page.locator('select[name="modality"]').selectOption("5v5");

  for (const playerId of E2E_PLAYER_IDS) {
    await page.locator(`input[name="playerIds"][value="${playerId}"]`).check();
  }

  await page.locator(`input[name="goalkeeperPlayerIds"][value="${E2E_PLAYER_IDS[0]}"]`).check();
  await page.locator(`input[name="goalkeeperPlayerIds"][value="${E2E_PLAYER_IDS[5]}"]`).check();

  await page.getByRole("button", { name: "Crear partido y generar equipos" }).click();
  await expect(page).toHaveURL((url) => /^\/admin\/matches\/[0-9a-f-]{36}$/.test(url.pathname));
  await expect(page.getByText("Opciones de equipos")).toBeVisible();

  const matchId = page.url().match(/\/admin\/matches\/([^?]+)/)?.[1];
  expect(matchId).toBeTruthy();

  await page.getByRole("button", { name: "Confirmar esta opcion" }).first().click();
  await expectGroupPath(page, `/matches/${matchId}`);
  await expect(page.getByText("Resultado pendiente.")).toBeVisible();

  await page.goto(`/admin/matches/${matchId}/result?org=${ORG_SLUG}`);
  await expect(page.getByText(/Cargar resultado|Corregir resultado/)).toBeVisible();

  await page.locator('input[name="scoreA"]').fill("3");
  await page.locator('input[name="scoreB"]').fill("2");
  await page.getByRole("button", { name: /Guardar resultado y finalizar|Guardar correccion/ }).click();

  await expect(page.getByText(/Resultado guardado\./)).toBeVisible();

  await page.goto(`/matches/${matchId}?org=${ORG_SLUG}`);
  await expect(page.getByText("3 - 2")).toBeVisible();
  await expect(page.getByText("Ganador: Negro")).toBeVisible();
});
