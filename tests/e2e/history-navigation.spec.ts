import { expect, test, type Page } from "@playwright/test";

import type { OrganizationMatchesResponse } from "../../src/lib/query/types";
import { E2E_ORGANIZATION_ID } from "./test-data";

const ORG_SLUG = process.env.E2E_ORG_SLUG ?? "e2e-fabrica";
const HISTORY_ENDPOINT = `/api/organizations/${E2E_ORGANIZATION_ID}/matches`;
const LONG_MVP = "Figura con nombre y apellido extensos " + "ApellidoSinEspacios".repeat(5);

function historyPage(page: number): OrganizationMatchesResponse {
  const firstIndex = (page - 1) * 10;
  return {
    organizationId: E2E_ORGANIZATION_ID,
    matches: Array.from({ length: page === 3 ? 1 : 10 }, (_, offset) => {
      const index = firstIndex + offset + 1;
      return {
        id: `00000000-0000-4000-8000-20260914${String(index).padStart(4, "0")}`,
        scheduledAt: `2026-09-${String(22 - index).padStart(2, "0")}T21:00:00.000Z`,
        modality: "6v6" as const,
        status: "finished" as const,
        team_a_label: "Verdes",
        team_b_label: "Azules",
        scoreA: 3,
        scoreB: 2,
        winnerTeam: "A" as const,
        mvpDisplayName: page === 2 && offset === 0 ? LONG_MVP : `Figura de prueba ${index}`
      };
    }),
    pagination: { page, pageSize: 10, totalCount: 21, totalPages: 3, hasNextPage: page < 3, hasPreviousPage: page > 1 }
  };
}

async function expectHistoryPage(page: Page, selectedPage: number) {
  await expect(page).toHaveURL((url) => url.pathname === "/matches"
    && url.searchParams.get("org") === ORG_SLUG
    && url.searchParams.get("season") === "all"
    && Number(url.searchParams.get("page") ?? "1") === selectedPage);
}

