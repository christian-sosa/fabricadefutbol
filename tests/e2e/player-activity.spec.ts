import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { E2E_ORGANIZATION_ID, E2E_PLAYER_IDS } from "./test-data";

const ORG_SLUG = process.env.E2E_ORG_SLUG ?? "e2e-fabrica";
const PLAYER_ID = E2E_PLAYER_IDS[0];
type Standing = { playerId: string; currentRating: number; isInjured: boolean; isAbsent: boolean };

async function standingsFor(request: APIRequestContext) {
  const response = await request.get(`/api/organizations/${E2E_ORGANIZATION_ID}/standings?season=current`);
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

test("la lesión se guarda sólo para admin y no altera puntos ni ausencia pública", async ({ page, request: anonymousRequest, isMobile }, testInfo) => {
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
  const initial = await standingsFor(page.request);
  const initialPlayer = initial.find((player) => player.playerId === PLAYER_ID);
  expect(initialPlayer).toBeDefined();
  if (!initialPlayer) throw new Error("No se encontró al jugador del fixture en el ranking.");
  expect(initialPlayer.isInjured).toBe(false);
  // The standalone request fixture has no browser/admin cookies.
  expect((await anonymousRequest.storageState()).cookies.length).toBe(0);
  const initialAnonymous = await standingsFor(anonymousRequest);
  expect(initialAnonymous.find((player) => player.playerId === PLAYER_ID)).toMatchObject({ isInjured: false, isAbsent: initialPlayer.isAbsent });

  // Keep client navigation and its recent cached ranking through the admin
  // mutation; health data must remain absent from every public view.
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
    const injured = await standingsFor(page.request);
    expect(injured.find((player) => player.playerId === PLAYER_ID)).toMatchObject({ isInjured: false, isAbsent: initialPlayer.isAbsent });
    expect(points(injured)).toEqual(points(initial));
    const injuredAnonymous = await standingsFor(anonymousRequest);
    expect(injuredAnonymous.find((player) => player.playerId === PLAYER_ID)).toMatchObject({ isInjured: false, isAbsent: initialPlayer.isAbsent });
    expect(points(injuredAnonymous)).toEqual(points(initialAnonymous));

    await followNavigationLink(page, "Grupos");
    await followNavigationLink(page, "Ranking");
    await expect(rankingRow).toBeVisible();
    await expect(rankingRow.getByText("Lesionado", { exact: true })).toHaveCount(0);
    await expect(rankingRow.getByText("Inactivo", { exact: true })).toHaveCount(initialPlayer.isAbsent ? 1 : 0);
    const excludeAbsent = page.getByRole("checkbox", { name: "Excluir inactivos", exact: true });
    await excludeAbsent.check();
    await expect(excludeAbsent).toBeChecked();
    if (initialPlayer.isAbsent) await expect(rankingRow).toHaveCount(0);
    else await expect(rankingRow).toBeVisible();
    await expect(page.getByText("Lesionado", { exact: true })).toHaveCount(0);
    const size = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth }));
    expect(size.width).toBeLessThanOrEqual(size.viewport + 1);
    const screenshot = testInfo.outputPath("ranking-lesion-privada.png");
    await page.screenshot({ path: screenshot, animations: "disabled" });
    await testInfo.attach("ranking-lesion-privada", { path: screenshot, contentType: "image/png" });
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

  const recovered = await standingsFor(page.request);
  expect(recovered.find((player) => player.playerId === PLAYER_ID)).toMatchObject({ isInjured: false, isAbsent: initialPlayer.isAbsent });
  expect(points(recovered)).toEqual(points(initial));
  const recoveredAnonymous = await standingsFor(anonymousRequest);
  expect(recoveredAnonymous.find((player) => player.playerId === PLAYER_ID)).toMatchObject({ isInjured: false, isAbsent: initialPlayer.isAbsent });
  expect(points(recoveredAnonymous)).toEqual(points(initialAnonymous));
});
