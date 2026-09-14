import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FormationPitch } from "@/components/matches/formation-pitch";
import { getFormationPositions, type FormationPlayer, type TeamFormation } from "@/lib/domain/match-formation";

function buildFormation(formationId: string) {
  const positions = getFormationPositions(formationId);
  const players: FormationPlayer[] = positions.map((position, index) => ({
    participantId: `player:${index}`,
    name: index === 0 ? "Arquero del barrio" : `Jugador ${index}`,
    isGoalkeeper: position.slotId === "gk"
  }));
  const formation: TeamFormation = {
    formationId,
    slots: positions.map((position, index) => ({ slotId: position.slotId, participantId: players[index].participantId }))
  };
  return { players, formation };
}

describe("FormationPitch", () => {
  it.each(["3-3-2", "4-4-2", "3-5-2", "4-2-3-1"])("presenta la cancha %s con una remera y un nombre por posición", (formationId) => {
    const { formation, players } = buildFormation(formationId);
    render(<FormationPitch formation={formation} players={players} side="A" teamLabel="Los azules" />);

    expect(screen.getByRole("group", { name: "Cancha de Los azules" })).toBeInTheDocument();
    expect(screen.getByText(formationId)).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(players.length);
    for (const player of players) expect(screen.getByText(player.name)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/Defensa|Mediocampo|Ataque|Nivel/)).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Arco: Arquero del barrio" }).querySelector("svg")).toHaveClass("text-slate-300");
    expect(screen.getByRole("img", { name: "Defensa 1: Jugador 1" }).querySelector("svg")).toHaveClass("text-blue-600");
  });

  it("permite elegir posiciones con teclado y distingue la seleccionada", async () => {
    const user = userEvent.setup();
    const onSelectSlot = vi.fn();
    const { formation, players } = buildFormation("4-3-3");
    formation.slots[0].participantId = null;
    render(<FormationPitch formation={formation} onSelectSlot={onSelectSlot} players={players} selectedSlotId="line-0-0" side="B" teamLabel="Los rojos" />);

    const emptyGoal = screen.getByRole("button", { name: "Arco: Elegir jugador" });
    expect(emptyGoal).toHaveTextContent("Elegir");
    expect(emptyGoal).toHaveAttribute("type", "button");
    await user.tab();
    expect(emptyGoal).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onSelectSlot).toHaveBeenLastCalledWith("gk");

    const selectedDefender = screen.getByRole("button", { name: "Defensa 1: Jugador 1" });
    expect(selectedDefender).toHaveAttribute("aria-pressed", "true");
    expect(selectedDefender.querySelector("svg")).toHaveClass("text-red-600");
    await user.click(screen.getByRole("button", { name: "Ataque 3: Jugador 10" }));
    expect(onSelectSlot).toHaveBeenLastCalledWith("line-2-2");
  });

  it("conserva accesible el nombre completo cuando es largo y no reemplaza jugadores faltantes por otros", () => {
    const { formation, players } = buildFormation("3-3-2");
    const longName = "Juan Ignacio de los Santos con un nombre muy largo";
    players[1].name = longName;
    formation.slots[2].participantId = "player:outside-team";
    render(<FormationPitch formation={formation} players={players} side="A" teamLabel="Equipo con nombre largo" />);

    expect(screen.getByRole("img", { name: `Defensa 1: ${longName}` })).toBeInTheDocument();
    expect(screen.getByText(longName)).toHaveAttribute("title", longName);
    expect(screen.getByRole("img", { name: "Defensa 2: Elegir jugador" })).toHaveTextContent("Elegir");
    expect(screen.queryByText("Jugador 2")).not.toBeInTheDocument();
  });
});
