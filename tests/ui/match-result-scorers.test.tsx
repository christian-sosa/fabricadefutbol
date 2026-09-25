import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MatchResultEditor } from "@/components/admin/match-result-editor";

const participants = [
  { participantId: "player:p1", fullName: "Ana", rating: 1000, source: "player" as const, initialTeam: "A" as const },
  { participantId: "player:p2", fullName: "Pablo", rating: 1000, source: "player" as const, initialTeam: "B" as const }
];

describe("autores y formación final", () => {
  it("vincula los goles de un invitado nuevo con su identificador en la misma formación", async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(undefined);
    render(<MatchResultEditor enableScorers defaultScoreA={0} defaultScoreB={2} existingParticipants={participants} onSubmit={save} submitLabel="Guardar" />);
    await user.click(screen.getByText("Agregar cambios"));
    await user.click(screen.getByRole("button", { name: "Agregar invitado" }));
    await user.type(screen.getByRole("textbox", { name: "Nombre del invitado de reemplazo 1" }), "Refuerzo");
    await user.selectOptions(screen.getByLabelText("Nivel de Refuerzo"), "3");
    await user.selectOptions(screen.getByLabelText("Equipo de Refuerzo"), "B");
    await user.click(screen.getByText("Goleadores"));
    await user.type(screen.getByRole("spinbutton", { name: "Goles de Refuerzo (invitado)" }), "2");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0][0]).toMatchObject({
      scorers: [{ participantId: "newGuest:1", goals: 2 }],
      lineup: { newGuests: [{ clientId: "1", name: "Refuerzo", rating: 3, team: "B" }] }
    });
  });

  it("revalida los goles contra el equipo nuevo al cambiar una asignación y conserva los autores al corregir notas", async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(undefined);
    render(<MatchResultEditor enableScorers defaultScorers={[{ participantId: "player:p1", goals: 2 }]} defaultScoreA={2} defaultScoreB={0} existingParticipants={participants} onSubmit={save} submitLabel="Guardar" />);
    await user.click(screen.getByText("Editar formacion"));
    await user.selectOptions(screen.getByLabelText("Equipo de Ana"), "B");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("no pueden superar el marcador");
    await user.selectOptions(screen.getByLabelText("Equipo de Ana"), "A");
    await user.type(screen.getByLabelText("Notas opcionales"), "Nota corregida");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0][0]).toMatchObject({ notes: "Nota corregida", scorers: [{ participantId: "player:p1", goals: 2 }] });
  });
});
