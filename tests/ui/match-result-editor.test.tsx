import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MatchResultEditor } from "@/components/admin/match-result-editor";

describe("goleadores privados y suplentes", () => {
  it("asigna equipo al suplente y guarda sus goles junto con el acta", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<MatchResultEditor enableScorers defaultScoreA={2} defaultScoreB={0} existingParticipants={[
      ...existingParticipants, { participantId: "player:sub", fullName: "Suplente", rating: 1000, source: "player", initialTeam: "OUT", isSubstitute: true }
    ]} onSubmit={onSubmit} submitLabel="Guardar" />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Equipo de Suplente" }), "A");
    await user.click(screen.getByText("Goleadores"));
    await user.type(screen.getByRole("spinbutton", { name: "Goles de Suplente" }), "1");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0].scorers).toEqual([{ participantId: "player:sub", goals: 1 }]);
    expect(onSubmit.mock.calls[0][0].lineup.assignments).toContainEqual({ participantId: "player:sub", team: "A" });
  });

  it("bloquea autores que superan el marcador y permite goles sin autor", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<MatchResultEditor enableScorers defaultScoreA={2} defaultScoreB={0} existingParticipants={existingParticipants} onSubmit={onSubmit} submitLabel="Guardar" />);
    await user.click(screen.getByText("Goleadores"));
    const goals = screen.getByRole("spinbutton", { name: "Goles de Jugador 1" });
    await user.type(goals, "3");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("no pueden superar el marcador");
    await user.clear(goals);
    await user.type(goals, "1");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0].scorers).toEqual([{ participantId: "player:player-1", goals: 1 }]);
  });

  it("evita perder goles silenciosamente al sacar a un goleador de la formación", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<MatchResultEditor enableScorers defaultScoreA={2} defaultScoreB={0} defaultScorers={[{ participantId: "player:player-1", goals: 2 }]} existingParticipants={existingParticipants} onSubmit={onSubmit} submitLabel="Guardar" />);
    await user.click(screen.getByText("Editar formacion"));
    await user.selectOptions(screen.getByRole("combobox", { name: "Equipo de Jugador 1" }), "OUT");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Un goleador no puede quedar sin jugar");
    await user.click(screen.getByRole("button", { name: "Quitar goles de Jugador 1" }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0].scorers).toEqual([]);
  });

  it("conserva la selección explícita de desventaja aunque un lado tenga más suplentes", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<MatchResultEditor enableScorers defaultHandicapTeam="A" defaultScoreA={2} defaultScoreB={0} existingParticipants={[
      ...existingParticipants, { participantId: "player:sub", fullName: "Suplente", rating: 1000, source: "player", initialTeam: "A", isSubstitute: true }
    ]} onSubmit={onSubmit} submitLabel="Guardar" />);
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0].lineup.handicapTeam).toBe("A");
  });
});

const existingParticipants = [
  {
    participantId: "player:player-1",
    fullName: "Jugador 1",
    rating: 1000,
    source: "player" as const,
    initialTeam: "A" as const
  },
  {
    participantId: "player:player-2",
    fullName: "Jugador 2",
    rating: 990,
    source: "player" as const,
    initialTeam: "A" as const
  },
  {
    participantId: "player:player-3",
    fullName: "Jugador 3",
    rating: 1005,
    source: "player" as const,
    initialTeam: "B" as const
  }
];

function getLineupPayload(container: HTMLElement) {
  const input = container.querySelector('input[name="lineupPayload"]') as HTMLInputElement;
  return JSON.parse(input.value) as {
    assignments: Array<{ participantId: string; team: "A" | "B" | "OUT" }>;
    absencePenaltyParticipantIds: string[];
    newGuests: Array<{ clientId?: string; name: string; rating: number; team: "A" | "B" }>;
    newPlayers: Array<{ playerId: string; team: "A" | "B" }>;
    handicapTeam: "A" | "B" | null;
  };
}

