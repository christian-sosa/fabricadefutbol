import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RankingTableQuery } from "@/components/ranking/ranking-table-query";
import type { PlayerComputedStats } from "@/types/domain";

vi.mock("@/lib/query/hooks", () => ({
  useOrganizationStandingsQuery: vi.fn(({ initialData }) => ({
    data: initialData,
    isFetching: false
  }))
}));

const players: PlayerComputedStats[] = [
  {
    playerId: "player-lucas",
    playerName: "LucasDias",
    currentRating: 1030,
    initialRank: 2,
    currentRank: 1,
    matchesPlayed: 6,
    wins: 4,
    draws: 0,
    losses: 2,
    winRate: 66.67,
    streak: "W1",
    goals: 0,
    assists: 0
  },
  {
    playerId: "player-gonza",
    playerName: "GonzaMastro",
    currentRating: 1030,
    initialRank: 1,
    currentRank: 2,
    matchesPlayed: 4,
    wins: 3,
    draws: 1,
    losses: 0,
    winRate: 90,
    streak: "W1",
    goals: 0,
    assists: 0
  },
  {
    playerId: "player-gabi",
    playerName: "Gabi Lamine",
    currentRating: 1020,
    initialRank: 3,
    currentRank: 3,
    matchesPlayed: 7,
    wins: 6,
    draws: 0,
    losses: 1,
    winRate: 85.71,
    streak: "W3",
    goals: 0,
    assists: 0
  }
];

function getBodyRows() {
  const table = screen.getByRole("table");
  return within(table).getAllByRole("row").slice(1);
}

describe("RankingTableQuery", () => {
  it("permite ordenar por estadisticas sin perder el ranking actual", async () => {
    const user = userEvent.setup();
    render(<RankingTableQuery initialPlayers={players} organizationId="org-1" />);

    expect(getBodyRows()[0]).toHaveTextContent("#1");
    expect(getBodyRows()[0]).toHaveTextContent("LucasDias");

    await user.click(within(screen.getByRole("table")).getByRole("button", { name: /PG/ }));

    expect(getBodyRows()[0]).toHaveTextContent("#3");
    expect(getBodyRows()[0]).toHaveTextContent("Gabi Lamine");

    await user.click(within(screen.getByRole("table")).getByRole("button", { name: /Efectividad/ }));

    expect(getBodyRows()[0]).toHaveTextContent("#2");
    expect(getBodyRows()[0]).toHaveTextContent("GonzaMastro");
  });
});
