import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MatchResultEditor } from "@/components/admin/match-result-editor";

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
