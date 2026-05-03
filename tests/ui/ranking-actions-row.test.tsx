import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RankingActionsRow } from "@/components/ranking/ranking-actions-row";

vi.mock("@vercel/analytics", () => ({
  track: vi.fn()
}));

describe("RankingActionsRow", () => {
  it("mantiene compartir ranking en la misma fila de acciones que los filtros", () => {
    render(
      <RankingActionsRow
        currentSeason="current"
        groupName="La cantera de LQ"
        organizationSlug="la-cantera-de-lq"
        rankingShareUrl="https://fabricadefutbol.com.ar/ranking?org=la-cantera-de-lq"
        seasons={[
          {
            id: "season-2026",
            label: "Temporada 2026",
            durationMonths: 12,
            startsAt: "2026-01-01",
            endsAt: "2026-12-31",
            status: "active"
          }
        ]}
      />
    );

    const filters = screen.getByRole("navigation", { name: "Filtrar temporada" });
    const shareButton = screen.getByRole("button", { name: "Compartir ranking" });

    expect(filters.parentElement).toContainElement(shareButton);
  });
});
