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
});
