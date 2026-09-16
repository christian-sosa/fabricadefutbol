import { expect, test, type Locator, type Page } from "@playwright/test";

import { getCurrentMatchDateInput } from "../../src/lib/match-datetime";
import { E2E_ORGANIZATION_ID, E2E_PLAYER_IDS } from "./test-data";

const ORG_SLUG = process.env.E2E_ORG_SLUG ?? "e2e-fabrica";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!;

test.describe.configure({ mode: "serial" });

async function expectNoHorizontalOverflow(page: Page) {
  const size = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(size.width).toBeLessThanOrEqual(size.viewport + 1);
}

async function login(page: Page) {
  await page.goto(`/admin/login?next=${encodeURIComponent(`/admin?org=${ORG_SLUG}`)}`);
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Ingresar con email", exact: true }) });
  await form.getByLabel("Email", { exact: true }).fill(ADMIN_EMAIL);
  await form.getByLabel("Contraseña", { exact: true }).fill(ADMIN_PASSWORD);
  await form.getByRole("button", { name: "Ingresar con email", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/admin" && url.searchParams.get("org") === ORG_SLUG);
}

async function currentPoints(page: Page) {
  const response = await page.request.get(`/api/organizations/${E2E_ORGANIZATION_ID}/standings?season=current`);
  expect(response.ok()).toBe(true);
  const { standings } = await response.json() as { standings: Array<{ playerId: string; currentRating: number; mvpCount: number }> };
  return standings.map(({ playerId, currentRating, mvpCount }) => ({ playerId, currentRating, mvpCount }))
    .sort((a, b) => a.playerId.localeCompare(b.playerId));
}

async function placeTeamPlayers(region: Locator, teamLabel: string, expectedPlayers: number) {
  const pitch = region.getByRole("group", { name: `Cancha de ${teamLabel}`, exact: true });
  const emptySlots = pitch.getByRole("button", { name: /: Elegir jugador$/ });
  await expect(emptySlots).toHaveCount(expectedPlayers - 1);
  await expect(pitch.getByRole("button", { name: /^Arco: E2E Jugador / })).toHaveCount(1);

  for (let index = 0; index < expectedPlayers - 1; index += 1) {
    const empty = emptySlots.first();
    const position = (await empty.getAttribute("aria-label"))!.replace(": Elegir jugador", "");
    await empty.click();
    const pool = region.getByRole("searchbox", { name: `Jugadores disponibles de ${teamLabel}`, exact: true }).locator("..");
    const available = pool.getByRole("button").first();
    const playerName = (await available.innerText()).trim();
    await available.click();
    await expect(pitch.getByRole("button", { name: `${position}: ${playerName}`, exact: true })).toBeVisible();
  }

  await expect(emptySlots).toHaveCount(0);
  await expect(pitch.getByRole("button")).toHaveCount(expectedPlayers);
  const bounds = await pitch.evaluate((element) => {
    const pitchRect = element.getBoundingClientRect();
    return [...element.querySelectorAll("button")].map((button) => {
      const rect = button.getBoundingClientRect();
      return {
        width: rect.width, height: rect.height,
        withinPitch: rect.left >= pitchRect.left - 1 && rect.right <= pitchRect.right + 1
      };
    });
  });
  for (const slot of bounds) {
    expect(slot.width).toBeGreaterThanOrEqual(44);
    expect(slot.height).toBeGreaterThanOrEqual(44);
    expect(slot.withinPitch).toBe(true);
  }
  return pitch.getByRole("button").evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")));
}

for (const scenario of [
  { modality: "5v5", size: 5, guests: 0, schemeA: "2-2", schemeB: "1-2-1" },
  { modality: "6v6", size: 6, guests: 2, schemeA: "2-2-1", schemeB: "1-3-1" },
  { modality: "7v7", size: 7, guests: 4, schemeA: "2-3-1", schemeB: "3-1-2" },
  { modality: "9v9", size: 9, guests: 8, schemeA: "4-2-2", schemeB: "2-4-2" },
  { modality: "10v10", size: 10, guests: 10, schemeA: "3-3-3", schemeB: "4-4-1" },
  { modality: "11v11", size: 11, guests: 12, schemeA: "3-5-2", schemeB: "4-2-3-1" }
]) {
  test(`${scenario.modality}: oculta niveles, arma las canchas y comparte una formación persistente a 320px`, async ({ page, browser }, testInfo) => {
    test.setTimeout(240_000);
    const originalViewport = page.viewportSize()!;
    await login(page);
    const pointsBefore = await currentPoints(page);
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(`/admin/matches/new?org=${ORG_SLUG}`);
    await page.locator('input[name="scheduledDate"]').fill(getCurrentMatchDateInput());
    await page.locator('input[name="scheduledTime"]').fill("20:15");
    await page.getByRole("combobox", { name: "Modalidad", exact: true }).selectOption(scenario.modality);

    const names: string[] = [];
    for (const playerId of E2E_PLAYER_IDS) {
      const checkbox = page.locator(`input[name="playerIds"][value="${playerId}"]`);
      names.push((await checkbox.getAttribute("aria-label"))!.replace(/^Juega /, ""));
      await checkbox.check();
    }
    for (const playerId of [E2E_PLAYER_IDS[0], E2E_PLAYER_IDS[5]]) {
      await page.locator(`input[name="goalkeeperPlayerIds"][value="${playerId}"]`).check();
    }
    for (let index = 0; index < scenario.guests; index += 1) {
      const name = index === 0 ? `E2E ${scenario.modality} Invitado con nombre extenso para pantalla chica` : `E2E ${scenario.modality} Invitado ${index + 1}`;
      names.push(name);
      await page.getByRole("button", { name: "Agregar invitado", exact: true }).click();
      await page.getByRole("textbox", { name: `Nombre del invitado ${index + 1}`, exact: true }).fill(name);
      await page.getByRole("combobox", { name: `Nivel de ${name}`, exact: true }).selectOption(String(index % 7 + 1));
    }
    await page.getByRole("button", { name: "Crear partido y generar equipos", exact: true }).click();
    await expect(page).toHaveURL((url) => /^\/admin\/matches\/[0-9a-f-]{36}$/.test(url.pathname));
    const matchId = new URL(page.url()).pathname.split("/").at(-1)!;
    const main = page.getByRole("main");
    await expect(main.getByText(/Nivel \d/).first()).toBeVisible();
    await page.getByRole("button", { name: "Ocultar niveles", exact: true }).click();
    await expect(main.getByText(/Nivel \d|Viene bien|Viene mal/)).toHaveCount(0);
    await expect(main.getByText(/Parejo perfecto|Muy parejo|Buen balance|Balance ajustado|Para revisar|Sin ventaja clara|inclina para|ventaja para|mas fuerte/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Mostrar niveles", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expectNoHorizontalOverflow(page);

    const teamA = `Azules ${scenario.modality}`;
    const teamB = `Rojos ${scenario.modality}`;
    await page.getByText("Personalizar nombres (opcional)", { exact: true }).first().click();
    await page.getByLabel("Nombre del primer equipo", { exact: true }).first().fill(teamA);
    await page.getByLabel("Nombre del segundo equipo", { exact: true }).first().fill(teamB);
    await page.getByRole("button", { name: "Confirmar esta opcion", exact: true }).first().click();
    await expect(page).toHaveURL((url) => url.pathname === `/matches/${matchId}` && url.searchParams.get("org") === ORG_SLUG);
    await expect(page.getByRole("heading", { name: "Equipos confirmados", exact: true }).locator("..").getByRole("listitem")).toHaveCount(scenario.size * 2);
    await page.goto(`/admin/matches/${matchId}?org=${ORG_SLUG}`);
    await expect(page.getByRole("heading", { name: "Formaciones en cancha", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Guardar formaciones", exact: true })).toBeDisabled();
    await page.getByRole("combobox", { name: `Esquema de ${teamA}`, exact: true }).selectOption(scenario.schemeA);
    await page.getByRole("combobox", { name: `Esquema de ${teamB}`, exact: true }).selectOption(scenario.schemeB);

    const regionA = page.getByRole("region", { name: `Formación de ${teamA}`, exact: true });
    const regionB = page.getByRole("region", { name: `Formación de ${teamB}`, exact: true });
    const positionsA = await placeTeamPlayers(regionA, teamA, scenario.size);
    const positionsB = await placeTeamPlayers(regionB, teamB, scenario.size);
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: "Guardar formaciones", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Formaciones guardadas. El enlace compartido ya muestra las canchas." })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("combobox", { name: `Esquema de ${teamA}`, exact: true })).toHaveValue(scenario.schemeA);
    await expect(page.getByRole("combobox", { name: `Esquema de ${teamB}`, exact: true })).toHaveValue(scenario.schemeB);
    await expect.poll(() => regionA.getByRole("group").getByRole("button").evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")))).toEqual(positionsA);
    await expect.poll(() => regionB.getByRole("group").getByRole("button").evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")))).toEqual(positionsB);

    // Capture the real share destination without opening WhatsApp or sending a message.
    await page.evaluate(() => {
      window.open = (url) => {
        document.documentElement.dataset.e2eSharedUrl = String(url);
        return null;
      };
    });
    await page.getByRole("button", { name: "Compartir en WhatsApp", exact: true }).click();
    const shareTarget = new URL((await page.locator("html").getAttribute("data-e2e-shared-url"))!);
    const message = shareTarget.searchParams.get("text")!;
    expect(message).toContain(`${teamA} vs ${teamB}`);
    const sharedUrl = new URL(message.trim().split("\n").at(-1)!);
    expect(sharedUrl.origin).toBe(new URL(page.url()).origin);
    expect(sharedUrl.pathname).toBe(`/matches/${matchId}`);
    expect(sharedUrl.searchParams.get("org")).toBe(ORG_SLUG);

    const publicContext = await browser.newContext({ viewport: { width: 320, height: 900 } });
    try {
      const publicPage = await publicContext.newPage();
      await publicPage.goto(sharedUrl.toString());
      const publicTeams = publicPage.getByRole("heading", { name: "Equipos confirmados", exact: true }).locator("..");
      await expect(publicTeams.getByRole("group", { name: /^Cancha de / })).toHaveCount(2);
      await expect(publicTeams.getByRole("list")).toHaveCount(0);
      await expect(publicTeams.getByRole("img")).toHaveCount(scenario.size * 2);
      await expect(publicTeams.getByText(/Nivel \d|Viene bien|Viene mal/)).toHaveCount(0);
      await expect(publicTeams.locator("svg text, svg tspan")).toHaveCount(0);
      for (const name of names) await expect(publicTeams.getByText(name, { exact: true })).toBeVisible();
      const publicPositionsA = publicTeams.getByRole("group", { name: `Cancha de ${teamA}`, exact: true });
      const publicPositionsB = publicTeams.getByRole("group", { name: `Cancha de ${teamB}`, exact: true });
      expect(await publicPositionsA.getByRole("img").evaluateAll((slots) => slots.map((slot) => slot.getAttribute("aria-label")))).toEqual(positionsA);
      expect(await publicPositionsB.getByRole("img").evaluateAll((slots) => slots.map((slot) => slot.getAttribute("aria-label")))).toEqual(positionsB);
      await expectNoHorizontalOverflow(publicPage);
      const screenshot = testInfo.outputPath(`${scenario.modality}-cancha-320px.png`);
      await publicPositionsA.screenshot({ path: screenshot, animations: "disabled" });
      await testInfo.attach(`${scenario.modality}-cancha-320px`, { path: screenshot, contentType: "image/png" });
      await publicPage.setViewportSize(originalViewport);
      await publicPage.reload();
      await expect(publicTeams.getByRole("group", { name: /^Cancha de / })).toHaveCount(2);
      await expectNoHorizontalOverflow(publicPage);

      await page.getByRole("button", { name: "Mostrar lista en el enlace", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: "El enlace vuelve a mostrar la lista de equipos." })).toBeVisible();
      await publicPage.reload();
      await expect(publicTeams.getByRole("group", { name: /^Cancha de / })).toHaveCount(0);
      await expect(publicTeams.getByRole("listitem")).toHaveCount(scenario.size * 2);
    } finally {
      await publicContext.close();
    }

    expect(await currentPoints(page)).toEqual(pointsBefore);
    // Only delete the unplayed match created by this case; leave the shared roster and historical fixtures intact.
    await page.getByRole("button", { name: "Borrar partido", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/admin" && url.searchParams.get("org") === ORG_SLUG);
  });
}
