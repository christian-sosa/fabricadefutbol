import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RankingTableQuery } from "@/components/ranking/ranking-table-query";
import type { PlayerComputedStats } from "@/types/domain";
import { useOrganizationStandingsQuery } from "@/lib/query/hooks";

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
    expect(getBodyRows()[0]).toHaveTextContent("GonzaMastro");
    const mobileLeader = screen.getAllByText("GonzaMastro")[0].closest("article");
    expect(mobileLeader).toHaveTextContent("1");

    await user.click(within(screen.getByRole("table")).getByRole("button", { name: /PG/ }));

    expect(getBodyRows()[0]).toHaveTextContent("#3");
    expect(getBodyRows()[0]).toHaveTextContent("Gabi Lamine");

    await user.click(within(screen.getByRole("table")).getByRole("button", { name: /Figuras/ }));

    expect(getBodyRows()[0]).toHaveTextContent("#1");
    expect(getBodyRows()[0]).toHaveTextContent("GonzaMastro");
    const firstRowCells = within(getBodyRows()[0]).getAllByRole("cell");
    expect(firstRowCells).toHaveLength(9);
    expect(firstRowCells.at(-2)).toHaveTextContent("4");
    expect(within(firstRowCells.at(-1) as HTMLElement).getByRole("img")).toHaveAccessibleName(
      "Últimos 5 partidos: victoria, victoria, empate, victoria. El más reciente está a la derecha."
    );
  });

  it("muestra la forma reciente con letras y colores sin depender de Efectividad", async () => {
    const user = userEvent.setup();
    render(<RankingTableQuery initialPlayers={players} organizationId="org-1" />);

    const lucasRow = getBodyRows().find((row) => row.textContent?.includes("LucasDias")) as HTMLElement;
    const formCell = within(lucasRow).getAllByRole("cell").at(-1) as HTMLElement;
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
    await user.click(within(mobileCard as HTMLElement).getByLabelText(/^Estadísticas de Gabi Lamine:/));
    expect(within(mobileCard as HTMLElement).getByRole("img", { name: /sin partidos jugados/ })).toBeInTheDocument();
  });
  it("conserva el ranking disponible y permite reintentar un error de actualización", async () => {
    const refetch = vi.fn();
    vi.mocked(useOrganizationStandingsQuery).mockReturnValueOnce({ data: players, isFetching: false, isError: true, refetch } as unknown as ReturnType<typeof useOrganizationStandingsQuery>);
    render(<RankingTableQuery initialPlayers={players} organizationId="org-1" />);
    expect(screen.getByRole("alert")).toHaveTextContent("últimos datos disponibles");
    expect(getBodyRows()[0]).toHaveTextContent("GonzaMastro");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("excluye ausentes sin cambiar los puestos y mantiene lesionados en ambas vistas", async () => {
    const user = userEvent.setup();
    const activityPlayers: PlayerComputedStats[] = players.map((player) => ({
      ...player,
      isAbsent: player.playerId !== "player-lucas",
      isInjured: player.playerId === "player-gabi",
      matchesSinceLastPlayed: player.playerId === "player-lucas" ? 1 : 8,
      lastPlayedAt: "2026-09-18T01:00:00.000Z"
    }));
    render(<RankingTableQuery initialPlayers={activityPlayers} organizationId="org-1" />);

    const checkbox = screen.getByRole("checkbox", { name: "Excluir ausentes" });
    expect(checkbox).not.toBeChecked();
    expect(getBodyRows()).toHaveLength(3);
    expect(screen.getAllByText("Ausente")).toHaveLength(2);
    expect(screen.getAllByText("Lesionado")).toHaveLength(2);

    await user.click(checkbox);

    expect(getBodyRows()).toHaveLength(2);
    expect(screen.queryByText("GonzaMastro")).not.toBeInTheDocument();
    expect(getBodyRows()[0]).toHaveTextContent("#2");
    expect(getBodyRows()[0]).toHaveTextContent("LucasDias");
    expect(getBodyRows()[1]).toHaveTextContent("#3");
    expect(getBodyRows()[1]).toHaveTextContent("Gabi Lamine");
    expect(getBodyRows()[1]).toHaveTextContent("Lesionado");
    expect(getBodyRows()[1]).not.toHaveTextContent("Ausente");
    expect(screen.getByLabelText(/^Estadísticas de Gabi Lamine: puesto 3,.*lesionado$/)).toBeInTheDocument();
    expect(screen.getByText("Mostrando 2 de 3 jugadores · Se conservan los puestos")).toBeInTheDocument();

    await user.click(within(screen.getByRole("table")).getByRole("button", { name: "PG" }));
    expect(getBodyRows()[0]).toHaveTextContent("Gabi Lamine");
    expect(getBodyRows()[0]).toHaveTextContent("#3");

    await user.click(checkbox);
    expect(getBodyRows()).toHaveLength(3);
    expect(within(screen.getByRole("table")).getByText("GonzaMastro")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Estadísticas de GonzaMastro: puesto 1,/)).toBeInTheDocument();
  });

  it("muestra la fecha de cancha sin correr el día al consultar otra temporada y distingue sin debut", () => {
    const activityPlayers: PlayerComputedStats[] = [
      { ...players[0], lastPlayedAt: "2026-09-18T01:00:00.000Z", matchesSinceLastPlayed: 5, isAbsent: true },
      { ...players[1], lastPlayedAt: null, matchesSinceLastPlayed: 1, isAbsent: false }
    ];
    render(<RankingTableQuery initialPlayers={activityPlayers} organizationId="org-1" season="2024" />);

    expect(screen.getAllByText("5 partidos sin jugar")).toHaveLength(2);
    expect(screen.getAllByText("18/09/2026")).toHaveLength(2);
    expect(screen.getAllByText("1 partido sin jugar")).toHaveLength(2);
    expect(screen.getAllByText("Sin debut")).toHaveLength(2);
    expect(screen.getByRole("checkbox", { name: "Excluir ausentes" })).toHaveAccessibleDescription(
      "Ausente: 5 partidos finalizados seguidos sin jugar. Los lesionados siguen visibles. La actividad es actual, independientemente de la temporada elegida."
    );
  });

  it("no inventa datos de actividad cuando un ranking anterior no los incluye", () => {
    render(<RankingTableQuery initialPlayers={players} organizationId="org-1" />);

    expect(screen.queryByText("Sin debut")).not.toBeInTheDocument();
    expect(screen.queryByText(/^Último:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^\d+ partidos? sin jugar$/)).not.toBeInTheDocument();
    expect(screen.queryByText("Ausente")).not.toBeInTheDocument();
    expect(screen.queryByText("Lesionado")).not.toBeInTheDocument();
  });

  it("explica cómo recuperar las filas cuando el filtro oculta a todos", async () => {
    const user = userEvent.setup();
    render(<RankingTableQuery initialPlayers={players.map((player) => ({ ...player, isAbsent: true }))} organizationId="org-1" />);

    await user.click(screen.getByRole("checkbox", { name: "Excluir ausentes" }));

    expect(screen.getAllByText("No hay jugadores visibles. Desactivá «Excluir ausentes» para ver a todos.")).toHaveLength(2);
    expect(screen.queryByText("No hay jugadores para este grupo.")).not.toBeInTheDocument();
    expect(screen.getByText("Mostrando 0 de 3 jugadores · Se conservan los puestos")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Excluir ausentes" }));
    expect(getBodyRows()).toHaveLength(3);
  });

  it("mantiene el estado vacío del grupo al activar el filtro sin jugadores", async () => {
    render(<RankingTableQuery initialPlayers={[]} organizationId="org-1" />);

    await userEvent.click(screen.getByRole("checkbox", { name: "Excluir ausentes" }));

    expect(screen.getAllByText("No hay jugadores para este grupo.")).toHaveLength(2);
    expect(screen.queryByText(/No hay jugadores visibles/)).not.toBeInTheDocument();
  });
});
