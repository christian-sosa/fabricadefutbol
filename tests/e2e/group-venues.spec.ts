import { getCurrentMatchDateInput } from "../../src/lib/match-datetime";
import { test, expect } from "./disposable-fixture";

test("administra una cancha y la usa al crear, editar y repetir un partido", async ({ page, disposableAdmin }) => {
  test.setTimeout(180_000);
  const group = await disposableAdmin.createGroupWithUi(page);
  const { client } = disposableAdmin;
  await page.getByRole("link", { name: "Canchas", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/admin/venues" && url.searchParams.get("org") === group.slug);
  await expect(page.getByText("0 de 10 canchas activas", { exact: true })).toBeVisible();

  const createName = page.getByRole("textbox", { name: "Nombre de la cancha", exact: true });
  const createButton = page.getByRole("button", { name: "Agregar cancha", exact: true });
  await createName.fill(" Cancha  Norte ");
  await createButton.click();
  await expect(page.getByRole("textbox", { name: "Nombre de Cancha Norte", exact: true })).toHaveValue("Cancha Norte");
  const stored = await client.from("organization_venues").select("id").eq("organization_id", group.id).single().throwOnError();
  const venueId = stored.data!.id;

  await page.getByRole("textbox", { name: "Nombre de Cancha Norte", exact: true }).fill("Cancha del Parque");
  await page.getByRole("button", { name: "Guardar nombre de Cancha Norte", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Nombre de Cancha del Parque", exact: true })).toHaveValue("Cancha del Parque");

  await page.getByRole("button", { name: "Archivar Cancha del Parque", exact: true }).click();
  await expect(page.getByText("0 de 10 canchas activas", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Nombre de Cancha del Parque", exact: true })).toHaveCount(0);
  await createName.fill("CANCHA DEL PARQUE");
  await createButton.click();
  await expect(page.getByRole("alert").filter({ hasText: "Ya existe una cancha con ese nombre" })).toBeVisible();

  const newMatchUrl = `/admin/matches/new?org=${group.slug}`;
  const venueSelect = page.getByRole("combobox", { name: "Cancha", exact: true });
  const savedVenue = venueSelect.getByRole("option", { name: "Cancha del Parque", exact: true });
  await page.goto(newMatchUrl);
  await expect(venueSelect).toBeVisible();
  await expect(savedVenue).toHaveCount(0);

  await page.getByRole("link", { name: "Canchas", exact: true }).click();
  await page.getByText("Canchas archivadas (1)", { exact: true }).click();
  await page.getByRole("button", { name: "Restaurar Cancha del Parque", exact: true }).click();
  await expect(page.getByText("1 de 10 canchas activas", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Nombre de Cancha del Parque", exact: true })).toHaveValue("Cancha del Parque");
  const restored = await client.from("organization_venues").select("id, name, archived_at").eq("organization_id", group.id).single().throwOnError();
  expect(restored.data).toEqual({ id: venueId, name: "Cancha del Parque", archived_at: null });

  await disposableAdmin.assertSafe();
  const roster = await client.from("players").insert(Array.from({ length: 10 }, (_, index) => ({
    organization_id: group.id,
    full_name: `E2E Canchas jugador ${index + 1}`,
    initial_rank: index + 1,
    current_rating: 1000,
    active: true
  }))).select("id").throwOnError();
  await page.goto(newMatchUrl);
  await expect(savedVenue).toHaveAttribute("value", venueId);
  await venueSelect.selectOption({ label: "Cancha del Parque" });
  await page.locator('input[name="scheduledDate"]').fill(getCurrentMatchDateInput());
  await page.locator('input[name="scheduledTime"]').fill("20:00");
  await page.getByRole("combobox", { name: "Modalidad", exact: true }).selectOption("5v5");
  for (const player of roster.data!) await page.locator(`input[name="playerIds"][value="${player.id}"]`).check();
  await page.getByRole("button", { name: "Crear partido y generar equipos", exact: true }).click();
  await expect(page).toHaveURL((url) => /^\/admin\/matches\/[0-9a-f-]{36}$/.test(url.pathname));
  const matchPath = new URL(page.url()).pathname;
  const matchId = matchPath.split("/").at(-1)!;
  const readMatchVenue = async () => (await client.from("matches").select("venue_id, location")
    .eq("id", matchId).eq("organization_id", group.id).single().throwOnError()).data;
  expect(await readMatchVenue()).toEqual({ venue_id: venueId, location: "Cancha del Parque" });

  await page.getByRole("button", { name: "Confirmar esta opcion", exact: true }).first().click();
  await expect(page).toHaveURL((url) => url.pathname === `/matches/${matchId}`);
  await expect(page.getByText("Cancha del Parque", { exact: true })).toBeVisible();
  await page.goto(`${newMatchUrl}&repeat=${matchId}`);
  await expect(page.getByRole("heading", { name: "Repetir partido", exact: true })).toBeVisible();
  await expect(venueSelect).toHaveValue(venueId);

  await page.goto(`${matchPath}?org=${group.slug}`);
  await page.getByText("Editar fecha y cancha", { exact: true }).click();
  await expect(venueSelect.locator("option:checked")).toHaveText("Cancha del Parque");
  await venueSelect.selectOption({ label: "Cancha por confirmar" });
  await Promise.all([
    page.waitForResponse((response) => new URL(response.url()).pathname === matchPath && response.request().method() === "POST"),
    page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
  ]);
  expect(await readMatchVenue()).toEqual({ venue_id: null, location: null });
});
