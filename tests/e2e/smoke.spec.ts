import { test, expect, type Page } from "@playwright/test";

import { E2E_ORGANIZATION_ID, E2E_PLAYER_IDS } from "./test-data";
import { getCurrentMatchDateInput } from "../../src/lib/match-datetime";

const ORG_SLUG = process.env.E2E_ORG_SLUG ?? "e2e-fabrica";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!;

test.describe.configure({ mode: "serial" });

async function followPublicNav(page: Page, label: string) {
  const link = page.getByRole("link", { name: label, exact: true }).filter({visible: true}).first();
  if (!await link.isVisible()) {
    const menu = page.getByRole("button", {name: "Abrir menu", exact: true});
    await expect(menu).toBeVisible();
    await menu.click();
    await expect(page.getByRole("button", {name: "Cerrar menu", exact: true})).toHaveAttribute("aria-expanded", "true");
  }
  await expect(link).toBeVisible();
  await link.click();
}

async function expectGroupPath(page: Page, pathname: string) {
  await expect(page).toHaveURL((url) =>
    url.pathname === pathname && url.searchParams.get("org") === ORG_SLUG
  );
}

test("mantiene la organizacion al navegar por la parte publica", async ({ page }) => {
  await page.goto(`/?org=${ORG_SLUG}`);

  await expectGroupPath(page, "/");
  await followPublicNav(page, "Grupos");
  await expectGroupPath(page, "/groups");

  await followPublicNav(page, "Ranking");
  await expectGroupPath(page, "/ranking");

  await page.goto(`/players?org=${ORG_SLUG}`);
  await expectGroupPath(page, "/ranking");

  await followPublicNav(page, "Historial");
  await expectGroupPath(page, "/matches");
});

type Standing = { playerId: string; currentRating: number; mvpCount: number };
async function standingsFor(page: Page) {
  const response = await page.request.get(`/api/organizations/${E2E_ORGANIZATION_ID}/standings?season=current`);
  expect(response.ok()).toBe(true);
  return (await response.json() as {standings: Standing[]}).standings;
}
const points = (standings: Standing[]) => Object.fromEntries(standings.map((row) => [row.playerId, row.currentRating]));

