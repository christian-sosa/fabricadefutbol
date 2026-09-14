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
import { getFormationPositions } from "@/lib/domain/match-formation";

describe("MatchDetailPage", () => {
  it.each(["9v9", "11v11"])("shows saved %s pitches with names and no rating list", async (modality) => {
    const size = modality === "9v9" ? 9 : 11;
    const preset = size === 9 ? "3-3-2" : "4-2-3-1";
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
        mvp_display_name: null,
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
  });
});
