import { render, screen, within } from "@testing-library/react";
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
beforeEach(() => { mocks.update.mockReset().mockResolvedValue({ error: null }); });

describe("planilla de jugadores", () => {
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