describe("MatchResultEditor", () => {
  it("abre invitados incompletos y enfoca el campo faltante antes de guardar el acta", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<MatchResultEditor defaultScoreA={2} defaultScoreB={1} existingParticipants={existingParticipants}
      onSubmit={onSubmit} submitLabel="Guardar resultado" />);
    const summary = screen.getByText("Invitados y reemplazos").closest("summary")!;
    await user.click(summary);
    await user.click(screen.getByRole("button", { name: "Agregar invitado" }));
    await user.type(screen.getByRole("textbox", { name: "Nombre del invitado de reemplazo 1" }), "Refuerzo");
    await user.click(summary);
    expect(summary.closest("details")).not.toHaveAttribute("open");

    await user.click(screen.getByRole("button", { name: "Guardar resultado" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(summary.closest("details")).toHaveAttribute("open");
    expect(screen.getByRole("alert")).toHaveTextContent("Completá el nombre y el nivel del invitado 1");
    const level = screen.getByRole("combobox", { name: "Nivel de Refuerzo" });
    expect(level).toHaveFocus();
    expect(level).toHaveAttribute("aria-invalid", "true");
    await user.selectOptions(level, "3");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Guardar resultado" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0].lineup.newGuests).toEqual([{ clientId: "1", name: "Refuerzo", rating: 3, team: "A" }]);
  });

  it("rechaza un nivel de invitado sin nombre incluso cuando sólo contiene espacios", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<MatchResultEditor defaultScoreA={2} defaultScoreB={1} existingParticipants={existingParticipants}
      onSubmit={onSubmit} submitLabel="Guardar resultado" />);
    await user.click(screen.getByText("Invitados y reemplazos").closest("summary")!);
    await user.click(screen.getByRole("button", { name: "Agregar invitado" }));
    const name = screen.getByRole("textbox", { name: "Nombre del invitado de reemplazo 1" });
    await user.type(name, "   ");
    await user.selectOptions(screen.getByRole("combobox", { name: "Nivel de invitado" }), "2");
    await user.click(screen.getByRole("button", { name: "Guardar resultado" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(name).toHaveFocus();
    expect(name).toHaveAttribute("aria-invalid", "true");
  });

  it("permite guardar cuando una fila de invitado quedó completamente vacía", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<MatchResultEditor defaultScoreA={2} defaultScoreB={1} existingParticipants={existingParticipants}
      onSubmit={onSubmit} submitLabel="Guardar resultado" />);
    await user.click(screen.getByText("Invitados y reemplazos").closest("summary")!);
    await user.click(screen.getByRole("button", { name: "Agregar invitado" }));
    await user.click(screen.getByRole("button", { name: "Guardar resultado" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0].lineup.newGuests).toEqual([]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("rehidrata acta, sanciones, desventaja y version al corregir", () => {
    const participants = [...existingParticipants, { participantId: "player:absent", fullName: "Ausente", rating: 980, source: "player" as const, initialTeam: "OUT" as const }];
    const { container } = render(<MatchResultEditor existingParticipants={participants} expectedVersion={7}
      defaultScoreA={2} defaultScoreB={1} defaultAbsencePenaltyParticipantIds={["player:absent"]} defaultHandicapTeam="B" submitLabel="Corregir" />);
    expect(getLineupPayload(container).absencePenaltyParticipantIds).toEqual(["player:absent"]);
    expect(getLineupPayload(container).handicapTeam).toBe("B");
    expect(container.querySelector<HTMLInputElement>('input[name="expectedVersion"]')?.value).toBe("7");
  });

  it("identifica los inputs del resultado con el nombre de cada equipo", () => {
    render(
      <MatchResultEditor
        defaultNotes=""
        defaultScoreA={2}
        defaultScoreB={1}
        existingParticipants={existingParticipants}
        submitLabel="Guardar"
        teamALabel="TEST1"
        teamBLabel="TEST2"
      />
    );

    expect(screen.getByLabelText("Goles de TEST1")).toHaveAttribute("name", "scoreA");
    expect(screen.getByLabelText("Goles de TEST2")).toHaveAttribute("name", "scoreB");
    expect(screen.getByText("TEST1 vs TEST2")).toBeInTheDocument();
    expect(screen.getByText("Formacion final")).toBeInTheDocument();
    expect(screen.getByText("Invitados y reemplazos")).toBeInTheDocument();
  });

  it("muestra quienes integran cada equipo al cargar los goles", () => {
    render(
      <MatchResultEditor
        defaultNotes=""
        defaultScoreA={2}
        defaultScoreB={1}
        existingParticipants={existingParticipants}
        submitLabel="Guardar"
        teamALabel="Negro"
        teamBLabel="Blanco"
      />
    );

    const teamACard = screen.getByText("Equipo Negro").closest("div");
    const teamBCard = screen.getByText("Equipo Blanco").closest("div");

    expect(teamACard).not.toBeNull();
    expect(teamBCard).not.toBeNull();
    expect(within(teamACard as HTMLElement).getByText("Jugador 1, Jugador 2")).toBeInTheDocument();
    expect(within(teamBCard as HTMLElement).getByText("Jugador 3")).toBeInTheDocument();
  });

  it("aclara cuando un equipo no tiene jugadores asignados", () => {
    render(
      <MatchResultEditor
        defaultNotes=""
        defaultScoreA={0}
        defaultScoreB={0}
        existingParticipants={[]}
        submitLabel="Guardar"
        teamALabel="Negro"
        teamBLabel="Blanco"
      />
    );

    const teamACard = screen.getByText("Equipo Negro").closest("div");
    const teamBCard = screen.getByText("Equipo Blanco").closest("div");

    expect(teamACard).not.toBeNull();
    expect(teamBCard).not.toBeNull();
    expect(within(teamACard as HTMLElement).getByText("Sin jugadores asignados")).toBeInTheDocument();
    expect(within(teamBCard as HTMLElement).getByText("Sin jugadores asignados")).toBeInTheDocument();
  });

  it("actualiza el payload de lineup, invitados y handicap", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MatchResultEditor
        defaultNotes=""
        defaultScoreA={0}
        defaultScoreB={0}
        existingParticipants={existingParticipants}
        submitLabel="Guardar"
      />
    );

    await user.selectOptions(screen.getByLabelText("Equipo de Jugador 2"), "OUT");
    await user.click(screen.getByLabelText("Aplicar regla de desventaja numerica"));
    await user.click(screen.getByRole("button", { name: "Agregar invitado" }));
    await user.type(screen.getByPlaceholderText("Nombre invitado"), "Invitado B");
    await user.selectOptions(screen.getByLabelText("Nivel de Invitado B"), "0.5");
    await user.selectOptions(screen.getByLabelText("Equipo de Invitado B"), "B");

    const payload = getLineupPayload(container);
    expect(payload.assignments).toContainEqual({
      participantId: "player:player-2",
      team: "OUT"
    });
    expect(payload.absencePenaltyParticipantIds).toEqual([]);
    expect(payload.newGuests).toEqual([
      {
        clientId: "1",
        name: "Invitado B",
        rating: 0.5,
        team: "B"
      }
    ]);
    expect(payload.newPlayers).toEqual([]);
    expect(payload.handicapTeam).toBe("A");
  });

  it("permite marcar penalizacion opcional por ausencia", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MatchResultEditor
        defaultNotes=""
        defaultScoreA={0}
        defaultScoreB={0}
        existingParticipants={existingParticipants}
        submitLabel="Guardar"
      />
    );

    await user.selectOptions(screen.getByLabelText("Equipo de Jugador 2"), "OUT");
    await user.click(screen.getByLabelText("Restar 20 a Jugador 2 por ausencia"));

    expect(getLineupPayload(container).absencePenaltyParticipantIds).toEqual(["player:player-2"]);
  });

  it("envia el payload correcto al guardar", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <MatchResultEditor
        defaultNotes="Nota base"
        defaultScoreA={1}
        defaultScoreB={0}
        existingParticipants={existingParticipants}
        onSubmit={onSubmit}
        submitLabel="Guardar resultado"
      />
    );

    await user.selectOptions(screen.getByLabelText("Equipo de Jugador 2"), "OUT");
    await user.click(screen.getByRole("button", { name: "Agregar invitado" }));
    await user.type(screen.getByPlaceholderText("Nombre invitado"), "Refuerzo");
    await user.selectOptions(screen.getByLabelText("Nivel de Refuerzo"), "2");
    await user.click(screen.getByLabelText("Aplicar regla de desventaja numerica"));
    await user.selectOptions(screen.getByLabelText("Equipo de Refuerzo"), "B");
    await user.type(screen.getByPlaceholderText("Notas opcionales"), " editada");
    await user.click(screen.getByRole("button", { name: "Guardar resultado" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        expectedVersion: 0,
        scoreA: 1,
        scoreB: 0,
        notes: "Nota base editada",
        mvpParticipantId: null,
        lineup: {
          assignments: [
            { participantId: "player:player-1", team: "A" },
            { participantId: "player:player-2", team: "OUT" },
            { participantId: "player:player-3", team: "B" }
          ],
          absencePenaltyParticipantIds: [],
          newGuests: [{ clientId: "1", name: "Refuerzo", rating: 2, team: "B" }],
          newPlayers: [],
          handicapTeam: "A"
        }
      });
    });
  });

  it("permite elegir MVP al guardar resultado", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <MatchResultEditor
        defaultNotes=""
        defaultScoreA={3}
        defaultScoreB={1}
        existingParticipants={existingParticipants}
        onSubmit={onSubmit}
        submitLabel="Guardar resultado"
      />
    );

    await user.selectOptions(screen.getByLabelText("MVP del partido"), "player:player-1");
    expect(screen.getByText(/La figura es opcional y no suma puntos/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Guardar resultado" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          mvpParticipantId: "player:player-1"
        })
      );
    });
  });

  it("permite elegir como MVP a un invitado agregado en el resultado", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <MatchResultEditor
        defaultNotes=""
        defaultScoreA={1}
        defaultScoreB={0}
        existingParticipants={existingParticipants}
        onSubmit={onSubmit}
        submitLabel="Guardar resultado"
      />
    );

    await user.click(screen.getByRole("button", { name: "Agregar invitado" }));
    await user.type(screen.getByPlaceholderText("Nombre invitado"), "Invitado Nuevo");
    await user.selectOptions(screen.getByLabelText("Nivel de Invitado Nuevo"), "2");
    await user.selectOptions(screen.getByLabelText("Equipo de Invitado Nuevo"), "B");
    await user.selectOptions(screen.getByLabelText("MVP del partido"), "newGuest:1");
    await user.click(screen.getByRole("button", { name: "Guardar resultado" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          mvpParticipantId: "newGuest:1"
        })
      );
    });
  });

  it("permite agregar reemplazos de plantilla al resultado", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MatchResultEditor
        availablePlayers={[{ id: "player-4", fullName: "Jugador 4", rating: 980 }]}
        defaultNotes=""
        defaultScoreA={0}
        defaultScoreB={0}
        existingParticipants={existingParticipants}
        submitLabel="Guardar"
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Agregar" })).toBeEnabled();
    });

    await user.selectOptions(screen.getByLabelText("Equipo del reemplazo"), "B");
    await user.click(screen.getByRole("button", { name: "Agregar" }));

    const payload = getLineupPayload(container);
    expect(payload.newPlayers).toEqual([{ playerId: "player-4", team: "B" }]);
  });

  it("muestra el error si el submit falla", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error("No se pudo guardar resultado."));

    render(
      <MatchResultEditor
        defaultNotes=""
        defaultScoreA={0}
        defaultScoreB={0}
        existingParticipants={existingParticipants}
        onSubmit={onSubmit}
        submitLabel="Guardar"
      />
    );

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await screen.findByText("No se pudo guardar resultado.");
  });
});
