import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { getMatchDetailsMock, notFoundMock } = vi.hoisted(() => ({
  getMatchDetailsMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  })
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock
}));

vi.mock("@/components/groups/public-group-growth-cta", () => ({
  PublicGroupGrowthCta: () => <div data-testid="growth-cta" />
}));

vi.mock("@/components/matches/whatsapp-share-button", () => ({
  WhatsAppShareButton: () => <button type="button">Compartir</button>
}));

vi.mock("@/lib/queries/public", () => ({
  getMatchDetails: getMatchDetailsMock
}));

import MatchDetailPage from "@/app/matches/[id]/page";
import { FORMATION_PRESETS, getFormationPositions } from "@/lib/domain/match-formation";
import { MATCH_MODALITIES, TEAM_SIZE_BY_MODALITY } from "@/lib/constants";

describe("MatchDetailPage", () => {
  it("muestra suplentes convocados en una sección separada con su equipo opcional", async () => {
    getMatchDetailsMock.mockResolvedValueOnce({
      match: { id: "match-bench", modality: "9v9", scheduled_at: "2026-09-25T20:00:00Z", status: "confirmed", team_a_label: "Rojo", team_b_label: "Azul" },
      result: null, teamAPlayers: [], teamBPlayers: [],
      substitutes: [
        { id: "player-bench", full_name: "Leo suplente", current_rating: 1000, is_guest: false, team: "A" },
        { id: "guest-bench", full_name: "Nico invitado", current_rating: 1000, is_guest: true, team: null }
      ]
    });
    render(await MatchDetailPage({ params: Promise.resolve({ id: "match-bench" }), searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("region", { name: "Suplentes convocados" })).toHaveTextContent("Leo suplente");
    expect(screen.getByRole("region", { name: "Suplentes convocados" })).toHaveTextContent("Rojo");
    expect(screen.getByRole("region", { name: "Suplentes convocados" })).toHaveTextContent("Equipo por definir");
  });

  it("conserva visibles los jugadores extra del acta final cuando hay formación guardada", async () => {
    const modality = "9v9";
    const preset = FORMATION_PRESETS[modality][0];
    const players = (side: string) => Array.from({ length: 9 }, (_, i) => ({ id: `${side}-${i}`, full_name: `${side} ${i}`, current_rating: 1000, is_guest: false }));
    const teamAPlayers = players("Rojo"), teamBPlayers = players("Azul");
    const formation = (pool: typeof teamAPlayers) => ({ formationId: preset, slots: getFormationPositions(preset).map((position, i) => ({ slotId: position.slotId, participantId: `player:${pool[i].id}` })) });
    const formationData = { teamA: formation(teamAPlayers), teamB: formation(teamBPlayers) };
    teamAPlayers.push({ id: "extra", full_name: "También participó", current_rating: 1000, is_guest: false });
    getMatchDetailsMock.mockResolvedValueOnce({
      match: { id: "match-final", modality, scheduled_at: "2026-09-25T20:00:00Z", status: "finished", formation_data: formationData, goalkeeper_player_ids: [] },
      result: { score_a: 1, score_b: 0, winner_team: "A" }, teamAPlayers, teamBPlayers, substitutes: []
    });
    render(await MatchDetailPage({ params: Promise.resolve({ id: "match-final" }), searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("region", { name: "También jugaron" })).toHaveTextContent("También participó");
    expect(screen.getAllByRole("img")).toHaveLength(19);
  });

  it("vuelve al calendario conservando grupo, temporada y página del historial", async () => {
    const season = "00000000-0000-4000-8000-000000000001";
    getMatchDetailsMock.mockResolvedValueOnce({
      match: { id: "match-calendar", modality: "5v5", scheduled_at: "2025-12-31T00:30:00.000Z", status: "finished" },
      result: null,
      teamAPlayers: [],
      teamBPlayers: []
    });
    render(await MatchDetailPage({
      params: Promise.resolve({ id: "match-calendar" }),
      searchParams: Promise.resolve({ org: "grupo-a", season, page: "3", view: "calendar" })
    }));

    expect(screen.getByRole("link", { name: "Volver al calendario" })).toHaveAttribute("href", `/matches?org=grupo-a&season=${season}&page=3&view=calendar`);
    expect(getMatchDetailsMock).toHaveBeenLastCalledWith("match-calendar", "grupo-a");
  });

  it.each(MATCH_MODALITIES)("shows saved %s pitches with names and no rating list", async (modality) => {
    const size = TEAM_SIZE_BY_MODALITY[modality];
    const preset = FORMATION_PRESETS[modality][0];
    const players = (side: string) => Array.from({ length: size }, (_, i) => ({ id: `${side}-${i}`, full_name: `${side} Jugador ${i}`, current_rating: 1234, is_guest: i === size - 1 }));
    const teamAPlayers = players("Azul"), teamBPlayers = players("Rojo");
    const formation = (pool: typeof teamAPlayers) => ({ formationId: preset, slots: getFormationPositions(preset).map((position, i) => ({ slotId: position.slotId, participantId: `${pool[i].is_guest ? "guest" : "player"}:${pool[i].id}` })) });
    getMatchDetailsMock.mockResolvedValueOnce({
      match: { id: "match-1", modality, scheduled_at: "2026-09-14T20:00:00Z", status: "confirmed", team_a_label: "Azul", team_b_label: "Rojo", goalkeeper_player_ids: [], formation_data: { teamA: formation(teamAPlayers), teamB: formation(teamBPlayers) } },
      result: null, teamAPlayers, teamBPlayers
    });
    render(await MatchDetailPage({ params: Promise.resolve({ id: "match-1" }), searchParams: Promise.resolve({ org: "grupo-a" }) }));
    expect(screen.getByRole("group", { name: "Cancha de Azul" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Cancha de Rojo" })).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(size * 2);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByText("1234")).not.toBeInTheDocument();
    expect(screen.getByText(`Azul Jugador ${size - 1}`)).toBeInTheDocument();
  });
  it("oculta el rendimiento actual en partidos del historial", async () => {
    getMatchDetailsMock.mockResolvedValueOnce({
      match: {
        id: "match-1",
        modality: "5v5",
        scheduled_at: "2026-01-10T20:00:00.000Z",
        status: "finished",
        team_a_label: "Negro",
        team_b_label: "Blanco"
      },
      result: {
        score_a: 4,
        score_b: 2,
        winner_team: "A",
        mvp_display_name: "Ariel",
        notes: null
      },
      teamAPlayers: [
        {
          id: "player-1",
          full_name: "Ariel",
          current_rating: 1234,
          is_guest: false
        }
      ],
      teamBPlayers: [
        {
          id: "player-2",
          full_name: "Beto",
          current_rating: 987,
          is_guest: false
        }
      ]
    });

    const page = await MatchDetailPage({
      params: Promise.resolve({ id: "match-1" }),
      searchParams: Promise.resolve({ org: "grupo-a", season: "all", page: "2" })
    });

    render(page);

    expect(screen.getByText("Ariel")).toBeInTheDocument();
    expect(screen.getByText("Beto")).toBeInTheDocument();
    expect(screen.queryByText("1234")).not.toBeInTheDocument();
    expect(screen.queryByText("987")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver al historial" })).toHaveAttribute("href", "/matches?org=grupo-a&season=all&page=2");
    expect(screen.getByRole("heading", { level: 1, name: "Resultado del partido" })).toBeInTheDocument();
    const scoreboard = screen.getByRole("group", { name: "Negro 4, Blanco 2" });
    const teams = screen.getByRole("heading", { name: "Equipos confirmados" });
    expect(scoreboard.compareDocumentPosition(teams) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("Figura del partido: Ariel")).toBeInTheDocument();
    expect(screen.getByText("Distinción opcional. No suma puntos.")).toBeInTheDocument();
  });
});
