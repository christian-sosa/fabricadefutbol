import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), history: vi.fn(), redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }) }));
vi.mock("@/lib/auth/admin", () => ({ requireAdminOrganization: mocks.authorize }));
vi.mock("@/lib/queries/admin-match-extras", () => ({ getAdminHistoricalScorers: mocks.history }));
vi.mock("@/components/admin/admin-current-group-card", () => ({ AdminCurrentGroupCard: () => null }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import AdminScorersPage from "@/app/admin/(panel)/scorers/page";

const emptyHistory = { page: 1, pageCount: 1, scorers: [], totalScorers: 0, totalGoals: 0, guestGoals: 0, matchesRecorded: 0 };

describe("goleadores históricos privados", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue({ admin: {}, selectedOrganization: { id: "group-a", slug: "la-banda", name: "La Banda" } });
    mocks.history.mockResolvedValue(emptyHistory);
  });

  it("muestra totales históricos y un ranking por jugador con paginación del grupo", async () => {
    mocks.history.mockResolvedValue({
      page: 2, pageCount: 3, totalScorers: 45, totalGoals: 305, guestGoals: 5, matchesRecorded: 40,
      scorers: [
        { playerId: "p1", displayName: "Ana", goals: 12, matchesPlayed: 7, rank: 21 },
        { playerId: "p2", displayName: "Pablo", goals: 12, matchesPlayed: 5, rank: 21 }
      ]
    });
    render(await AdminScorersPage({ searchParams: Promise.resolve({ org: "la-banda", page: "2" }) }));
    expect(mocks.authorize).toHaveBeenCalledWith("la-banda");
    expect(mocks.history).toHaveBeenCalledWith("group-a", 2);
    expect(screen.getByRole("heading", { name: "Goleadores históricos" })).toBeInTheDocument();
    expect(screen.getByText("Todas las temporadas")).toBeInTheDocument();
    expect(screen.getByText("Goles registrados").parentElement).toHaveTextContent("305");
    expect(screen.getByText("Goleadores del grupo").parentElement).toHaveTextContent("45");
    expect(screen.getByText("Partidos computados").parentElement).toHaveTextContent("40");
    const table = screen.getByRole("table", { name: "Goleadores históricos del grupo" });
    const ana = within(table).getByRole("rowheader", { name: "Ana 7 partidos computados" }).closest("tr")!;
    expect(within(ana).getByRole("cell", { name: "12 goles" })).toBeInTheDocument();
    expect(within(table).getAllByRole("cell", { name: "21" })).toHaveLength(2);
    expect(screen.queryByRole("link", { name: "Ver acta" })).not.toBeInTheDocument();
    expect(screen.getByText(/El total incluye 5 goles de invitados/)).toBeInTheDocument();
    expect(screen.getByText(/Sólo los administradores del grupo pueden ver/)).toBeInTheDocument();
    expect(screen.getByText(/Los empates 0–0 también cuentan/)).toHaveTextContent("Los demás resultados sin goleadores cargados quedan fuera del conteo.");
    expect(screen.getByRole("link", { name: /Ir a partidos/ })).toHaveAttribute("href", "/admin/matches?org=la-banda");
    expect(screen.getByRole("link", { name: "Anterior" })).toHaveAttribute("href", "/admin/scorers?page=1&org=la-banda");
    expect(screen.getByRole("link", { name: "Siguiente" })).toHaveAttribute("href", "/admin/scorers?page=3&org=la-banda");
  });

  it("redirige una página fuera de rango a la última disponible con el contexto correcto", async () => {
    mocks.history.mockResolvedValue({ ...emptyHistory, page: 2, pageCount: 2 });
    await expect(AdminScorersPage({ searchParams: Promise.resolve({ org: "la-banda", page: "999999" }) })).rejects.toThrow("REDIRECT:/admin/scorers?page=2&org=la-banda");
  });

  it("normaliza una página inválida y explica cómo comenzar sin mostrar una paginación vacía", async () => {
    render(await AdminScorersPage({ searchParams: Promise.resolve({ org: "la-banda", page: "-2" }) }));
    expect(mocks.history).toHaveBeenCalledWith("group-a", 1);
    expect(screen.getByText("Todavía no hay goles registrados")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ir a partidos/ })).toHaveAttribute("href", "/admin/matches?org=la-banda");
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("explica los goles de invitados cuando todavía no hay jugadores registrados en el ranking", async () => {
    mocks.history.mockResolvedValue({ ...emptyHistory, totalGoals: 1, guestGoals: 1, matchesRecorded: 1 });
    render(await AdminScorersPage({ searchParams: Promise.resolve({ org: "la-banda" }) }));
    expect(screen.getByText("Todavía no hay goles registrados de jugadores del grupo")).toBeInTheDocument();
    expect(screen.getByText(/El total incluye 1 gol de invitados/)).toBeInTheDocument();
  });

  it("no consulta el historial si falla la autorización del grupo", async () => {
    mocks.authorize.mockRejectedValueOnce(new Error("No autorizado"));
    await expect(AdminScorersPage({ searchParams: Promise.resolve({ org: "ajeno" }) })).rejects.toThrow("No autorizado");
    expect(mocks.history).not.toHaveBeenCalled();
  });
});
