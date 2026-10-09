import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";

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

async function openPlayerActions(playerRow: Locator, playerName: string) {
  const button = playerRow.getByRole("button", { name: `Acciones de ${playerName}`, exact: true });
  await expect(button).toBeVisible();
  if (await button.getAttribute("aria-expanded") === "false") await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(playerRow.getByRole("region", { name: `Acciones de ${playerName}`, exact: true })).toBeVisible();
}

async function screenshotRosterRows(page: Page, path: string) {
  const rows = page.locator("[data-roster-player]");
  await rows.first().scrollIntoViewIfNeeded();
  const first = await rows.first().boundingBox();
  const second = await rows.nth(1).boundingBox();
  if (!first || !second) throw new Error("No se encontraron las primeras filas del plantel.");
  const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
  await page.screenshot({
    path,
    animations: "disabled",
    fullPage: true,
    clip: { x: first.x + scroll.x, y: first.y + scroll.y, width: first.width, height: second.y + second.height - first.y }
  });
}

test("la lesión se muestra en el ranking público y exime de inactividad sin alterar puntos", async ({ browser, page, request: anonymousRequest, isMobile }, testInfo) => {
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

  // Keep client navigation and its recent cached ranking through the admin mutation.
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
  const originalViewport = page.viewportSize()!;
  await page.setViewportSize({ width: isMobile ? 320 : 1024, height: originalViewport.height });
  const actions = playerRow.getByRole("button", { name: `Acciones de ${playerName}`, exact: true });
  await expect(actions).toHaveAttribute("aria-expanded", "false");
  await expect(playerRow.getByRole("button", { name: `Marcar lesionado a ${playerName}`, exact: true })).toBeHidden();
  const compactSize = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(compactSize.width).toBeLessThanOrEqual(compactSize.viewport + 1);
  if (!isMobile) {
    const controls = [
      playerRow.locator('input[name="fullName"]'),
      playerRow.getByRole("combobox", { name: `Nivel de habilidad de ${playerName}`, exact: true }),
      playerRow.getByRole("combobox", { name: `Posición preferida de ${playerName}`, exact: true }),
      playerRow.getByRole("combobox", { name: `Posición secundaria de ${playerName}`, exact: true }),
      actions
    ];
    const boxes = await Promise.all(controls.map((control) => control.boundingBox()));
    expect(boxes.every(Boolean)).toBe(true);
    const top = boxes[0]!.y;
    for (const box of boxes) {
      expect(Math.abs(box!.y - top)).toBeLessThanOrEqual(1);
      expect(Math.abs(box!.height - boxes[0]!.height)).toBeLessThanOrEqual(1);
    }
  }
  const compactScreenshot = testInfo.outputPath("planilla-compacta.png");
  await screenshotRosterRows(page, compactScreenshot);
  await testInfo.attach("planilla-compacta", { path: compactScreenshot, contentType: "image/png" });

  const anonymousContext = await browser.newContext({ viewport: page.viewportSize() ?? undefined });
  try {
    const anonymousPage = await anonymousContext.newPage();
    const rankingUrl = new URL(`/ranking?org=${ORG_SLUG}`, page.url()).toString();
    await anonymousPage.goto(rankingUrl);
    const anonymousRankingRow = (isMobile ? anonymousPage.locator("article") : anonymousPage.locator("tbody tr"))
      .filter({ has: anonymousPage.getByText(playerName, { exact: true }) });
    await expect(anonymousRankingRow).toBeVisible();
    await expect(anonymousRankingRow.getByText("Lesionado", { exact: true })).toHaveCount(0);

    try {
      await openPlayerActions(playerRow, playerName);
      const expandedSize = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth }));
      expect(expandedSize.width).toBeLessThanOrEqual(expandedSize.viewport + 1);
      const expandedScreenshot = testInfo.outputPath("planilla-acciones.png");
      await screenshotRosterRows(page, expandedScreenshot);
      await testInfo.attach("planilla-acciones", { path: expandedScreenshot, contentType: "image/png" });
      await page.setViewportSize(originalViewport);
      await playerRow.getByRole("button", { name: `Marcar lesionado a ${playerName}`, exact: true }).click();
      await expect(playerRow.getByText("Lesionado", { exact: true })).toBeVisible();
      await openPlayerActions(playerRow, playerName);
      await expect(playerRow.getByRole("button", { name: `Marcar recuperado a ${playerName}`, exact: true })).toBeVisible();
      await actions.click();
      await expect(actions).toHaveAttribute("aria-expanded", "false");
      await expect(playerRow.getByRole("button", { name: `Marcar recuperado a ${playerName}`, exact: true })).toBeHidden();
      await expect(playerRow.getByText("Lesionado", { exact: true })).toBeVisible();
      const injured = await standingsFor(page.request);
      expect(injured.find((player) => player.playerId === PLAYER_ID)).toMatchObject({ isInjured: true, isAbsent: false });
      expect(points(injured)).toEqual(points(initial));
      const injuredAnonymous = await standingsFor(anonymousRequest);
      expect(injuredAnonymous.find((player) => player.playerId === PLAYER_ID)).toMatchObject({ isInjured: true, isAbsent: false });
      expect(points(injuredAnonymous)).toEqual(points(initialAnonymous));

      await followNavigationLink(page, "Grupos");
      await followNavigationLink(page, "Ranking");
      await expect(rankingRow).toBeVisible();
      await expect(rankingRow.getByText("Lesionado", { exact: true })).toBeVisible();
      await expect(rankingRow.getByText("Inactivo", { exact: true })).toHaveCount(0);
      const excludeAbsent = page.getByRole("checkbox", { name: "Excluir inactivos", exact: true });
      await excludeAbsent.check();
      await expect(excludeAbsent).toBeChecked();
      await expect(rankingRow).toBeVisible();
      await expect(rankingRow.getByText("Lesionado", { exact: true })).toBeVisible();
      await anonymousPage.reload();
      await expect(anonymousRankingRow).toBeVisible();
      await expect(anonymousRankingRow.getByText("Lesionado", { exact: true })).toBeVisible();
      await expect(anonymousRankingRow.getByText("Inactivo", { exact: true })).toHaveCount(0);
      await anonymousPage.getByRole("checkbox", { name: "Excluir inactivos", exact: true }).check();
      await expect(anonymousRankingRow).toBeVisible();
      await expect(anonymousRankingRow.getByText("Lesionado", { exact: true })).toBeVisible();
      const size = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth }));
      expect(size.width).toBeLessThanOrEqual(size.viewport + 1);
      const screenshot = testInfo.outputPath("ranking-lesionado.png");
      await page.screenshot({ path: screenshot, animations: "disabled" });
      await testInfo.attach("ranking-lesionado", { path: screenshot, contentType: "image/png" });
    } finally {
      // This state belongs only to the accredited disposable fixture in app_dev.
      await page.goto(adminPath);
      await expect(playerRow).toBeVisible();
      await openPlayerActions(playerRow, playerName);
      const recover = playerRow.getByRole("button", { name: `Marcar recuperado a ${playerName}`, exact: true });
      if (await recover.isVisible()) {
        await recover.click();
      }
      await expect(playerRow.getByText("Lesionado", { exact: true })).toHaveCount(0);
      await openPlayerActions(playerRow, playerName);
      await expect(playerRow.getByRole("button", { name: `Marcar lesionado a ${playerName}`, exact: true })).toBeVisible();
    }

    const recovered = await standingsFor(page.request);
    expect(recovered.find((player) => player.playerId === PLAYER_ID)).toMatchObject({ isInjured: false, isAbsent: initialPlayer.isAbsent });
    expect(points(recovered)).toEqual(points(initial));
    const recoveredAnonymous = await standingsFor(anonymousRequest);
    expect(recoveredAnonymous.find((player) => player.playerId === PLAYER_ID)).toMatchObject({ isInjured: false, isAbsent: initialPlayer.isAbsent });
    expect(points(recoveredAnonymous)).toEqual(points(initialAnonymous));

    await followNavigationLink(page, "Grupos");
    await followNavigationLink(page, "Ranking");
    await expect(rankingRow).toBeVisible();
    await expect(rankingRow.getByText("Lesionado", { exact: true })).toHaveCount(0);
    await expect(rankingRow.getByText("Inactivo", { exact: true })).toHaveCount(initialPlayer.isAbsent ? 1 : 0);
    await anonymousPage.reload();
    await expect(anonymousRankingRow).toBeVisible();
    await expect(anonymousRankingRow.getByText("Lesionado", { exact: true })).toHaveCount(0);
    await expect(anonymousRankingRow.getByText("Inactivo", { exact: true })).toHaveCount(initialPlayer.isAbsent ? 1 : 0);
  } finally {
    await anonymousContext.close();
  }
});
