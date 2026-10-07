import { act, fireEvent, render as renderUi, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminPlayersPage from "@/app/admin/(panel)/players/page";
import { organizationQueryKeys } from "@/lib/query/keys";

const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), upload: vi.fn(), injury: vi.fn() }));
vi.mock("@/app/admin/(panel)/players/actions", () => ({ deletePlayerAction: vi.fn(), bulkCreatePlayersAction: vi.fn() }));
vi.mock("@/app/admin/(panel)/form-actions", () => ({ createPlayerFormAction: mocks.create, updatePlayersFormAction: mocks.update, uploadPlayerPhotoFormAction: mocks.upload, setPlayerInjuryFormAction: mocks.injury }));
vi.mock("@/components/admin/admin-current-group-card", () => ({ AdminCurrentGroupCard: () => <p>Grupo actual: Los viernes</p> }));
vi.mock("@/lib/auth/admin", () => ({ requireAdminOrganization: async () => ({ admin: {}, selectedOrganization: { id: "org-1", slug: "viernes", name: "Los viernes" } }), getOrganizationWriteAccess: async () => ({ canWrite: true }) }));
vi.mock("@/lib/queries/admin", () => ({ getAdminPlayers: async () => [
  { id: "player-1", full_name: "Ana Pérez", skill_level: 3, photo_path: null, is_injured: false, preferred_position: "DEF", secondary_position: "MID" },
  { id: "player-2", full_name: "Luz Díaz", skill_level: 4, photo_path: null, is_injured: true }
] }));
let queryClient: QueryClient;
beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } });
  window.sessionStorage.clear();
  mocks.create.mockReset().mockResolvedValue({ error: null });
  mocks.update.mockReset().mockResolvedValue({ error: null }); mocks.upload.mockReset(); mocks.injury.mockReset().mockResolvedValue({ error: null });
});

function render(element: ReactNode) {
  return renderUi(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);
}

