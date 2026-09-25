import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), history: vi.fn(), redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }) }));
vi.mock("@/lib/auth/admin", () => ({ requireAdminOrganization: mocks.authorize }));
vi.mock("@/lib/queries/admin-match-extras", () => ({ getAdminScorerHistory: mocks.history }));
vi.mock("@/components/admin/admin-current-group-card", () => ({ AdminCurrentGroupCard: () => null }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import AdminScorersPage from "@/app/admin/(panel)/scorers/page";

describe("historial privado de goleadores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue({ admin: {}, selectedOrganization: { id: "group-a", slug: "la-banda", name: "La Banda" } });
    mocks.history.mockResolvedValue({ page: 1, pageCount: 1, matches: [] });
  });

  it("muestra autores por equipo y conserva el grupo al abrir el acta o cambiar de página", async () => {
    mocks.history.mockResolvedValue({ page: 2, pageCount: 3, matches: [{
      id: "match-1", scheduled_at: "2026-09-25T19:00:00Z", modality: "11v11", team_a_label: "Rojos", team_b_label: "Azules",
      scorers: [
        { participant_id: "player:p1", display_name: "Ana", team: "A", goals: 1 },
        { participant_id: "guest:g1", display_name: "Marcos", team: "A", goals: 3 },
        { participant_id: "player:p2", display_name: "Pablo", team: "B", goals: 2 }
      ]
    }] });
    render(await AdminScorersPage({ searchParams: Promise.resolve({ org: "la-banda", page: "2" }) }));
    expect(mocks.authorize).toHaveBeenCalledWith("la-banda");
    expect(mocks.history).toHaveBeenCalledWith("group-a", 2);
    expect(screen.getByText(/Sólo los administradores del grupo pueden verlos/)).toBeInTheDocument();
    const reds = screen.getByRole("heading", { name: "Rojos" }).closest("section")!;
    expect(within(reds).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Marcos3 goles", "Ana1 gol"]);
    expect(within(reds).queryByText("Pablo")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver acta" })).toHaveAttribute("href", "/admin/matches/match-1/result?org=la-banda");
    expect(screen.getByRole("link", { name: "Anterior" })).toHaveAttribute("href", "/admin/scorers?page=1&org=la-banda");
    expect(screen.getByRole("link", { name: "Siguiente" })).toHaveAttribute("href", "/admin/scorers?page=3&org=la-banda");
  });

  it("redirige una página fuera de rango a la última disponible con el contexto correcto", async () => {
    mocks.history.mockResolvedValue({ page: 2, pageCount: 2, matches: [] });
    await expect(AdminScorersPage({ searchParams: Promise.resolve({ org: "la-banda", page: "999999" }) })).rejects.toThrow("REDIRECT:/admin/scorers?page=2&org=la-banda");
  });

  it("normaliza una página inválida y ofrece volver a partidos cuando todavía no hay historial", async () => {
    render(await AdminScorersPage({ searchParams: Promise.resolve({ org: "la-banda", page: "-2" }) }));
    expect(mocks.history).toHaveBeenCalledWith("group-a", 1);
    expect(screen.getByRole("link", { name: "Ir a partidos" })).toHaveAttribute("href", "/admin/matches?org=la-banda");
    expect(screen.queryByRole("link", { name: "Anterior" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Siguiente" })).not.toBeInTheDocument();
  });

  it("no consulta el historial si falla la autorización del grupo", async () => {
    mocks.authorize.mockRejectedValueOnce(new Error("No autorizado"));
    await expect(AdminScorersPage({ searchParams: Promise.resolve({ org: "ajeno" }) })).rejects.toThrow("No autorizado");
    expect(mocks.history).not.toHaveBeenCalled();
  });
});
