import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TeamOptionCard } from "@/components/matches/team-option-card";

function buildGuests(team: string) {
  return Array.from({ length: 5 }, (_, index) => ({
    id: `${team}-${index + 1}`,
    full_name: `${team} ${index + 1}`,
    current_rating: 1000,
    is_guest: true
  }));
}

describe("TeamOptionCard", () => {
  it("muestra el balance de equipos con texto humano en lugar de totales internos", () => {
    render(
      <TeamOptionCard
        isConfirmed={false}
        optionId="option-1"
        optionNumber={1}
        ratingDiff={100}
        ratingSumA={1000}
        ratingSumB={1100}
        teamA={buildGuests("Negro")}
        teamALabel="Negro"
        teamB={buildGuests("Blanco")}
        teamBLabel="Blanco"
      />
    );

    expect(screen.getByText("Muy parejo")).toBeInTheDocument();
    expect(screen.getByText("Apenas inclina para Blanco")).toBeInTheDocument();
    expect(screen.queryByText(/Balance Negro/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Balance Blanco/i)).not.toBeInTheDocument();
    expect(screen.queryByText("1000")).not.toBeInTheDocument();
    expect(screen.queryByText("1100")).not.toBeInTheDocument();
  });

  it("marca una opcion sin ventaja cuando ambos equipos quedan iguales", () => {
    render(
      <TeamOptionCard
        isConfirmed
        optionId="option-2"
        optionNumber={2}
        ratingDiff={0}
        ratingSumA={1000}
        ratingSumB={1000}
        teamA={buildGuests("Negro")}
        teamALabel="Negro"
        teamB={buildGuests("Blanco")}
        teamBLabel="Blanco"
      />
    );

    expect(screen.getByText("Parejo perfecto")).toBeInTheDocument();
    expect(screen.getByText("Sin ventaja clara")).toBeInTheDocument();
  });

  it("ordena cada equipo por nivel y muestra la tendencia sin puntajes internos", () => {
    render(
      <TeamOptionCard
        isConfirmed={false}
        optionId="option-3"
        optionNumber={3}
        ratingDiff={20}
        ratingSumA={3000}
        ratingSumB={3020}
        teamA={[
          {
            id: "player-mid",
            full_name: "Medio",
            current_rating: 1000,
            skill_level: 4
          },
          {
            id: "player-best",
            full_name: "Mejor",
            current_rating: 1050,
            skill_level: 2
          },
          {
            id: "player-low",
            full_name: "Bajo",
            current_rating: 950,
            skill_level: 7
          }
        ]}
        teamALabel="Negro"
        teamB={buildGuests("Blanco")}
        teamBLabel="Blanco"
      />
    );

    const teamAItems = screen.getAllByRole("listitem").slice(0, 3);
    expect(teamAItems[0]).toHaveTextContent("Mejor");
    expect(teamAItems[1]).toHaveTextContent("Medio");
    expect(teamAItems[2]).toHaveTextContent("Bajo");
    expect(screen.getByText("Nivel 2 - Figura")).toBeInTheDocument();
    expect(screen.getByText("+ Viene bien")).toBeInTheDocument();
    expect(screen.getByText("- Viene mal")).toBeInTheDocument();
    expect(screen.queryByText("1050")).not.toBeInTheDocument();
    expect(screen.queryByText("1000")).not.toBeInTheDocument();
    expect(screen.queryByText("950")).not.toBeInTheDocument();
  });
});
