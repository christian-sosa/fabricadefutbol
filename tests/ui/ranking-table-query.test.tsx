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
    recentResults: ["V", "D", "V", "E", "V"],
    goals: 0,
    assists: 0,
    mvpCount: 1
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
    recentResults: ["V", "V", "E", "V"],
    goals: 0,
    assists: 0,
    mvpCount: 4
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
    recentResults: [],
    goals: 0,
    assists: 0,
    mvpCount: 2
  }
];

function getBodyRows() {
  const table = screen.getByRole("table");
  return within(table).getAllByRole("row").slice(1);
}

describe("RankingTableQuery", () => {
  it("no muestra una barra de estado arriba del encabezado cuando la tabla esta al dia", () => {
    render(<RankingTableQuery initialPlayers={players} organizationId="org-1" />);

    expect(screen.queryByText("Tabla al dia")).not.toBeInTheDocument();
  });

  it("permite ordenar por estadisticas sin perder el ranking actual", async () => {
    const user = userEvent.setup();
    render(<RankingTableQuery initialPlayers={players} organizationId="org-1" />);

    expect(getBodyRows()[0]).toHaveTextContent("#1");
    expect(getBodyRows()[0]).toHaveTextContent("LucasDias");

    await user.click(within(screen.getByRole("table")).getByRole("button", { name: /PG/ }));

    expect(getBodyRows()[0]).toHaveTextContent("#3");
    expect(getBodyRows()[0]).toHaveTextContent("Gabi Lamine");

    await user.click(within(screen.getByRole("table")).getByRole("button", { name: /MVP/ }));

    expect(getBodyRows()[0]).toHaveTextContent("#2");
    expect(getBodyRows()[0]).toHaveTextContent("GonzaMastro");
    const firstRowCells = within(getBodyRows()[0]).getAllByRole("cell");
    expect(firstRowCells).toHaveLength(9);
    expect(firstRowCells.at(-2)).toHaveTextContent("4");
    expect(within(firstRowCells.at(-1) as HTMLElement).getByRole("img")).toHaveAccessibleName(
      "Últimos 5 partidos: victoria, victoria, empate, victoria. El más reciente está a la derecha."
    );
  });

  it("muestra la forma reciente con letras y colores sin depender de Efectividad", () => {
    render(<RankingTableQuery initialPlayers={players} organizationId="org-1" />);

    const firstRowCells = within(getBodyRows()[0]).getAllByRole("cell");
    const formCell = firstRowCells.at(-1) as HTMLElement;
    const resultBadges = within(formCell).getAllByTitle(/Victoria|Empate|Derrota/);

    expect(resultBadges.map((badge) => badge.textContent)).toEqual(["V", "D", "V", "E", "V"]);
    expect(within(formCell).getAllByTitle("Victoria")[0]).toHaveClass("bg-emerald-400");
    expect(within(formCell).getByTitle("Empate")).toHaveClass("bg-amber-300");
    expect(within(formCell).getByTitle("Derrota")).toHaveClass("bg-rose-500");
    expect(screen.queryByRole("button", { name: /Efectividad/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Efectividad")).not.toBeInTheDocument();

    const mobilePlayerName = screen.getAllByText("Gabi Lamine")[0];
    const mobileCard = mobilePlayerName.closest("article");
    expect(mobileCard).not.toBeNull();
    expect(within(mobileCard as HTMLElement).getByRole("img", { name: /sin partidos jugados/ })).toBeInTheDocument();
  });
});
