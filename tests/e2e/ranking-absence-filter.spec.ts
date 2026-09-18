import { expect, test } from "@playwright/test";

import type { PlayerComputedStats } from "../../src/types/domain";
import { E2E_ORGANIZATION_ID } from "./test-data";

const ORG_SLUG = process.env.E2E_ORG_SLUG ?? "e2e-fabrica";
const STANDINGS_ENDPOINT = `/api/organizations/${E2E_ORGANIZATION_ID}/standings`;

const standings: PlayerComputedStats[] = [
  {
    playerId: "00000000-0000-4000-8000-202609180001",
    playerName: "Inactivo de prueba",
    currentRating: 1200,
    initialRank: 1,
    currentRank: 1,
    matchesPlayed: 6,
    wins: 4,
    draws: 0,
    losses: 2,
    winRate: 66.67,
    streak: "W1",
    recentResults: ["V", "D", "V", "D", "V"],
    goals: 0,
    assists: 0,
    mvpCount: 1,
    photoPath: null,
    isAbsent: true,
    isInjured: false,
    matchesSinceLastPlayed: 8,
    lastPlayedAt: "2026-09-10T21:00:00.000Z"
  },
  {
    playerId: "00000000-0000-4000-8000-202609180002",
    playerName: "Lesionado de prueba",
    currentRating: 1100,
    initialRank: 2,
    currentRank: 2,
    matchesPlayed: 4,
    wins: 3,
    draws: 0,
    losses: 1,
    winRate: 75,
    streak: "W1",
    recentResults: ["V", "D", "V", "V"],
    goals: 0,
    assists: 0,
    mvpCount: 2,
    photoPath: null,
    isAbsent: false,
    isInjured: true,
    matchesSinceLastPlayed: 8,
    lastPlayedAt: "2026-07-10T01:00:00.000Z"
  },
  {
    playerId: "00000000-0000-4000-8000-202609180003",
    playerName: "Activo de prueba",
    currentRating: 1050,
    initialRank: 3,
    currentRank: 3,
    matchesPlayed: 3,
    wins: 2,
    draws: 0,
    losses: 1,
    winRate: 66.67,
    streak: "W1",
    recentResults: ["V", "D", "V"],
    goals: 0,
    assists: 0,
    mvpCount: 0,
    photoPath: null,
    isAbsent: false,
    isInjured: false,
    matchesSinceLastPlayed: 0,
    lastPlayedAt: "2026-09-17T21:00:00.000Z"
  },
  {
    playerId: "00000000-0000-4000-8000-202609180004",
    playerName: "Inactivo por mes",
    currentRating: 1000,
    initialRank: 4,
    currentRank: 4,
    matchesPlayed: 1,
    wins: 0,
    draws: 1,
    losses: 0,
    winRate: 0,
    streak: "D1",
    recentResults: ["E"],
    goals: 0,
    assists: 0,
    mvpCount: 0,
    photoPath: null,
    isAbsent: true,
    isInjured: false,
    matchesSinceLastPlayed: 0,
    lastPlayedAt: "2026-08-10T21:00:00.000Z"
  },
  {
    playerId: "00000000-0000-4000-8000-202609180005",
    playerName: "Jugador sin debut",
    currentRating: 1000,
    initialRank: 5,
    currentRank: 5,
    matchesPlayed: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    winRate: 0,
    streak: "-",
    recentResults: [],
    goals: 0,
    assists: 0,
    mvpCount: 0,
    photoPath: null,
    isAbsent: true,
    isInjured: false,
    matchesSinceLastPlayed: 0,
    lastPlayedAt: null
  }
];

test("ranking filtra inactivos, conserva lesionados y puestos a 320 px y escritorio", async ({ page, context }, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 320, height: 850 });
  // The mocked activity corresponds to this date in Buenos Aires.
  const initialTime = new Date("2026-09-18T15:00:00.000Z").getTime();
  await page.clock.setFixedTime(initialTime);
  let standingsRequests = 0;
  await page.route(`**${STANDINGS_ENDPOINT}?**`, async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    standingsRequests += 1;
    await route.fulfill({ status: 200, json: { organizationId: E2E_ORGANIZATION_ID, standings } });
  });

  await page.goto(`/ranking?org=${ORG_SLUG}&season=all`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ranking");
  const checkbox = page.getByRole("checkbox", { name: "Excluir inactivos" });
  await expect(checkbox).not.toBeChecked();
  // Confirm hydration before requesting fresh client data through the reconnect handler.
  await checkbox.check();
  await expect(checkbox).toBeChecked();
  await checkbox.uncheck();
  await context.setOffline(true);
  await page.clock.setFixedTime(initialTime + 120_000);
  await context.setOffline(false);
  await expect.poll(() => standingsRequests).toBeGreaterThan(0);
  await expect(page.getByText("Inactivo de prueba", { exact: true }).filter({ visible: true })).toBeVisible();

  for (const viewport of [{ width: 320, height: 850 }, { width: 1440, height: 1000 }]) {
    await page.setViewportSize(viewport);
    await expect(checkbox).not.toBeChecked();
    await expect(page.getByText("Inactivo", { exact: true }).filter({ visible: true })).toHaveCount(3);
    await expect(page.getByText("Lesionado", { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(page.getByText("8 partidos sin jugar", { exact: true }).filter({ visible: true })).toHaveCount(2);
    await expect(page.getByText("Inactivo por mes", { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(page.getByText("Jugador sin debut", { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(page.getByText("Sin debut", { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(checkbox).toHaveAccessibleDescription(/8 partidos finalizados seguidos sin jugar o 1 mes calendario desde el último partido\. Sin debut, se considera inactivo\./);
    await expect(page.getByText("10/07/2026", { exact: true }).filter({ visible: true })).toBeVisible();

    await checkbox.check();
    await expect(page.getByText("Inactivo de prueba", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Inactivo por mes", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Jugador sin debut", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Lesionado de prueba", { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(page.getByText("Lesionado", { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(page.getByText("Mostrando 2 de 5 jugadores · Se conservan los puestos", { exact: true })).toBeVisible();

    if (viewport.width === 320) {
      await expect(page.getByLabel(/^Estadísticas de Lesionado de prueba: puesto 2,/)).toBeVisible();
      await expect(page.getByLabel(/^Estadísticas de Activo de prueba: puesto 3,/)).toBeVisible();
    } else {
      const rows = page.getByRole("table").getByRole("row");
      await expect(rows).toHaveCount(3);
      await expect(rows.nth(1).getByRole("cell").first()).toHaveText("#2");
      await expect(rows.nth(2).getByRole("cell").first()).toHaveText("#3");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width + 1);
    await checkbox.scrollIntoViewIfNeeded();
    const screenshot = testInfo.outputPath(`ranking-absence-${viewport.width}px.png`);
    await page.screenshot({ path: screenshot, animations: "disabled", fullPage: true });
    await testInfo.attach(`ranking-absence-${viewport.width}px`, { path: screenshot, contentType: "image/png" });
    await checkbox.uncheck();
    await expect(page.getByText("Inactivo de prueba", { exact: true }).filter({ visible: true })).toBeVisible();
  }
});
