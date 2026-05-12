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

describe("MatchDetailPage", () => {
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
      searchParams: Promise.resolve({ org: "grupo-a" })
    });

    render(page);

    expect(screen.getByText("Ariel")).toBeInTheDocument();
    expect(screen.getByText("Beto")).toBeInTheDocument();
    expect(screen.queryByText("1234")).not.toBeInTheDocument();
    expect(screen.queryByText("987")).not.toBeInTheDocument();
  });
});