test("login, resultado, reintento, edicion concurrente y correccion historica conservan los puntos", async ({ page, context }) => {
  test.setTimeout(180_000);
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

  await page.locator('input[name="scheduledDate"]').fill(getCurrentMatchDateInput());
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
  await page.getByLabel("MVP del partido").selectOption(`player:${E2E_PLAYER_IDS[0]}`);
  await expect(page.getByText(/La figura es opcional y no suma puntos/)).toBeVisible();
  await page.getByRole("button", { name: /Guardar resultado y finalizar|Guardar correccion/ }).click();

  await expect(page.getByText(/Resultado guardado\./)).toBeVisible();

  await page.goto(`/matches/${matchId}?org=${ORG_SLUG}`);
  await expect(page.getByText("3 - 2")).toBeVisible();
  await expect(page.getByText("Ganador: Negro")).toBeVisible();
  await expect(page.getByText("MVP: E2E Jugador 1", { exact: true })).toBeVisible();

  const response = await page.request.get(`/api/organizations/${E2E_ORGANIZATION_ID}/standings?season=current`);
  expect(response.ok()).toBe(true);
  const { standings } = await response.json() as {
    standings: Array<{ playerId: string; currentRating: number; mvpCount: number }>;
  };
  expect(standings).toHaveLength(10);
  expect(standings.every((player) => [990, 1010].includes(player.currentRating))).toBe(true);
  const mvp = standings.find((player) => player.playerId === E2E_PLAYER_IDS[0]);
  expect(mvp?.mvpCount).toBe(1);
  expect(standings.filter((player) => player.currentRating === mvp?.currentRating)[0]?.playerId).toBe(E2E_PLAYER_IDS[0]);

  const resultUrl = `/admin/matches/${matchId}/result?org=${ORG_SLUG}`;
  const resultApi = `**/api/admin/organizations/${E2E_ORGANIZATION_ID}/matches/${matchId}/result`;
  await page.goto(resultUrl);
  const otherTab = await context.newPage();
  await otherTab.goto(resultUrl);
  await expect(otherTab.locator('input[name="scoreA"]')).toHaveValue("3");
  await page.locator('textarea[name="notes"]').fill("Acta corregida sin cambiar el marcador");
  await page.route(resultApi, (route) => route.fulfill({status: 503, contentType: "application/json", body: JSON.stringify({error: "Servicio temporalmente no disponible. Reintenta."})}), {times: 1});
  await page.getByRole("button", {name: "Guardar correccion", exact: true}).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("temporalmente");
  await expect(page.locator('textarea[name="notes"]')).toHaveValue("Acta corregida sin cambiar el marcador");
  await expect(page.locator('input[name="scoreA"]')).toHaveValue("3");
  expect(points(await standingsFor(page))).toEqual(points(standings));
  await page.getByRole("button", {name: "Guardar correccion", exact: true}).click();
  await expect(page.getByText("Resultado guardado.", {exact: true})).toBeVisible();
  expect(points(await standingsFor(page))).toEqual(points(standings));

  await otherTab.locator('input[name="scoreA"]').fill("0");
  const staleResponse = otherTab.waitForResponse((response) => response.url().endsWith(`/matches/${matchId}/result`) && response.request().method() === "PATCH");
  await otherTab.getByRole("button", {name: "Guardar correccion", exact: true}).click();
  expect((await staleResponse).status()).toBe(409);
  await expect(otherTab.locator("form").getByRole("alert")).toBeVisible();
  await expect(otherTab.locator('input[name="scoreA"]')).toHaveValue("0");
  expect(points(await standingsFor(page))).toEqual(points(standings));
  await otherTab.reload();
  await otherTab.getByLabel("MVP del partido").selectOption(`player:${E2E_PLAYER_IDS[1]}`);
  await otherTab.getByRole("button", {name: "Guardar correccion", exact: true}).click();
  await expect(otherTab.getByText("Resultado guardado.", {exact: true})).toBeVisible();
  expect(points(await standingsFor(page))).toEqual(points(standings));
  await otherTab.close();

  await page.goto(`/admin/matches/new?repeat=${matchId}&org=${ORG_SLUG}`);
  await expect(page.locator('select[name="modality"]')).toHaveValue("5v5");
  await expect(page.locator('input[name="playerIds"]:checked')).toHaveCount(10);
  for (const index of [0, 5]) await expect(page.locator(`input[name="goalkeeperPlayerIds"][value="${E2E_PLAYER_IDS[index]}"]`)).toBeChecked();
  await page.getByRole("button", {name: "Crear partido y generar equipos"}).click();
  await expect(page).toHaveURL((url) => /^\/admin\/matches\/[0-9a-f-]{36}$/.test(url.pathname));
  const laterMatchId = page.url().match(/\/admin\/matches\/([^?]+)/)?.[1];
  expect(laterMatchId).not.toBe(matchId);
  await page.getByRole("button", {name: "Confirmar esta opcion"}).first().click();
  await expectGroupPath(page, `/matches/${laterMatchId}`);
  await page.goto(`/admin/matches/${laterMatchId}/result?org=${ORG_SLUG}`);
  await page.locator('input[name="scoreA"]').fill("2");
  await page.locator('input[name="scoreB"]').fill("0");
  await page.getByRole("button", {name: "Guardar resultado y finalizar", exact: true}).click();
  await expect(page.getByText("Resultado guardado.", {exact: true})).toBeVisible();
  const laterPoints = points(await standingsFor(page));
  await page.goto(resultUrl);
  await page.locator('input[name="scoreA"]').fill("0");
  await page.getByRole("button", {name: "Guardar correccion", exact: true}).click();
  await expect(page.getByText("Resultado guardado.", {exact: true})).toBeVisible();
  const corrected = points(await standingsFor(page));
  for (const prior of standings) expect(corrected[prior.playerId]).toBe(laterPoints[prior.playerId] - 2 * (prior.currentRating - 1000));
  await page.goto(`/matches/${laterMatchId}?org=${ORG_SLUG}`);
  await expect(page.getByText("2 - 0", {exact: true})).toBeVisible();
});

test("ranking visible sin desborde y controles accesibles por teclado", async ({page, isMobile}, testInfo) => {
  await page.goto(`/ranking?org=${ORG_SLUG}`);
  const firstRow = isMobile ? page.locator("article").first() : page.locator("tbody tr").first();
  await expect(firstRow).toBeVisible();
  const box = await firstRow.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y + Math.min(box!.height, 80)).toBeLessThan(page.viewportSize()!.height);
  const documentSize = await page.evaluate(() => ({width: document.documentElement.scrollWidth, viewport: window.innerWidth}));
  expect(documentSize.width).toBeLessThanOrEqual(documentSize.viewport + 1);
  const rules = page.locator("summary").filter({hasText: "Cómo se ordena el ranking"});
  await expect(rules).toBeVisible();
  await rules.focus();
  await expect(rules).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/Primero se ordena por puntos de rendimiento/)).toBeVisible();
  await page.keyboard.press("Enter");
  await page.evaluate(() => window.scrollTo(0, 0));
  const screenshot = testInfo.outputPath("ranking-layout.png");
  await page.screenshot({path: screenshot, animations: "disabled"});
  await testInfo.attach("ranking-layout", {path: screenshot, contentType: "image/png"});
});
