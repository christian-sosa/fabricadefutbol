import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TeamOptionsList } from "@/components/matches/team-options-list";

function buildOption(optionNumber: number) {
  return {
    optionId: `option-${optionNumber}`,
    optionNumber,
    isConfirmed: false,
    ratingDiff: 0,
    ratingSumA: 2000,
    ratingSumB: 2000,
    teamA: [
      { id: "z", full_name: "Zeta", skill_level: 1, current_rating: 1050 },
      { id: "a", full_name: "Alberto", skill_level: 7, current_rating: 950 }
    ],
    teamB: [
      { id: "m", full_name: "María", skill_level: 2, current_rating: 1000 },
      { id: "b", full_name: "Bruno", skill_level: 5, current_rating: 1000 }
    ]
  };
}

describe("TeamOptionsList", () => {
  it("alterna todas las opciones y restaura el orden deportivo al mostrar los niveles", async () => {
    const user = userEvent.setup();
    render(<TeamOptionsList options={[buildOption(1), buildOption(2)]} />);

    expect(screen.getAllByText("Nivel 1 - Estrella")).toHaveLength(2);
    const toggle = screen.getByRole("button", { name: "Ocultar niveles" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    await user.click(toggle);

    expect(screen.getByRole("button", { name: "Mostrar niveles" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Niveles ocultos");
    expect(screen.queryByText(/Nivel \d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Viene bien|Viene mal/)).not.toBeInTheDocument();
    expect(screen.queryByText("Parejo perfecto")).not.toBeInTheDocument();
    expect(screen.queryByText("Sin ventaja clara")).not.toBeInTheDocument();
    for (const [index, list] of screen.getAllByRole("list").entries()) {
      expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent(index % 2 === 0 ? "Alberto" : "Bruno");
    }

    await user.click(screen.getByRole("button", { name: "Mostrar niveles" }));

    expect(screen.getAllByText("Nivel 1 - Estrella")).toHaveLength(2);
    expect(screen.getAllByText("+ Viene bien")).toHaveLength(2);
    expect(screen.getAllByText("Parejo perfecto")).toHaveLength(2);
    for (const [index, list] of screen.getAllByRole("list").entries()) {
      expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent(index % 2 === 0 ? "Zeta" : "María");
    }
  });

  it("conserva los nombres escritos y confirma la misma opción después de ocultar los niveles", async () => {
    const user = userEvent.setup();
    const confirmAction = vi.fn();
    render(<TeamOptionsList confirmAction={confirmAction} options={[buildOption(1), buildOption(2)]} />);
    const firstTeamName = screen.getAllByLabelText("Nombre del primer equipo")[1];
    const secondTeamName = screen.getAllByLabelText("Nombre del segundo equipo")[1];
    await user.type(firstTeamName, "Los del barrio");
    await user.type(secondTeamName, "Los del club de amigos");

    await user.click(screen.getByRole("button", { name: "Ocultar niveles" }));

    expect(confirmAction).not.toHaveBeenCalled();
    expect(firstTeamName).toHaveValue("Los del barrio");
    expect(secondTeamName).toHaveValue("Los del club de amigos");
    await user.click(screen.getAllByRole("button", { name: "Confirmar esta opcion" })[1]);

    await waitFor(() => expect(confirmAction).toHaveBeenCalledOnce());
    const submittedData = confirmAction.mock.calls[0][0] as FormData;
    expect(submittedData.get("optionId")).toBe("option-2");
    expect(submittedData.get("teamALabel")).toBe("Los del barrio");
    expect(submittedData.get("teamBLabel")).toBe("Los del club de amigos");
    expect([...submittedData.keys()].sort()).toEqual(["optionId", "teamALabel", "teamBLabel"]);
  });

  it("mantiene la opción confirmada visible sin volver a ofrecer confirmación", async () => {
    const user = userEvent.setup();
    render(<TeamOptionsList confirmAction={vi.fn()} options={[{ ...buildOption(1), isConfirmed: true }]} />);
    await user.click(screen.getByRole("button", { name: "Ocultar niveles" }));

    expect(screen.getByText("Confirmada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar esta opcion" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("muestra el estado vacío sin un control que no tenga opciones para ocultar", () => {
    render(<TeamOptionsList options={[]} />);

    expect(screen.getByText("No hay opciones generadas para este partido.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