describe("planilla de jugadores", () => {
  it("refresca rankings recientes del grupo, incluida otra temporada, antes de terminar el guardado", async () => {
    const user = userEvent.setup();
    const currentKey = organizationQueryKeys.standings("org-1");
    const historicalKey = organizationQueryKeys.standings("org-1", "all");
    const otherGroupKey = organizationQueryKeys.standings("org-2");
    const previous = [{ playerId: "player-1", isInjured: false }];
    const updated = [{ playerId: "player-1", isInjured: true }];
    let finishRefetch!: (data: typeof updated) => void;
    const fetchCurrent = vi.fn(() => new Promise<typeof updated>((resolve) => { finishRefetch = resolve; }));
    const fetchHistorical = vi.fn().mockResolvedValue(updated);
    const fetchOtherGroup = vi.fn().mockResolvedValue(previous);
    queryClient.setQueryDefaults(currentKey, { queryFn: fetchCurrent });
    queryClient.setQueryDefaults(historicalKey, { queryFn: fetchHistorical });
    queryClient.setQueryDefaults(otherGroupKey, { queryFn: fetchOtherGroup });
    for (const key of [currentKey, historicalKey, otherGroupKey]) queryClient.setQueryData(key, previous);
    render(await AdminPlayersPage({ searchParams: Promise.resolve({ view: "edit" }) }));
    const button = screen.getByRole("button", { name: "Marcar lesionado a Ana Pérez" });
    await user.click(button);
    await waitFor(() => expect(fetchCurrent).toHaveBeenCalledOnce());
    expect(fetchHistorical).toHaveBeenCalledOnce();
    expect(fetchOtherGroup).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
    await act(async () => { finishRefetch(updated); });
    await waitFor(() => expect(button).toBeEnabled());
    expect(queryClient.getQueryData(currentKey)).toEqual(updated);
    expect(queryClient.getQueryData(historicalKey)).toEqual(updated);
    expect(queryClient.getQueryData(otherGroupKey)).toEqual(previous);
  });

  it("muestra lesiones y permite marcarlas o quitarlas sin abrir las acciones secundarias", async () => {
    const user = userEvent.setup();
    render(await AdminPlayersPage({ searchParams: Promise.resolve({ view: "edit" }) }));
    const injuryButton = screen.getByRole("button", { name: "Marcar lesionado a Ana Pérez" });
    const recoverButton = screen.getByRole("button", { name: "Marcar recuperado a Luz Díaz" });
    expect(injuryButton).toBeVisible();
    expect(recoverButton).toBeVisible();
    expect(screen.getByText("Lesionado")).toBeVisible();
    expect(injuryButton).toHaveAccessibleDescription(/no se cuentan como inactivos/);
    await user.click(injuryButton);
    await waitFor(() => expect(mocks.injury).toHaveBeenCalledOnce());
    const marked = mocks.injury.mock.calls[0][0] as FormData;
    expect(Array.from(marked.entries())).toEqual([["organizationId", "org-1"], ["playerId", "player-1"], ["isInjured", "true"]]);
    await user.click(recoverButton);
    await waitFor(() => expect(mocks.injury).toHaveBeenCalledTimes(2));
    const recovered = mocks.injury.mock.calls[1][0] as FormData;
    expect(recovered.get("playerId")).toBe("player-2");
    expect(recovered.get("isInjured")).toBe("false");
  });

  it("protege la planilla sin guardar al intentar cambiar una lesión", async () => {
    const user = userEvent.setup();
    render(await AdminPlayersPage({ searchParams: Promise.resolve({ view: "edit" }) }));
    const name = screen.getByRole("textbox", { name: "Nombre de Ana Pérez" });
    await user.clear(name);
    await user.type(name, "Ana nueva");
    await user.click(screen.getByRole("button", { name: "Marcar lesionado a Ana Pérez" }));
    expect(mocks.injury).not.toHaveBeenCalled();
    expect(name).toHaveValue("Ana nueva");
    expect(screen.getByText(/Guardá o descartá la planilla antes de cambiar lesiones/)).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Descartar cambios" }));
    await user.click(screen.getByRole("button", { name: "Marcar lesionado a Ana Pérez" }));
    await waitFor(() => expect(mocks.injury).toHaveBeenCalledOnce());
  });

  it("bloquea edición durante una lesión pendiente y permite reintentar si falla", async () => {
    const user = userEvent.setup();
    let finishSave!: (result: { error: string | null }) => void;
    mocks.injury.mockImplementationOnce(() => new Promise((resolve) => { finishSave = resolve; }));
    render(await AdminPlayersPage({ searchParams: Promise.resolve({ view: "edit" }) }));
    const injuryButton = screen.getByRole("button", { name: "Marcar lesionado a Ana Pérez" });
    const name = screen.getByRole("textbox", { name: "Nombre de Ana Pérez" });
    await user.click(injuryButton);
    await waitFor(() => expect(mocks.injury).toHaveBeenCalledOnce());
    expect(injuryButton).toBeDisabled();
    expect(name).toBeDisabled();
    expect(screen.getByRole("button", { name: "Guardar toda la planilla" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Marcar recuperado a Luz Díaz" })).toBeDisabled();
    await act(async () => { finishSave({ error: "No se pudo guardar el estado de lesión." }); });
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar el estado de lesión.");
    expect(injuryButton).toBeEnabled();
    expect(name).toBeEnabled();
    expect(name).toHaveValue("Ana Pérez");
    await user.click(injuryButton);
    await waitFor(() => expect(mocks.injury).toHaveBeenCalledTimes(2));
    expect((mocks.injury.mock.calls[1][0] as FormData).get("isInjured")).toBe("true");
  });

  it("bloquea edición, descarte y fotos durante el guardado sin quitar datos del envío", async () => {
    const user = userEvent.setup();
    let finishSave!: (result: { error: string | null }) => void;
    mocks.update.mockImplementationOnce(() => new Promise((resolve) => { finishSave = resolve; }));
    render(await AdminPlayersPage({ searchParams: Promise.resolve({ view: "edit" }) }));
    const name = screen.getByRole("textbox", { name: "Nombre de Ana Pérez" });
    const level = screen.getByRole("combobox", { name: "Nivel de habilidad de Ana Pérez" });
    const preferredPosition = screen.getByRole("combobox", { name: "Posición preferida de Ana Pérez" });
    const secondaryPosition = screen.getByRole("combobox", { name: "Posición secundaria de Ana Pérez" });
    await user.clear(name);
    await user.type(name, "Ana nueva");
    await user.selectOptions(level, "6");
    await user.selectOptions(preferredPosition, "GK");
    await user.selectOptions(secondaryPosition, "DEF");
    await user.click(screen.getByText("Foto y acciones de Ana Pérez"));
    await user.click(screen.getByRole("button", { name: "Guardar toda la planilla" }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    const submitted = mocks.update.mock.calls[0][0] as FormData;
    expect(submitted.getAll("playerId")).toEqual(["player-1", "player-2"]);
    expect(submitted.getAll("fullName")).toEqual(["Ana nueva", "Luz Díaz"]);
    expect(submitted.getAll("skillLevel")).toEqual(["6", "4"]);
    expect(submitted.getAll("preferredPosition")).toEqual(["GK", ""]);
    expect(submitted.getAll("secondaryPosition")).toEqual(["DEF", ""]);
    expect(name).toBeDisabled();
    expect(level).toBeDisabled();
    expect(preferredPosition).toBeDisabled();
    expect(secondaryPosition).toBeDisabled();
    expect(screen.getByRole("button", { name: "Descartar cambios" })).toBeDisabled();
    for (const input of screen.getAllByLabelText("Foto del jugador")) expect(input).toBeDisabled();
    for (const button of screen.getAllByRole("button", { name: "Eliminar" })) expect(button).toBeDisabled();
    await user.type(name, " segunda edición");
    await user.click(screen.getByRole("button", { name: "Descartar cambios" }));
    expect(name).toHaveValue("Ana nueva");
    expect(level).toHaveValue("6");
    expect(preferredPosition).toHaveValue("GK");
    expect(secondaryPosition).toHaveValue("DEF");

    await act(async () => { finishSave({ error: "No se pudo guardar la planilla." }); });
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar la planilla.");
    expect(name).toBeEnabled();
    expect(level).toBeEnabled();
    expect(preferredPosition).toBeEnabled();
    expect(secondaryPosition).toBeEnabled();
    expect(name).toHaveValue("Ana nueva");
    expect(level).toHaveValue("6");
    expect(preferredPosition).toHaveValue("GK");
    expect(secondaryPosition).toHaveValue("DEF");
    expect(screen.getByRole("button", { name: "Descartar cambios" })).toBeEnabled();
    expect(window.sessionStorage.getItem("fdf:players-draft:v1:org-1")).toContain("Ana nueva");
    await user.type(name, " corregida");
    expect(name).toHaveValue("Ana nueva corregida");
  });
  it("protege los cambios frente a fotos y navegación y los recupera al volver", async () => {
    const user = userEvent.setup();
    const view = render(await AdminPlayersPage({ searchParams: Promise.resolve({ view: "edit" }) }));
    const name = screen.getByRole("textbox", { name: "Nombre de Ana Pérez" });
    await user.clear(name);
    await user.type(name, "Ana nueva");
    expect(screen.getByText("1 jugador con cambios sin guardar.")).toBeVisible();
    const details = screen.getByText("Foto y acciones de Ana Pérez").closest("details")!;
    fireEvent.submit(details.querySelector("form")!);
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(screen.getByText(/Guardá o descartá la planilla/)).toBeVisible();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await user.click(screen.getByRole("link", { name: "Alta de jugador" }));
    expect(confirm).toHaveBeenCalledOnce();
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    view.unmount();
    render(await AdminPlayersPage({ searchParams: Promise.resolve({ view: "edit" }) }));
    expect(screen.getByRole("textbox", { name: "Nombre de Ana Pérez" })).toHaveValue("Ana nueva");
    await user.click(screen.getByRole("button", { name: "Descartar cambios" }));
    expect(screen.getByRole("textbox", { name: "Nombre de Ana Pérez" })).toHaveValue("Ana Pérez");
    expect(window.sessionStorage.getItem("fdf:players-draft:v1:org-1")).toBeNull();
  });
  it("no restaura un borrador encima de una versión nueva guardada en servidor", async () => {
    window.sessionStorage.setItem("fdf:players-draft:v1:org-1", JSON.stringify({ "player-1": { name: "Edición vieja", level: "6", originalName: "Nombre anterior", originalLevel: "3" } }));
    render(await AdminPlayersPage({ searchParams: Promise.resolve({ view: "edit" }) }));
    expect(screen.getByRole("textbox", { name: "Nombre de Ana Pérez" })).toHaveValue("Ana Pérez");
    expect(screen.getByText("La planilla está guardada.")).toBeVisible();
  });
  it("edita nombres y niveles en un solo envío y mantiene fotos y baja como acciones secundarias", async () => {
    render(await AdminPlayersPage({ searchParams: Promise.resolve({ view: "edit" }) }));
    const user = userEvent.setup();
    const name = screen.getByRole("textbox", { name: "Nombre de Ana Pérez" });
    expect(name).toBeVisible();
    await user.clear(name); await user.type(name, "Ana Pérez nueva");
    await user.selectOptions(screen.getByRole("combobox", { name: "Nivel de habilidad de Ana Pérez" }), "6");
    for (const input of screen.getAllByLabelText("Foto del jugador")) expect(input).not.toBeVisible();
    for (const button of screen.getAllByRole("button", { name: "Eliminar" })) expect(button).not.toBeVisible();
    await user.click(screen.getByRole("button", { name: "Guardar toda la planilla" }));
    const data = mocks.update.mock.calls[0][0] as FormData;
    expect(data.getAll("playerId")).toEqual(["player-1", "player-2"]);
    expect(data.getAll("fullName")).toEqual(["Ana Pérez nueva", "Luz Díaz"]);
    expect(data.getAll("skillLevel")).toEqual(["6", "4"]);
    expect(data.has("currentRating")).toBe(false);
    await user.click(screen.getByText("Foto y acciones de Ana Pérez"));
    const details = screen.getByText("Foto y acciones de Ana Pérez").closest("details")!;
    expect(within(details).getByLabelText("Foto del jugador")).toBeVisible();
    expect(within(details).getByRole("button", { name: "Subir foto" })).toBeVisible();
  });
  it("abre la fila correcta para recuperar una foto fallida sin ofrecer otro alta", async () => {
    render(await AdminPlayersPage({ searchParams: Promise.resolve({ view: "edit", photoPlayer: "player-2", notice: "Jugador creado. Revisá la foto." }) }));
    expect(screen.getByText("Jugador creado. Revisá la foto.")).toHaveAttribute("role", "status");
    const details = screen.getByText("Foto y acciones de Luz Díaz").closest("details")!;
    expect(within(details).getByLabelText("Foto del jugador")).toBeVisible();
    const form = within(details).getByRole("button", { name: "Subir foto" }).closest("form")!;
    expect(new FormData(form).get("playerId")).toBe("player-2");
    expect(screen.queryByRole("button", { name: "Crear jugador" })).not.toBeInTheDocument();
  });

  it("permite crear con posiciones opcionales y las envía junto con el nivel", async () => {
    const user = userEvent.setup();
    render(await AdminPlayersPage({ searchParams: Promise.resolve({ view: "new" }) }));
    await user.type(screen.getByRole("textbox", { name: "Nombre completo del jugador" }), "Ana nueva");
    const preferred = screen.getByRole("combobox", { name: "Posición preferida" });
    const secondary = screen.getByRole("combobox", { name: "Posición secundaria" });
    expect(preferred).toHaveValue("");
    expect(secondary).toHaveValue("");
    expect(preferred).not.toBeRequired();
    expect(secondary).not.toBeRequired();
    expect(secondary).toBeDisabled();
    await user.selectOptions(preferred, "FWD");
    expect(secondary).toBeEnabled();
    expect(within(secondary).getByRole("option", { name: "Delantero" })).toBeDisabled();
    await user.selectOptions(secondary, "MID");
    await user.click(screen.getByRole("button", { name: "Crear jugador" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    const submitted = mocks.create.mock.calls[0][0] as FormData;
    expect(submitted.get("fullName")).toBe("Ana nueva");
    expect(submitted.get("skillLevel")).toBe("5");
    expect(submitted.get("preferredPosition")).toBe("FWD");
    expect(submitted.get("secondaryPosition")).toBe("MID");
  });

  it("limpia la secundaria incompatible y envía una entrada por jugador incluso sin preferencia", async () => {
    const user = userEvent.setup();
    render(await AdminPlayersPage({ searchParams: Promise.resolve({ view: "edit" }) }));
    const preferred = screen.getByRole("combobox", { name: "Posición preferida de Ana Pérez" });
    const secondary = screen.getByRole("combobox", { name: "Posición secundaria de Ana Pérez" });
    const otherSecondary = screen.getByRole("combobox", { name: "Posición secundaria de Luz Díaz" });
    expect(otherSecondary).toBeDisabled();
    await user.selectOptions(preferred, "MID");
    expect(secondary).toHaveValue("");
    expect(within(secondary).getByRole("option", { name: "Mediocampista" })).toBeDisabled();
    await user.selectOptions(secondary, "MID");
    expect(secondary).toHaveValue("");
    await user.selectOptions(secondary, "FWD");
    await user.selectOptions(preferred, "");
    expect(secondary).toHaveValue("");
    expect(secondary).toBeDisabled();
    await user.selectOptions(screen.getByRole("combobox", { name: "Posición preferida de Luz Díaz" }), "GK");
    await user.selectOptions(otherSecondary, "DEF");
    await user.click(screen.getByRole("button", { name: "Guardar toda la planilla" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    const submitted = mocks.update.mock.calls[0][0] as FormData;
    expect(submitted.getAll("preferredPosition")).toEqual(["", "GK"]);
    expect(submitted.getAll("secondaryPosition")).toEqual(["", "DEF"]);
  });

  it("sincroniza campos dependientes y FormData al restaurar y descartar un borrador vacío", async () => {
    const user = userEvent.setup();
    const view = render(await AdminPlayersPage({ searchParams: Promise.resolve({ view: "edit" }) }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Posición preferida de Ana Pérez" }), "");
    view.unmount();
    render(await AdminPlayersPage({ searchParams: Promise.resolve({ view: "edit" }) }));
    const preferred = screen.getByRole("combobox", { name: "Posición preferida de Ana Pérez" });
    const secondary = screen.getByRole("combobox", { name: "Posición secundaria de Ana Pérez" });
    const form = screen.getByRole("button", { name: "Guardar toda la planilla" }).closest("form")!;
    expect(preferred).toHaveValue("");
    expect(secondary).toHaveValue("");
    expect(secondary).toBeDisabled();
    expect(new FormData(form).getAll("secondaryPosition")).toEqual(["", ""]);
    await user.click(screen.getByRole("button", { name: "Descartar cambios" }));
    expect(preferred).toHaveValue("DEF");
    expect(secondary).toHaveValue("MID");
    expect(secondary).toBeEnabled();
    expect(within(secondary).getByRole("option", { name: "Defensor" })).toBeDisabled();
    expect(new FormData(form).getAll("secondaryPosition")).toEqual(["MID", ""]);
    expect(window.sessionStorage.getItem("fdf:players-draft:v1:org-1")).toBeNull();
  });

  it("restablece dependencias y borrador al resetear la planilla", async () => {
    const user = userEvent.setup();
    render(await AdminPlayersPage({ searchParams: Promise.resolve({ view: "edit" }) }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Posición preferida de Ana Pérez" }), "");
    await user.selectOptions(screen.getByRole("combobox", { name: "Posición preferida de Luz Díaz" }), "FWD");
    await user.selectOptions(screen.getByRole("combobox", { name: "Posición secundaria de Luz Díaz" }), "GK");
    const form = screen.getByRole("button", { name: "Guardar toda la planilla" }).closest("form")!;
    await act(async () => { form.reset(); });
    expect(screen.getByRole("combobox", { name: "Posición secundaria de Ana Pérez" })).toBeEnabled();
    expect(screen.getByRole("combobox", { name: "Posición secundaria de Luz Díaz" })).toBeDisabled();
    expect(new FormData(form).getAll("preferredPosition")).toEqual(["DEF", ""]);
    expect(new FormData(form).getAll("secondaryPosition")).toEqual(["MID", ""]);
    expect(window.sessionStorage.getItem("fdf:players-draft:v1:org-1")).toBeNull();
    expect(screen.getByText("La planilla está guardada.")).toBeVisible();
  });

  it("habilita la secundaria de un borrador sobre un jugador sin posiciones y la deshabilita al descartar", async () => {
    window.sessionStorage.setItem("fdf:players-draft:v1:org-1", JSON.stringify({ "player-2": {
      name: "Luz Díaz", level: "4", preferredPosition: "GK", secondaryPosition: "FWD",
      originalName: "Luz Díaz", originalLevel: "4", originalPreferredPosition: "", originalSecondaryPosition: ""
    } }));
    render(await AdminPlayersPage({ searchParams: Promise.resolve({ view: "edit" }) }));
    const secondary = screen.getByRole("combobox", { name: "Posición secundaria de Luz Díaz" });
    const form = screen.getByRole("button", { name: "Guardar toda la planilla" }).closest("form")!;
    expect(secondary).toHaveValue("FWD");
    expect(secondary).toBeEnabled();
    expect(within(secondary).getByRole("option", { name: "Arquero" })).toBeDisabled();
    expect(new FormData(form).getAll("secondaryPosition")).toEqual(["MID", "FWD"]);
    await userEvent.setup().click(screen.getByRole("button", { name: "Descartar cambios" }));
    expect(secondary).toHaveValue("");
    expect(secondary).toBeDisabled();
    expect(new FormData(form).getAll("secondaryPosition")).toEqual(["MID", ""]);
  });

  it("restablece la secundaria después de un alta exitosa", async () => {
    const user = userEvent.setup();
    render(await AdminPlayersPage({ searchParams: Promise.resolve({ view: "new" }) }));
    await user.type(screen.getByRole("textbox", { name: "Nombre completo del jugador" }), "Ana nueva");
    const preferred = screen.getByRole("combobox", { name: "Posición preferida" });
    const secondary = screen.getByRole("combobox", { name: "Posición secundaria" });
    await user.selectOptions(preferred, "FWD");
    await user.selectOptions(secondary, "MID");
    await user.click(screen.getByRole("button", { name: "Crear jugador" }));
    await waitFor(() => expect(preferred).toHaveValue(""));
    expect(secondary).toHaveValue("");
    expect(secondary).toBeDisabled();
    const form = screen.getByRole("button", { name: "Crear jugador" }).closest("form")!;
    expect(new FormData(form).getAll("secondaryPosition")).toEqual([""]);
  });

  it("considera las posiciones como cambios, protege acciones y navegación, y restaura o descarta el borrador", async () => {
    const user = userEvent.setup();
    const view = render(await AdminPlayersPage({ searchParams: Promise.resolve({ view: "edit" }) }));
    const preferred = screen.getByRole("combobox", { name: "Posición preferida de Ana Pérez" });
    const secondary = screen.getByRole("combobox", { name: "Posición secundaria de Ana Pérez" });
    expect(preferred).toHaveValue("DEF");
    expect(secondary).toHaveValue("MID");
    expect(preferred).toHaveAccessibleDescription(/si faltan posiciones/);
    expect(screen.getByRole("combobox", { name: "Posición preferida de Luz Díaz" })).toHaveValue("");
    await user.selectOptions(preferred, "GK");
    await user.selectOptions(secondary, "FWD");
    expect(screen.getByText("1 jugador con cambios sin guardar.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Marcar lesionado a Ana Pérez" }));
    expect(mocks.injury).not.toHaveBeenCalled();
    const details = screen.getByText("Foto y acciones de Ana Pérez").closest("details")!;
    fireEvent.submit(details.querySelector("form")!);
    expect(mocks.upload).not.toHaveBeenCalled();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await user.click(screen.getByRole("link", { name: "Alta de jugador" }));
    expect(confirm).toHaveBeenCalledOnce();
    view.unmount();
    render(await AdminPlayersPage({ searchParams: Promise.resolve({ view: "edit" }) }));
    expect(screen.getByRole("combobox", { name: "Posición preferida de Ana Pérez" })).toHaveValue("GK");
    expect(screen.getByRole("combobox", { name: "Posición secundaria de Ana Pérez" })).toHaveValue("FWD");
    await user.click(screen.getByRole("button", { name: "Descartar cambios" }));
    expect(screen.getByRole("combobox", { name: "Posición preferida de Ana Pérez" })).toHaveValue("DEF");
    expect(screen.getByRole("combobox", { name: "Posición secundaria de Ana Pérez" })).toHaveValue("MID");
    expect(window.sessionStorage.getItem("fdf:players-draft:v1:org-1")).toBeNull();
  });

  it("no restaura un borrador de posiciones encima de preferencias nuevas del servidor", async () => {
    window.sessionStorage.setItem("fdf:players-draft:v1:org-1", JSON.stringify({ "player-1": {
      name: "Ana nueva", level: "6", preferredPosition: "GK", secondaryPosition: "FWD",
      originalName: "Ana Pérez", originalLevel: "3", originalPreferredPosition: "MID", originalSecondaryPosition: "DEF"
    } }));
    render(await AdminPlayersPage({ searchParams: Promise.resolve({ view: "edit" }) }));
    expect(screen.getByRole("textbox", { name: "Nombre de Ana Pérez" })).toHaveValue("Ana Pérez");
    expect(screen.getByRole("combobox", { name: "Posición preferida de Ana Pérez" })).toHaveValue("DEF");
    expect(screen.getByRole("combobox", { name: "Posición secundaria de Ana Pérez" })).toHaveValue("MID");
    expect(screen.getByText("La planilla está guardada.")).toBeVisible();
  });
});
