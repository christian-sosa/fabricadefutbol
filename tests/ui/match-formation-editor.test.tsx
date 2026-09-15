import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MatchFormationEditor } from "@/components/admin/match-formation-editor";
import { FORMATION_PRESETS, getFormationPositions, type FormationPlayer, type FormationSaveResult, type MatchFormation } from "@/lib/domain/match-formation";
import { MATCH_MODALITIES, TEAM_SIZE_BY_MODALITY } from "@/lib/constants";

const players = (side: string, size = 9): FormationPlayer[] => Array.from({ length: size }, (_, i) => ({ participantId: `player:${side}-${i}`, name: `${side} Jugador ${i}`, isGoalkeeper: i === 0 }));
const teams = { teamA: players("Azul"), teamB: players("Rojo") };
const complete = (): MatchFormation => Object.fromEntries(Object.entries(teams).map(([key, pool]) => [key, { formationId: "3-3-2", slots: getFormationPositions("3-3-2").map((position, i) => ({ slotId: position.slotId, participantId: pool[i].participantId })) }])) as MatchFormation;
const base = { modality: "9v9" as const, teams, teamLabels: { teamA: "Azul", teamB: "Rojo" }, initialVersion: 0 };

describe("MatchFormationEditor", () => {
  it.each(MATCH_MODALITIES)("offers only matching %s schemes and keeps both teams when saving a different shape", async (modality) => {
    const user = userEvent.setup();
    const size = TEAM_SIZE_BY_MODALITY[modality];
    const currentTeams = { teamA: players("Azul", size), teamB: players("Rojo", size) };
    const preset = FORMATION_PRESETS[modality][0];
    const currentFormation = Object.fromEntries(Object.entries(currentTeams).map(([key, pool]) => [key, {
      formationId: preset,
      slots: getFormationPositions(preset).map((position, index) => ({ slotId: position.slotId, participantId: pool[index].participantId }))
    }])) as MatchFormation;
    const action = vi.fn().mockResolvedValue({ ok: true, version: 1 });
    render(<MatchFormationEditor {...base} action={action} initialFormation={currentFormation} modality={modality} teams={currentTeams} />);

    for (const label of ["Azul", "Rojo"]) {
      const select = screen.getByRole("combobox", { name: `Esquema de ${label}` });
      expect(within(select).getAllByRole("option").map((option) => (option as HTMLOptionElement).value)).toEqual(FORMATION_PRESETS[modality]);
      const pitch = within(screen.getByRole("group", { name: `Cancha de ${label}` }));
      expect(pitch.getAllByRole("button")).toHaveLength(size);
    }
    await user.selectOptions(screen.getByRole("combobox", { name: "Esquema de Azul" }), FORMATION_PRESETS[modality][1]);
    await user.selectOptions(screen.getByRole("combobox", { name: "Esquema de Rojo" }), FORMATION_PRESETS[modality][2]);
    await user.click(screen.getByRole("button", { name: "Guardar formaciones" }));

    await waitFor(() => expect(screen.getByText(/Formaciones guardadas/)).toBeInTheDocument());
    expect(action).toHaveBeenCalledOnce();
    const saved = JSON.parse(action.mock.calls[0][1]) as MatchFormation;
    expect(saved.teamA.formationId).toBe(FORMATION_PRESETS[modality][1]);
    expect(saved.teamB.formationId).toBe(FORMATION_PRESETS[modality][2]);
    for (const key of ["teamA", "teamB"] as const) {
      expect(saved[key].slots.map((slot) => slot.participantId)).toEqual(currentTeams[key].map((player) => player.participantId));
      expect(saved[key].slots[0].slotId).toBe("gk");
    }
  });
  it("locks the confirmed goalkeeper and assigns from each team's available pool", async () => {
    const user = userEvent.setup();
    const action = vi.fn();
    render(<MatchFormationEditor {...base} action={action} initialFormation={null} />);
    const blue = within(screen.getByRole("region", { name: "Formación de Azul" }));
    expect(screen.getByRole("button", { name: "Guardar formaciones" })).toBeDisabled();
    expect(blue.queryByRole("button", { name: "Rojo Jugador 1" })).not.toBeInTheDocument();
    await user.click(blue.getByRole("button", { name: "Azul Jugador 1" }));
    expect(blue.getByRole("button", { name: "Defensa 1: Azul Jugador 1" })).toBeInTheDocument();
    expect(blue.queryByRole("button", { name: "Azul Jugador 1" })).not.toBeInTheDocument();
    expect(blue.getByRole("searchbox", { name: "Jugadores disponibles de Azul" })).toHaveFocus();
    const shirt = blue.getByRole("button", { name: "Defensa 1: Azul Jugador 1" });
    expect(document.getElementById(shirt.getAttribute("aria-controls")!)).toContainElement(blue.getByRole("searchbox"));
    await user.click(shirt);
    await user.click(blue.getByRole("button", { name: "Quitar de esta posición" }));
    expect(blue.getByRole("searchbox", { name: "Jugadores disponibles de Azul" })).toHaveFocus();
    await user.click(blue.getByRole("button", { name: "Arco: Azul Jugador 0" }));
    expect(blue.getByText(/ya fue marcado como arquero/)).toBeInTheDocument();
    expect(blue.queryByRole("button", { name: "Quitar de esta posición" })).not.toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });
  it("keeps assignments when changing schemes and retains the draft after a network failure", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ ok: true, version: 1 });
    render(<MatchFormationEditor {...base} action={action} initialFormation={complete()} />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Esquema de Azul" }), "4-3-1");
    await user.click(screen.getByRole("button", { name: "Guardar formaciones" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Tu formación sigue acá");
    expect(screen.getByRole("combobox", { name: "Esquema de Azul" })).toHaveValue("4-3-1");
    const firstPayload = JSON.parse(action.mock.calls[0][1]);
    expect(firstPayload.teamA.slots.map((slot: { participantId: string }) => slot.participantId)).toEqual(teams.teamA.map((player) => player.participantId));
    await user.click(screen.getByRole("button", { name: "Guardar formaciones" }));
    await waitFor(() => expect(screen.getByText(/Formaciones guardadas/)).toBeInTheDocument());
    expect(action).toHaveBeenLastCalledWith(0, action.mock.calls[0][1]);
    await user.click(screen.getByRole("button", { name: "Mostrar lista en el enlace" }));
    expect(action).toHaveBeenLastCalledWith(1, "null");
  });
  it("prevents duplicate in-flight saves and preserves positions on version conflict", async () => {
    let finish!: (result: FormationSaveResult) => void;
    const action = vi.fn(() => new Promise<FormationSaveResult>((resolve) => { finish = resolve; }));
    render(<MatchFormationEditor {...base} action={action} initialFormation={complete()} />);
    const submit = screen.getByRole("button", { name: "Guardar formaciones" });
    const form = submit.closest("form")!;
    fireEvent.submit(form); fireEvent.submit(form);
    expect(action).toHaveBeenCalledTimes(1);
    await act(async () => finish({ ok: false, conflict: true, error: "Otra sesión cambió la formación." }));
    expect(screen.getByRole("alert")).toHaveTextContent("Otra sesión");
    expect(screen.getByRole("button", { name: "Guardar formaciones" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Recargar formación guardada" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Defensa 1: Azul Jugador 1" })).toBeInTheDocument();
  });
});
