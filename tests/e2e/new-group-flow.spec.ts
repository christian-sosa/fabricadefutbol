import { request as http } from "@playwright/test";

import { getCurrentMatchDateInput } from "../../src/lib/match-datetime";
import type { OrganizationStandingsResponse, UpdateMatchResultResponse } from "../../src/lib/query/types";
import { test, expect } from "./disposable-fixture";

test("crea grupo y plantel desde la UI; dos clientes compiten por el mismo resultado sin duplicar puntos ni figura", async ({ page, context, browser, isMobile, disposableAdmin }) => {
  test.setTimeout(180_000);
  const { client, userId } = disposableAdmin;
  const group = await disposableAdmin.createGroupWithUi(page);

  await page.goto(`/admin/new?org=${group.slug}`);
  await expect(page.getByRole("button", { name: "Crear grupo", exact: true })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Solicitar otro grupo", exact: true })).toBeVisible();

  const names = Array.from({ length: 10 }, (_, index) => `E2E Alta Jugador ${String(index + 1).padStart(2, "0")}`);
  await page.goto(`/admin/players?org=${group.slug}&view=new`);
  await page.getByLabel("Nombres de jugadores, uno por línea", { exact: true }).fill(names.join("\n"));
  await page.getByRole("button", { name: "Cargar lista de jugadores", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "10 jugadores cargados." })).toBeVisible();
  await page.reload();
  await expect(page.locator("[data-roster-player]")).toHaveCount(10);
  const roster = await client.from("players").select("id, full_name, current_rating").eq("organization_id", group.id).order("full_name").throwOnError();
  expect(roster.data?.map(({ full_name }) => full_name)).toEqual(names);
  expect(roster.data?.map(({ current_rating }) => Number(current_rating))).toEqual(Array(10).fill(1000));

  await page.goto(`/admin/matches/new?org=${group.slug}`);
  await page.locator('input[name="scheduledDate"]').fill(getCurrentMatchDateInput());
  await page.locator('input[name="scheduledTime"]').fill("20:00");
  await page.getByRole("combobox", { name: "Modalidad", exact: true }).selectOption("5v5");
  for (const player of roster.data!) await page.locator(`input[name="playerIds"][value="${player.id}"]`).check();
  await page.getByRole("button", { name: "Crear partido y generar equipos", exact: true }).click();
  await expect(page).toHaveURL((url) => /^\/admin\/matches\/[0-9a-f-]{36}$/.test(url.pathname));
  const matchId = new URL(page.url()).pathname.split("/").at(-1)!;
  await page.getByRole("button", { name: "Confirmar esta opcion", exact: true }).first().click();
  await expect(page).toHaveURL((url) => url.pathname === `/matches/${matchId}` && url.searchParams.get("org") === group.slug);

  await page.evaluate(() => {
    window.open = (url) => { document.documentElement.dataset.e2eSharedUrl = String(url); return null; };
  });
  await page.getByRole("button", { name: "Compartir en WhatsApp", exact: true }).click();
  const target = new URL((await page.locator("html").getAttribute("data-e2e-shared-url"))!);
  expect(target.protocol).toBe(isMobile ? "whatsapp:" : "https:");
  expect(target.hostname).toBe(isMobile ? "send" : "web.whatsapp.com");
  const shared = new URL(target.searchParams.get("text")!.trim().split("\n").at(-1)!);
  expect(shared.pathname).toBe(`/matches/${matchId}`);
  expect(shared.searchParams.get("org")).toBe(group.slug);
  const anonymous = await browser.newContext();
  try {
    const visitor = await anonymous.newPage();
    await visitor.goto(shared.toString());
    const publicPlayers = visitor.getByRole("heading", { name: "Equipos confirmados", exact: true }).locator("..").getByRole("listitem");
    await expect(publicPlayers).toHaveCount(10);
    // List names share a span with avatar initials. Identify each participant by
    // the avatar's exact accessible name and assert the visible row text too.
    for (const name of names) {
      const row = publicPlayers.filter({ has: visitor.getByRole("img", { name: `Avatar de ${name}`, exact: true }) });
      await expect(row).toHaveCount(1);
      await expect(row).toBeVisible();
      await expect(row).toContainText(name);
    }
    await visitor.goto(`/admin/matches/${matchId}/result?org=${group.slug}`);
    await expect(visitor).toHaveURL((url) => url.pathname === "/admin/login");
    const denied = await visitor.request.patch(`/api/admin/organizations/${group.id}/matches/${matchId}/result`, {
      data: { expectedVersion: 0, scoreA: 9, scoreB: 0 }
    });
    expect(denied.status()).toBe(403);
    expect(await denied.json()).toMatchObject({ error: expect.stringMatching(/iniciar sesion|no autorizado/i) });
  } finally {
    await anonymous.close();
  }

  await page.goto(`/admin/matches/${matchId}/result?org=${group.slug}`);
  const payload = page.locator('input[name="lineupPayload"]');
  await expect(payload).toHaveValue(/"assignments"/);
  const lineup = JSON.parse(await payload.inputValue()) as { assignments: Array<{ participantId: string; team: "A" | "B" }> };
  expect(lineup.assignments.map(({ participantId }) => participantId).sort()).toEqual(roster.data!.map(({ id }) => `player:${id}`).sort());
  expect(lineup.assignments.filter(({ team }) => team === "A")).toHaveLength(5);
  expect(lineup.assignments.filter(({ team }) => team === "B")).toHaveLength(5);
  const version = Number(await page.locator('input[name="expectedVersion"]').inputValue());
  const storageState = await context.storageState();
  const firstClient = await http.newContext({ baseURL: new URL(page.url()).origin, storageState });
  const secondClient = await http.newContext({ baseURL: new URL(page.url()).origin, storageState });
  const endpoint = `/api/admin/organizations/${group.id}/matches/${matchId}/result`;
  const contestants = [
    { expectedVersion: version, scoreA: 3, scoreB: 1, mvpParticipantId: `player:${roster.data![0].id}`, lineup },
    { expectedVersion: version, scoreA: 1, scoreB: 3, mvpParticipantId: `player:${roster.data![1].id}`, lineup }
  ];
  try {
    await disposableAdmin.assertSafe();
    // Independent HTTP clients dispatch together; this is a real write race,
    // unlike submitting an already-stale form after another request finished.
    const responses = await Promise.all([
      firstClient.patch(endpoint, { data: contestants[0] }),
      secondClient.patch(endpoint, { data: contestants[1] })
    ]);
    expect(responses.map((response) => response.status()).sort()).toEqual([200, 409]);
    const winningIndex = responses[0].status() === 200 ? 0 : 1;
    const accepted = contestants[winningIndex];
    expect(await responses[winningIndex].json() as UpdateMatchResultResponse).toMatchObject({ success: true, firstFinished: true, resultVersion: version + 1 });
    expect(await responses[1 - winningIndex].json()).toMatchObject({ error: expect.stringMatching(/cambio mientras lo editabas/i) });

    const storedMatch = await client.from("matches").select("status, result_version").eq("id", matchId).eq("organization_id", group.id).single().throwOnError();
    expect(storedMatch.data).toEqual({ status: "finished", result_version: version + 1 });
    const storedResult = await client.from("match_result").select("score_a, score_b, mvp_player_id, created_by").eq("match_id", matchId).single().throwOnError();
    expect(storedResult.data).toEqual({ score_a: accepted.scoreA, score_b: accepted.scoreB, mvp_player_id: accepted.mvpParticipantId.slice("player:".length), created_by: userId });
    const history = await client.from("rating_history").select("player_id, delta, reason").eq("match_id", matchId).throwOnError();
    expect(history.data).toHaveLength(10);
    expect(new Set(history.data!.map(({ player_id }) => player_id)).size).toBe(10);
    expect(history.data!.every(({ reason }) => reason === "match_result")).toBe(true);
    const expectedWinner = accepted.scoreA > accepted.scoreB ? "A" : "B";
    const expectedPoints = Object.fromEntries(lineup.assignments.map(({ participantId, team }) => [participantId.slice("player:".length), team === expectedWinner ? 1010 : 990]));
    expect(Object.fromEntries(history.data!.map(({ player_id, delta }) => [player_id, 1000 + Number(delta)]))).toEqual(expectedPoints);
    const response = await page.request.get(`/api/organizations/${group.id}/standings?season=current`);
    expect(response.ok()).toBe(true);
    const { standings } = await response.json() as OrganizationStandingsResponse;
    expect(standings).toHaveLength(10);
    expect(new Set(standings.map(({ playerId }) => playerId)).size).toBe(10);
    expect(Object.fromEntries(standings.map(({ playerId, currentRating }) => [playerId, currentRating]))).toEqual(expectedPoints);
    expect(standings.reduce((total, player) => total + (player.mvpCount ?? 0), 0)).toBe(1);
    expect(standings.find(({ playerId }) => playerId === storedResult.data!.mvp_player_id)?.mvpCount).toBe(1);
    await page.goto(`/matches/${matchId}?org=${group.slug}`);
    await expect(page.getByRole("group", { name: `Negro ${accepted.scoreA}, Blanco ${accepted.scoreB}`, exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText(`Figura del partido: ${names[winningIndex]}`, { exact: true })).toBeVisible();
  } finally {
    await Promise.all([firstClient.dispose(), secondClient.dispose()]);
  }
});
