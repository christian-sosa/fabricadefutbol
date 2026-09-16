import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminPlayersPage from "@/app/admin/(panel)/players/page";

const mocks = vi.hoisted(() => ({ update: vi.fn(), upload: vi.fn() }));
vi.mock("@/app/admin/(panel)/players/actions", () => ({ deletePlayerAction: vi.fn(), bulkCreatePlayersAction: vi.fn() }));
vi.mock("@/app/admin/(panel)/form-actions", () => ({ createPlayerFormAction: vi.fn(), updatePlayersFormAction: mocks.update, uploadPlayerPhotoFormAction: mocks.upload }));
vi.mock("@/components/admin/admin-current-group-card", () => ({ AdminCurrentGroupCard: () => <p>Grupo actual: Los viernes</p> }));
vi.mock("@/lib/auth/admin", () => ({ requireAdminOrganization: async () => ({ admin: {}, selectedOrganization: { id: "org-1", slug: "viernes", name: "Los viernes" } }), getOrganizationWriteAccess: async () => ({ canWrite: true }) }));
vi.mock("@/lib/queries/admin", () => ({ getAdminPlayers: async () => [
  { id: "player-1", full_name: "Ana Pérez", skill_level: 3, photo_path: null },
  { id: "player-2", full_name: "Luz Díaz", skill_level: 4, photo_path: null }
] }));
beforeEach(() => { window.sessionStorage.clear(); mocks.update.mockReset().mockResolvedValue({ error: null }); mocks.upload.mockReset(); });

describe("planilla de jugadores", () => {
  it("bloquea edición, descarte y fotos durante el guardado sin quitar datos del envío", async () => {
    const user = userEvent.setup();
    let finishSave!: (result: { error: string | null }) => void;
    mocks.update.mockImplementationOnce(() => new Promise((resolve) => { finishSave = resolve; }));
    render(await AdminPlayersPage({ searchParams: Promise.resolve({ view: "edit" }) }));
    const name = screen.getByRole("textbox", { name: "Nombre de Ana Pérez" });
    const level = screen.getByRole("combobox", { name: "Nivel de habilidad de Ana Pérez" });
    await user.clear(name);
    await user.type(name, "Ana nueva");
    await user.selectOptions(level, "6");
    await user.click(screen.getByText("Foto y acciones de Ana Pérez"));
    await user.click(screen.getByRole("button", { name: "Guardar toda la planilla" }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    const submitted = mocks.update.mock.calls[0][0] as FormData;
    expect(submitted.getAll("playerId")).toEqual(["player-1", "player-2"]);
    expect(submitted.getAll("fullName")).toEqual(["Ana nueva", "Luz Díaz"]);
    expect(submitted.getAll("skillLevel")).toEqual(["6", "4"]);
    expect(name).toBeDisabled();
    expect(level).toBeDisabled();
    expect(screen.getByRole("button", { name: "Descartar cambios" })).toBeDisabled();
    for (const input of screen.getAllByLabelText("Foto del jugador")) expect(input).toBeDisabled();
    for (const button of screen.getAllByRole("button", { name: "Eliminar" })) expect(button).toBeDisabled();
    await user.type(name, " segunda edición");
    await user.click(screen.getByRole("button", { name: "Descartar cambios" }));
    expect(name).toHaveValue("Ana nueva");
    expect(level).toHaveValue("6");

    await act(async () => { finishSave({ error: "No se pudo guardar la planilla." }); });
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar la planilla.");
    expect(name).toBeEnabled();
    expect(level).toBeEnabled();
    expect(name).toHaveValue("Ana nueva");
    expect(level).toHaveValue("6");
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
});