test("historial recupera conexión, reintenta la página correcta y conserva navegación a 320px", async ({ page, context }, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 320, height: 800 });
  const initialTime = Date.now();
  await page.clock.setFixedTime(initialTime);

  let failPageTwo = true;
  const requestedPages: number[] = [];
  await page.route(`**${HISTORY_ENDPOINT}?**`, async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    const requestedPage = Number(new URL(route.request().url()).searchParams.get("page") ?? "1");
    requestedPages.push(requestedPage);
    if (requestedPage === 2 && failPageTwo) {
      await route.fulfill({ status: 503, json: { error: "No pudimos cargar el historial de prueba." } });
      return;
    }
    await route.fulfill({ status: 200, json: historyPage(requestedPage) });
  });

  await page.goto(`/matches?org=${ORG_SLUG}&season=all`);
  await expectHistoryPage(page, 1);
  await expect(page.getByRole("heading", { level: 1, name: "Historial de partidos" })).toBeVisible();
  const initialResponse = await page.request.get(`${HISTORY_ENDPOINT}?season=all&page=1&pageSize=10`);
  expect(initialResponse.ok()).toBe(true);
  const initialPage = await initialResponse.json() as OrganizationMatchesResponse;
  if (initialPage.pagination.totalPages > 1) {
    await expect(page.getByText(/^Página 1 de /)).toBeVisible();
  } else {
    await expect(page.getByRole("button", { name: "Siguiente", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Anterior", exact: true })).toHaveCount(0);
  }
  // An observable interaction establishes hydration before exercising the browser's online event.
  const groupPicker = page.getByRole("main").locator("summary").filter({ hasText: "Cambiar grupo" });
  await groupPicker.click();
  const groupSearch = page.getByRole("searchbox", { name: "Buscar grupo por nombre" });
  await groupSearch.fill("grupo-inexistente-para-prueba-de-hidratacion");
  await expect(page.getByText("No encontramos grupos con ese termino.", { exact: true })).toBeVisible();
  await groupSearch.clear();
  await groupPicker.click();

  await context.setOffline(true);
  await page.clock.setFixedTime(initialTime + 120_000);
  await context.setOffline(false);
  await expect.poll(() => requestedPages.filter((value) => value === 1).length).toBe(1);
  await expect(page.getByText("Página 1 de 3 · 21 partidos", { exact: true })).toBeVisible();
  await expect(page.getByText("Figura: Figura de prueba 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "Verdes 3, Azules 2", exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await expectHistoryPage(page, 2);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("No pudimos cargar los datos");
  await expect(page.getByText("Página 2", { exact: true })).toBeVisible();
  await expect(page.getByText("Figura: Figura de prueba 1", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Siguiente", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Anterior", exact: true })).toBeEnabled();
  const failedPageTwoAttempts = requestedPages.filter((value) => value === 2).length;
  expect(failedPageTwoAttempts).toBeGreaterThan(0);

  failPageTwo = false;
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(page.getByText("Página 2 de 3 · 21 partidos", { exact: true })).toBeVisible();
  expect(requestedPages.filter((value) => value === 2)).toHaveLength(failedPageTwoAttempts + 1);
  expect(requestedPages).not.toContain(3);
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);

  const mvp = page.getByText(`Figura: ${LONG_MVP}`, { exact: true });
  const detail = page.getByRole("link", { name: "Ver detalle", exact: true }).filter({ visible: true }).first();
  await expect(mvp).toBeVisible();
  await mvp.scrollIntoViewIfNeeded();
  await expect(detail).toHaveAttribute("href", `/matches/${historyPage(2).matches[0].id}?org=${ORG_SLUG}&season=all&page=2`);
  expect(await mvp.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  const documentSize = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(documentSize.width).toBeLessThanOrEqual(documentSize.viewport + 1);
  const detailBounds = await detail.boundingBox();
  expect(detailBounds).not.toBeNull();
  expect(detailBounds!.height).toBeGreaterThanOrEqual(44);
  const screenshot = testInfo.outputPath("history-320px.png");
  await page.screenshot({ path: screenshot, animations: "disabled" });
  await testInfo.attach("history-320px", { path: screenshot, contentType: "image/png" });

  await page.goBack();
  await expectHistoryPage(page, 1);
  await expect(page.getByText("Página 1 de 3 · 21 partidos", { exact: true })).toBeVisible();
  await page.goForward();
  await expectHistoryPage(page, 2);
  await expect(page.getByText("Página 2 de 3 · 21 partidos", { exact: true })).toBeVisible();

  // APIRequestContext and the server render read the real disposable fixture, outside page.route.
  const actualResponse = await page.request.get(`${HISTORY_ENDPOINT}?season=all&page=2&pageSize=10`);
  expect(actualResponse.ok()).toBe(true);
  const actualPage = await actualResponse.json() as OrganizationMatchesResponse;
  expect(actualPage.pagination.page).toBe(2);
  await page.reload();
  await expectHistoryPage(page, 2);
  const outsideRange = actualPage.pagination.totalPages < 2;
  const reloadedPagination = outsideRange
    ? `Página 2 · ${actualPage.pagination.totalCount} partidos`
    : `Página 2 de ${actualPage.pagination.totalPages} · ${actualPage.pagination.totalCount} partidos`;
  await expect(page.getByText(reloadedPagination, { exact: true })).toBeVisible();
  await expect(page.getByText(`Figura: ${LONG_MVP}`, { exact: true })).toHaveCount(0);
  if (outsideRange) {
    await expect(page.getByText("No hay partidos en esta página.", { exact: true }).filter({ visible: true })).toBeVisible();
    await page.getByRole("button", { name: "Volver al inicio del historial", exact: true }).click();
    await expectHistoryPage(page, 1);
    await expect(page.getByText("Página 1 de 3 · 21 partidos", { exact: true })).toBeVisible();
  }
});
