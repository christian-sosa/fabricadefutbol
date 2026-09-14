import { test, expect } from "@playwright/test";

const org = process.env.E2E_ORG_SLUG ?? "e2e-fabrica";

test("menú accesible en horizontal y navegación táctil a 320 px", async ({page}, testInfo) => {
  await page.setViewportSize({width: 640, height: 360});
  await page.goto(`/matches?org=${org}`);
  const toggle = page.getByRole("button", {name: "Abrir menu", exact: true});
  await expect(toggle).toBeVisible();
  await toggle.click();
  const menu = page.locator("#site-mobile-menu");
  await expect(menu).toBeVisible();
  const accountLink = menu.getByRole("link", {name: "Ingresar / Registro", exact: true});
  await accountLink.scrollIntoViewIfNeeded();
  await expect(accountLink).toBeInViewport();
  const headerSize = await page.locator("header").boundingBox();
  expect(headerSize!.height).toBeLessThanOrEqual(360);
  await accountLink.focus();
  await page.keyboard.press("Escape");
  await expect(menu).not.toBeVisible();
  await expect(toggle).toBeFocused();

  await page.setViewportSize({width: 320, height: 740});
  await toggle.click();
  const groupNav = menu.getByRole("navigation", {name: "Contenido del grupo"});
  const ranking = groupNav.getByRole("link", {name: "Ranking", exact: true});
  await expect(ranking).toBeVisible();
  const target = await ranking.boundingBox();
  expect(target!.height).toBeGreaterThanOrEqual(44);
  await ranking.click();
  await expect(page).toHaveURL((url) => url.pathname === "/ranking" && url.searchParams.get("org") === org);
  await expect(menu).not.toBeVisible();
  await expect(page.getByRole("heading", {level: 1})).toContainText("Ranking");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
  const screenshot = testInfo.outputPath("public-navigation-320px.png");
  await page.screenshot({path: screenshot, animations: "disabled"});
  await testInfo.attach("public-navigation-320px", {path: screenshot, contentType: "image/png"});
});
