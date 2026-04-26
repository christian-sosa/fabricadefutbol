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
    newGuests: Array<{ name: string; rating: number; team: "A" | "B" }>;
    handicapTeam: "A" | "B" | null;
  };
}

describe("MatchResultEditor", () => {
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

    const selects = container.querySelectorAll("select");
    await user.selectOptions(selects[1] as HTMLSelectElement, "OUT");
    await user.click(screen.getByLabelText("Aplicar regla de desventaja numerica"));
    await user.click(screen.getByRole("button", { name: "Agregar invitado" }));
    await user.type(screen.getByPlaceholderText("Nombre invitado"), "Invitado B");
    await user.clear(screen.getByPlaceholderText("Rendimiento"));
    await user.type(screen.getByPlaceholderText("Rendimiento"), "8");
    const guestAndHandicapSelects = container.querySelectorAll("select");
    await user.selectOptions(guestAndHandicapSelects[3] as HTMLSelectElement, "B");

    const payload = getLineupPayload(container);
    expect(payload.assignments).toContainEqual({
      participantId: "player:player-2",
      team: "OUT"
    });
    expect(payload.newGuests).toEqual([
      {
        name: "Invitado B",
        rating: 8,
        team: "B"
      }
    ]);
    expect(payload.handicapTeam).toBe("A");
  });

  it("envia el payload correcto al guardar", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <MatchResultEditor
        defaultNotes="Nota base"
        defaultScoreA={1}
        defaultScoreB={0}
        existingParticipants={existingParticipants}
        onSubmit={onSubmit}
        submitLabel="Guardar resultado"
      />
    );

    const selects = container.querySelectorAll("select");
    await user.selectOptions(selects[1] as HTMLSelectElement, "OUT");
    await user.click(screen.getByRole("button", { name: "Agregar invitado" }));
    await user.type(screen.getByPlaceholderText("Nombre invitado"), "Refuerzo");
    await user.clear(screen.getByPlaceholderText("Rendimiento"));
    await user.type(screen.getByPlaceholderText("Rendimiento"), "7");
    await user.click(screen.getByLabelText("Aplicar regla de desventaja numerica"));
    const guestAndHandicapSelects = container.querySelectorAll("select");
    await user.selectOptions(guestAndHandicapSelects[3] as HTMLSelectElement, "B");
    await user.type(screen.getByPlaceholderText("Notas opcionales"), " editada");
    await user.click(screen.getByRole("button", { name: "Guardar resultado" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        scoreA: 1,
        scoreB: 0,
        notes: "Nota base editada",
        lineup: {
          assignments: [
            { participantId: "player:player-1", team: "A" },
            { participantId: "player:player-2", team: "OUT" },
            { participantId: "player:player-3", team: "B" }
          ],
          newGuests: [{ name: "Refuerzo", rating: 7, team: "B" }],
          handicapTeam: "A"
        }
      });
    });
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
