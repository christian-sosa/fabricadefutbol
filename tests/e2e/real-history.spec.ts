import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";

import { getCurrentMatchDateInput } from "../../src/lib/match-datetime";
import type { OrganizationMatchesResponse, OrganizationStandingsResponse } from "../../src/lib/query/types";
import { test, expect } from "./disposable-fixture";

async function visibleMatchIds(page: Page, count: number) {
  const links = page.getByRole("link", { name: "Ver detalle", exact: true }).filter({ visible: true });
  await expect(links).toHaveCount(count);
  return links.evaluateAll((anchors) => anchors.map((anchor) => new URL((anchor as HTMLAnchorElement).href).pathname.split("/").at(-1)));
}

test("historial real pagina y filtra temporadas; ranking calcula ocho ausencias, lesión y debut desde PostgreSQL", async ({ page, disposableAdmin }) => {
  test.setTimeout(180_000);
  const group = await disposableAdmin.seedGroup();
  const { client, userId } = disposableAdmin;
  const today = getCurrentMatchDateInput();
  const year = Number(today.slice(0, 4));
  const currentSeason = randomUUID();
  const previousSeason = randomUUID();
  const previousLabel = `E2E Temporada ${year - 1}`;
  await client.from("organization_seasons").insert([
    { id: currentSeason, organization_id: group.id, label: `E2E Temporada ${year}`, duration_months: 12, starts_at: `${year}-01-01`, ends_at: `${year}-12-31`, status: "active", created_by: userId },
    { id: previousSeason, organization_id: group.id, label: previousLabel, duration_months: 12, starts_at: `${year - 1}-01-01`, ends_at: `${year - 1}-12-31`, status: "closed", created_by: userId }
  ]).throwOnError();
  const roleNames = ["E2E Historial ocho ausencias", "E2E Historial temporada anterior", "E2E Historial sin debut", "E2E Historial lesionado", "E2E Historial activo"];
  const players = Array.from({ length: 14 }, (_, index) => ({
    id: randomUUID(), organization_id: group.id,
    full_name: roleNames[index] ?? `E2E Historial jugador ${index + 1}`,
    initial_rank: index + 1, current_rating: 1000, active: true, is_injured: index === 3,
    created_at: `${year - 1}-01-01T12:00:00.000Z`
  }));
  await client.from("players").insert(players).throwOnError();
  const anchor = Date.parse(`${today}T12:00:00.000Z`);
  const matches = Array.from({ length: 13 }, (_, index) => ({
    id: randomUUID(), organization_id: group.id, created_by: userId, modality: "5v5" as const,
    scheduled_at: index < 11 ? new Date(anchor - index * 60_000).toISOString() : `${year - 1}-12-${index === 11 ? "16" : "15"}T12:00:00.000Z`,
    team_a_label: `E2E Fecha ${String(index + 1).padStart(2, "0")}`, team_b_label: "Visitantes",
    season_id: index < 11 ? currentSeason : previousSeason
  }));
  const options = matches.map((match) => ({ id: randomUUID(), match_id: match.id, option_number: 1, is_confirmed: true, rating_sum_a: 5000, rating_sum_b: 5000, rating_diff: 0, created_by: userId }));
  const lineups = matches.map((_, index) => {
    const members = [...players.slice(4)];
    if (index === 8) members.splice(8, 2, players[0], players[3]);
    if (index >= 11) members.splice(9, 1, players[1]);
    return members.map((player, position) => ({ participantId: `player:${player.id}`, fullName: player.full_name, source: "player", team: position < 5 ? "A" as const : "B" as const, penalized: false }));
  });
  // Seed only this newly accredited group. Draws preserve the 1,000-point
  // baseline; complete relational teams let the real queries calculate activity.
  await disposableAdmin.assertSafe();
  await client.from("matches").insert(matches).throwOnError();
  await client.from("team_options").insert(options).throwOnError();
  await client.from("match_players").insert(matches.flatMap((match, index) => lineups[index].map((member) => ({ match_id: match.id, player_id: member.participantId.slice("player:".length) })))).throwOnError();
  await client.from("team_option_players").insert(options.flatMap((option, index) => lineups[index].map((member) => ({ team_option_id: option.id, player_id: member.participantId.slice("player:".length), team: member.team })))).throwOnError();
  await client.from("matches").upsert(matches.map((match, index) => ({ ...match, status: "finished", confirmed_option_id: options[index].id, result_version: 1, lineup_snapshot: lineups[index], finished_at: match.scheduled_at }))).throwOnError();
  await client.from("match_result").insert(matches.map((match) => ({ match_id: match.id, score_a: 0, score_b: 0, winner_team: "DRAW", mvp_player_id: players[4].id, mvp_display_name: players[4].full_name, created_by: userId }))).throwOnError();

  const readHistory = async (season: string, selectedPage: number) => {
    const response = await page.request.get(`/api/organizations/${group.id}/matches?season=${season}&page=${selectedPage}&pageSize=10`);
    expect(response.ok()).toBe(true);
    return await response.json() as OrganizationMatchesResponse;
  };
  const allFirst = await readHistory("all", 1);
  const allSecond = await readHistory("all", 2);
  expect(allFirst.pagination).toEqual({ page: 1, pageSize: 10, totalCount: 13, totalPages: 2, hasNextPage: true, hasPreviousPage: false });
  expect(allSecond.pagination).toEqual({ page: 2, pageSize: 10, totalCount: 13, totalPages: 2, hasNextPage: false, hasPreviousPage: true });
  expect(allFirst.matches.map(({ id }) => id)).toEqual(matches.slice(0, 10).map(({ id }) => id));
  expect(allSecond.matches.map(({ id }) => id)).toEqual(matches.slice(10).map(({ id }) => id));
  expect(new Set([...allFirst.matches, ...allSecond.matches].map(({ id }) => id)).size).toBe(13);
  expect(allFirst.matches[0]).toMatchObject({ scoreA: 0, scoreB: 0, winnerTeam: "DRAW", mvpDisplayName: players[4].full_name });

  await page.goto(`/matches?org=${group.slug}&season=all`);
  expect(await visibleMatchIds(page, 10)).toEqual(matches.slice(0, 10).map(({ id }) => id));
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await expect(page).toHaveURL((url) => url.searchParams.get("page") === "2" && url.searchParams.get("season") === "all");
  await expect(page.getByText("Página 2 de 2 · 13 partidos", { exact: true })).toBeVisible();
  expect(await visibleMatchIds(page, 3)).toEqual(matches.slice(10).map(({ id }) => id));
  await page.getByRole("link", { name: "Ver detalle", exact: true }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL((url) => url.pathname === `/matches/${matches[10].id}`);
  await page.getByRole("link", { name: "Volver al historial", exact: true }).click();
  expect(await visibleMatchIds(page, 3)).toEqual(matches.slice(10).map(({ id }) => id));
  await page.reload();
  expect(await visibleMatchIds(page, 3)).toEqual(matches.slice(10).map(({ id }) => id));

  const currentSecond = await readHistory("current", 2);
  expect(currentSecond.pagination).toMatchObject({ totalCount: 11, totalPages: 2 });
  expect(currentSecond.matches.map(({ id }) => id)).toEqual([matches[10].id]);
  await page.goto(`/matches?org=${group.slug}&season=current&page=2`);
  await expect(page.getByText("Página 2 de 2 · 11 partidos", { exact: true })).toBeVisible();
  expect(await visibleMatchIds(page, 1)).toEqual([matches[10].id]);
  await page.getByRole("navigation", { name: "Filtrar temporada" }).getByRole("link", { name: previousLabel, exact: true }).click();
  await expect(page).toHaveURL((url) => url.searchParams.get("season") === previousSeason && !url.searchParams.has("page"));
  expect(await visibleMatchIds(page, 2)).toEqual(matches.slice(11).map(({ id }) => id));
  const previous = await readHistory(previousSeason, 1);
  expect(previous.pagination.totalCount).toBe(2);
  expect(previous.matches.map(({ id }) => id)).toEqual(matches.slice(11).map(({ id }) => id));
  const outside = await readHistory("current", 3);
  expect(outside.matches).toEqual([]);
  expect(outside.pagination).toMatchObject({ page: 3, totalCount: 11, totalPages: 2 });

  const readStandings = async (season: string) => {
    const response = await page.request.get(`/api/organizations/${group.id}/standings?season=${season}`);
    expect(response.ok()).toBe(true);
    return (await response.json() as OrganizationStandingsResponse).standings;
  };
  const all = await readStandings("all");
  const current = await readStandings("current");
  const old = await readStandings(previousSeason);
  expect(all).toHaveLength(14);
  expect(all.find(({ playerId }) => playerId === players[4].id)).toMatchObject({ matchesPlayed: 13, mvpCount: 13, currentRating: 1000, isAbsent: false });
  expect(current.find(({ playerId }) => playerId === players[4].id)).toMatchObject({ matchesPlayed: 11, mvpCount: 11, currentRating: 1000 });
  expect(old.find(({ playerId }) => playerId === players[4].id)).toMatchObject({ matchesPlayed: 2, mvpCount: 2, currentRating: 1000 });
  expect(all.find(({ playerId }) => playerId === players[1].id)).toMatchObject({ matchesPlayed: 2, currentRating: 1000 });
  expect(current.find(({ playerId }) => playerId === players[1].id)).toMatchObject({ matchesPlayed: 0, currentRating: 1000 });
  expect(old.find(({ playerId }) => playerId === players[1].id)).toMatchObject({ matchesPlayed: 2, currentRating: 1000 });
  for (const standings of [all, current, old]) {
    const absent = standings.find(({ playerId }) => playerId === players[0].id);
    const injured = standings.find(({ playerId }) => playerId === players[3].id);
    expect(absent).toMatchObject({ isAbsent: true, isInjured: false, matchesSinceLastPlayed: 8 });
    expect(injured).toMatchObject({ isAbsent: false, isInjured: true, matchesSinceLastPlayed: 8 });
    // PostgREST preserves a timestamptz offset rather than JavaScript's ISO Z.
    // Compare the actual instant, keeping the exact fixture date as the oracle.
    expect(Date.parse(absent!.lastPlayedAt!)).toBe(Date.parse(matches[8].scheduled_at));
    expect(Date.parse(injured!.lastPlayedAt!)).toBe(Date.parse(matches[8].scheduled_at));
    const previousSeasonOnly = standings.find(({ playerId }) => playerId === players[1].id);
    expect(previousSeasonOnly).toMatchObject({ isAbsent: true, isInjured: false, matchesSinceLastPlayed: 11 });
    expect(Date.parse(previousSeasonOnly!.lastPlayedAt!)).toBe(Date.parse(matches[11].scheduled_at));
    expect(standings.find(({ playerId }) => playerId === players[2].id)).toMatchObject({ matchesPlayed: 0, isAbsent: true, lastPlayedAt: null });
  }
  await page.goto(`/ranking?org=${group.slug}&season=current`);
  await expect(page.getByText(players[0].full_name, { exact: true }).filter({ visible: true })).toBeVisible();
  const inactive = page.getByText(players[0].full_name, { exact: true }).filter({ visible: true });
  const injured = page.getByText(players[3].full_name, { exact: true }).filter({ visible: true });
  const inactiveRow = page.locator("tbody tr, article").filter({ has: page.getByText(players[0].full_name, { exact: true }) }).filter({ visible: true });
  const injuredRow = page.locator("tbody tr, article").filter({ has: page.getByText(players[3].full_name, { exact: true }) }).filter({ visible: true });
  await expect(inactiveRow.getByText("Inactivo", { exact: true })).toBeVisible();
  await expect(injuredRow.getByText("Lesionado", { exact: true })).toBeVisible();
  await expect(injuredRow.getByText("Inactivo", { exact: true })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Excluir inactivos", exact: true }).check();
  await expect(inactive).toHaveCount(0);
  await expect(page.getByText(players[2].full_name, { exact: true }).filter({ visible: true })).toHaveCount(0);
  await expect(injured).toBeVisible();
  await expect(page.getByText(players[4].full_name, { exact: true }).filter({ visible: true })).toBeVisible();
});
