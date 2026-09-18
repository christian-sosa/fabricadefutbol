import { expect, test, type Page } from "@playwright/test";

import { E2E_ORGANIZATION_ID, E2E_PLAYER_IDS } from "./test-data";

const ORG_SLUG = process.env.E2E_ORG_SLUG ?? "e2e-fabrica";
const PLAYER_ID = E2E_PLAYER_IDS[0];
type Standing = { playerId: string; currentRating: number; isInjured: boolean; isAbsent: boolean };

async function standingsFor(page: Page) {
  const response = await page.request.get(`/api/organizations/${E2E_ORGANIZATION_ID}/standings?season=current`);
  expect(response.ok()).toBe(true);
  return (await response.json() as { standings: Standing[] }).standings;
}

const points = (standings: Standing[]) => Object.fromEntries(standings.map((player) => [player.playerId, player.currentRating]));

async function followNavigationLink(page: Page, label: string) {
  const link = page.getByRole("link", { name: label, exact: true }).filter({ visible: true }).first();
  const menu = page.getByRole("button", { name: "Abrir menu", exact: true }).filter({ visible: true });
  await expect(link.or(menu).first()).toBeVisible();
  if (await menu.isVisible() && !await link.isVisible()) {
    await menu.click();
  }
  await expect(link).toBeVisible();
  await link.click();
}

test("la lesión se guarda desde admin y permanece visible al excluir ausentes sin cambiar puntos", async ({ page, isMobile }, testInfo) => {
  test.setTimeout(120_000);
  const adminPath = `/admin/players?org=${ORG_SLUG}`;
  await page.goto(`/admin/login?next=${encodeURIComponent(adminPath)}`);
  const loginForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Ingresar con email", exact: true }) });
  await loginForm.getByLabel("Email", { exact: true }).fill(process.env.E2E_ADMIN_EMAIL!);
  await loginForm.getByLabel("Contraseña", { exact: true }).fill(process.env.E2E_ADMIN_PASSWORD!);
  await loginForm.getByRole("button", { name: "Ingresar con email", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/admin/players" && url.searchParams.get("org") === ORG_SLUG);
  await expect(page.locator(`input[name="organizationId"][value="${E2E_ORGANIZATION_ID}"]`).first()).toBeAttached();

  const playerRow = page.locator(`#player-${PLAYER_ID}`);
  const playerName = await playerRow.locator('input[name="fullName"]').inputValue();
  const initial = await standingsFor(page);
  expect(initial.find((player) => player.playerId === PLAYER_ID)?.isInjured).toBe(false);

  // Keep the same client QueryClient through all navigation: a recent cached
  // ranking must update after the mutation, even before its 60s stale time.
  await followNavigationLink(page, "Grupos");
  await followNavigationLink(page, "Ranking");
  const rankingRow = (isMobile ? page.locator("article") : page.locator("tbody tr"))
    .filter({ has: page.getByText(playerName, { exact: true }) });
  await expect(rankingRow).toBeVisible();
  await expect(rankingRow.getByText("Lesionado", { exact: true })).toHaveCount(0);
  // Return through the client navigation history without depending on the
  // public header's asynchronously resolved authentication controls.
  await page.goBack();
  await page.goBack();
  await expect(page).toHaveURL((url) => url.pathname === "/admin/players" && url.searchParams.get("org") === ORG_SLUG);
  await expect(playerRow).toBeVisible();

  try {
    await playerRow.getByRole("button", { name: `Marcar lesionado a ${playerName}`, exact: true }).click();
    await expect(playerRow.getByRole("button", { name: `Marcar recuperado a ${playerName}`, exact: true })).toBeVisible();
    await expect(playerRow.getByText("Lesionado", { exact: true })).toBeVisible();
    const injured = await standingsFor(page);
    expect(injured.find((player) => player.playerId === PLAYER_ID)).toMatchObject({ isInjured: true, isAbsent: false });
    expect(points(injured)).toEqual(points(initial));

    await followNavigationLink(page, "Grupos");
    await followNavigationLink(page, "Ranking");
    await expect(rankingRow.getByText("Lesionado", { exact: true })).toBeVisible();
    const excludeAbsent = page.getByRole("checkbox", { name: "Excluir ausentes", exact: true });
    await excludeAbsent.check();
    await expect(excludeAbsent).toBeChecked();
    await expect(rankingRow).toBeVisible();
    await expect(rankingRow.getByText("Lesionado", { exact: true })).toBeVisible();
    await expect(rankingRow.getByText("Ausente", { exact: true })).toHaveCount(0);
    const size = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth }));
    expect(size.width).toBeLessThanOrEqual(size.viewport + 1);
    const screenshot = testInfo.outputPath("ranking-lesionado.png");
    await page.screenshot({ path: screenshot, animations: "disabled" });
    await testInfo.attach("ranking-lesionado", { path: screenshot, contentType: "image/png" });
  } finally {
    // This state belongs only to the accredited disposable fixture in app_dev.
    await page.goto(adminPath);
    await expect(playerRow).toBeVisible();
    const recover = playerRow.getByRole("button", { name: `Marcar recuperado a ${playerName}`, exact: true });
    if (await recover.isVisible()) {
      await recover.click();
    }
    await expect(playerRow.getByRole("button", { name: `Marcar lesionado a ${playerName}`, exact: true })).toBeVisible();
  }

  const recovered = await standingsFor(page);
  expect(recovered.find((player) => player.playerId === PLAYER_ID)?.isInjured).toBe(false);
  expect(points(recovered)).toEqual(points(initial));
});
