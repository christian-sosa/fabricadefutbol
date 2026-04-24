import { test, expect, type Page } from "@playwright/test";

import { E2E_PLAYER_IDS } from "./test-data";

const ORG_SLUG = process.env.E2E_ORG_SLUG ?? "e2e-fabrica";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "e2e-admin@example.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "ChangeMe123!";

test.describe.configure({ mode: "serial" });

function publicNavLink(page: Page, label: string) {
  return page.getByRole("link", { name: label, exact: true }).first();
}

test("mantiene la organizacion al navegar por la parte publica", async ({ page }) => {
  await page.goto(`/?org=${ORG_SLUG}`);

  await expect(page).toHaveURL(new RegExp(`\\?org=${ORG_SLUG}$`));
  await publicNavLink(page, "Grupos").click();
  await expect(page).toHaveURL(new RegExp(`/groups\\?org=${ORG_SLUG}$`));

  await publicNavLink(page, "Ranking").click();
  await expect(page).toHaveURL(new RegExp(`/ranking\\?org=${ORG_SLUG}$`));

  await page.goto(`/players?org=${ORG_SLUG}`);
  await expect(page).toHaveURL(new RegExp(`/ranking\\?org=${ORG_SLUG}$`));

  await publicNavLink(page, "Historial").click();
  await expect(page).toHaveURL(new RegExp(`/matches\\?org=${ORG_SLUG}$`));
});

test("login admin, crea partido, carga resultado y lo ve en publico", async ({ page }) => {
  await page.goto("/admin/login");

  const loginForm = page.locator("form").filter({
    has: page.getByRole("button", { name: "Ingresar", exact: true })
  });

  await loginForm.getByLabel("Email", { exact: true }).fill(ADMIN_EMAIL);
  await loginForm.getByLabel("Contrasena", { exact: true }).fill(ADMIN_PASSWORD);
  await loginForm.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page.waitForURL("**/admin");
  await expect(page.getByText("Cuenta administradora")).toBeVisible();

  await page.goto(`/admin/matches/new?org=${ORG_SLUG}`);

  await page.locator('input[name="scheduledAt"]').fill("2026-04-30T20:00");
  await page.locator('select[name="modality"]').selectOption("5v5");

  for (const playerId of E2E_PLAYER_IDS) {
    await page.locator(`input[name="playerIds"][value="${playerId}"]`).check();
  }

  await page.locator(`input[name="goalkeeperPlayerIds"][value="${E2E_PLAYER_IDS[0]}"]`).check();
  await page.locator(`input[name="goalkeeperPlayerIds"][value="${E2E_PLAYER_IDS[5]}"]`).check();

  await page.getByRole("button", { name: "Crear partido y generar equipos" }).click();
  await page.waitForURL("**/admin/matches/**");
  await expect(page.getByText("Opciones de equipos")).toBeVisible();

  await page.getByRole("button", { name: "Confirmar esta opcion" }).first().click();
  await expect(page.getByText(/Cargar resultado|Corregir resultado/)).toBeVisible();

  const matchId = page.url().match(/\/admin\/matches\/([^?]+)/)?.[1];
  expect(matchId).toBeTruthy();

  await page.locator('input[name="scoreA"]').fill("3");
  await page.locator('input[name="scoreB"]').fill("2");
  await page.getByRole("button", { name: /Guardar resultado y finalizar|Guardar correccion/ }).click();

  await expect(page.getByText(/Resultado guardado\./)).toBeVisible();

  await page.goto(`/matches/${matchId}?org=${ORG_SLUG}`);
  await expect(page.getByText("3 - 2")).toBeVisible();
  await expect(page.getByText("Ganador: Equipo A")).toBeVisible();
});
