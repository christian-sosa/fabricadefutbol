import { expect, test, type Page } from "@playwright/test";
import { getCurrentMatchDateInput } from "../../src/lib/match-datetime";
import { E2E_ORGANIZATION_ID, E2E_PLAYER_IDS } from "./test-data";

const org = process.env.E2E_ORG_SLUG ?? "e2e-fabrica";
async function points(page: Page) {
  const response = await page.request.get(`/api/organizations/${E2E_ORGANIZATION_ID}/standings?season=current`);
  expect(response.ok()).toBe(true);
  const body = await response.json() as { standings: Array<{ playerId: string; currentRating: number }> };
  return body.standings.find((player) => player.playerId === E2E_PLAYER_IDS[9])!.currentRating;
}

test("F9: suplentes, puntos y goleadores privados persisten y se pueden corregir", async ({ page, browser }, testInfo) => {
  test.setTimeout(240_000);
  await page.goto(`/admin/login?next=${encodeURIComponent(`/admin?org=${org}`)}`);
  const login = page.locator("form").filter({ has: page.getByRole("button", { name: "Ingresar con email", exact: true }) });
  await login.getByLabel("Email", { exact: true }).fill(process.env.E2E_ADMIN_EMAIL!);
  await login.getByLabel("Contraseña", { exact: true }).fill(process.env.E2E_ADMIN_PASSWORD!);
  await login.getByRole("button", { name: "Ingresar con email", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/admin" && url.searchParams.get("org") === org);
  await expect(page.getByRole("heading", { name: "Organizá el próximo encuentro", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("admin-dashboard.png"), fullPage: true });
  await page.goto("/admin?view=groups");
  await expect(page.getByRole("searchbox", { name: "Buscar entre tus grupos" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("admin-groups.png"), fullPage: true });
  const before = await points(page);
  await page.goto(`/admin/matches/new?org=${org}`);
  await page.locator('input[name="scheduledDate"]').fill(getCurrentMatchDateInput());
  await page.locator('input[name="scheduledTime"]').fill("21:00");
  await page.getByRole("combobox", { name: "Modalidad", exact: true }).selectOption("9v9");
  for (const id of E2E_PLAYER_IDS) await page.locator(`input[name="playerIds"][value="${id}"]`).check();
  const substituteName = (await page.locator(`input[name="playerIds"][value="${E2E_PLAYER_IDS[9]}"]`).getAttribute("aria-label"))!.replace(/^Juega /, "");
  await page.getByRole("combobox", { name: `Rol de ${substituteName}`, exact: true }).selectOption("A");
  for (let index = 1; index <= 10; index++) {
    await page.getByRole("button", { name: "Agregar invitado", exact: true }).click();
    await page.getByRole("textbox", { name: `Nombre del invitado ${index}`, exact: true }).fill(`E2E Suplentes Invitado ${index}`);
    await page.getByRole("combobox", { name: `Nivel de E2E Suplentes Invitado ${index}`, exact: true }).selectOption("3");
  }
  await page.getByRole("combobox", { name: "Rol de E2E Suplentes Invitado 10", exact: true }).selectOption("substitute");
  await page.getByRole("button", { name: "Crear partido y generar equipos", exact: true }).click();
  await expect(page).toHaveURL((url) => /^\/admin\/matches\/[0-9a-f-]{36}$/.test(url.pathname));
  const matchId = new URL(page.url()).pathname.split("/").at(-1)!;
  await expect(page.getByRole("heading", { name: "Banco de suplentes", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Confirmar esta opcion", exact: true }).first().click();
  await expect(page).toHaveURL((url) => url.pathname === `/matches/${matchId}`);
  await page.goto(`/admin/matches/${matchId}/result?org=${org}`);
  await page.getByRole("combobox", { name: "Equipo de E2E Suplentes Invitado 10", exact: true }).selectOption("B");
  await page.locator('input[name="scoreA"]').fill("2");
  await page.locator('input[name="scoreB"]').fill("1");
  await page.locator("summary").filter({ hasText: /^Goleadores/ }).click();
  await page.getByRole("spinbutton", { name: `Goles de ${substituteName}`, exact: true }).fill("1");
  await page.getByRole("spinbutton", { name: "Goles de E2E Suplentes Invitado 10", exact: true }).fill("1");
  await page.screenshot({ path: testInfo.outputPath("result-substitutes-scorers.png"), fullPage: true });
  await page.getByRole("button", { name: "Guardar resultado y finalizar", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/admin/matches" && url.searchParams.has("success"));
  expect(await points(page)).toBe(before + 10);

  await page.goto(`/admin/matches/${matchId}/result?org=${org}`);
  await expect(page.getByRole("spinbutton", { name: `Goles de ${substituteName}`, exact: true })).toHaveValue("1");
  await expect(page.getByRole("combobox", { name: "Equipo de E2E Suplentes Invitado 10", exact: true })).toHaveValue("B");
  await page.getByRole("spinbutton", { name: `Goles de ${substituteName}`, exact: true }).fill("2");
  await page.getByRole("button", { name: "Guardar correccion", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/admin/matches" && url.searchParams.has("success"));
  expect(await points(page)).toBe(before + 10);
  await page.goto(`/admin/scorers?org=${org}`);
  await expect(page.getByRole("heading", { name: "Historial de goleadores" })).toBeVisible();
  await expect(page.getByText(substituteName, { exact: true })).toBeVisible();
  await expect(page.getByText("2 goles", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("scorers-history.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  const anonymous = await browser.newContext();
  try {
    const publicPage = await anonymous.newPage();
    await publicPage.goto(`${new URL(page.url()).origin}/matches/${matchId}?org=${org}`);
    await expect(publicPage.getByRole("heading", { name: "Historial de goleadores" })).toHaveCount(0);
    await expect(publicPage.getByText("2 goles", { exact: true })).toHaveCount(0);
    await publicPage.goto(`${new URL(page.url()).origin}/admin/scorers?org=${org}`);
    await expect(publicPage).toHaveURL((url) => url.pathname === "/admin/login");
  } finally { await anonymous.close(); }
});
