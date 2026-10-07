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
    expect(screen.getByRole("button", { name: "Guardar formaciones" })).toBeEnabled();
    expect(blue.queryByRole("button", { name: "Rojo Jugador 1" })).not.toBeInTheDocument();
    await user.click(blue.getByRole("button", { name: "Defensa 1: Azul Jugador 1" }));
    await user.click(blue.getByRole("button", { name: "Quitar de esta posición" }));
    expect(screen.getByRole("button", { name: "Guardar formaciones" })).toBeDisabled();
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
  it("advierte los puestos forzados cuando todos prefieren atacar y permite guardar la formación completa", async () => {
    const user = userEvent.setup();
    const forwardPlayers = (side: string): FormationPlayer[] => players(side).map((player) => ({ ...player, preferredPosition: "FWD" }));
    const forwardTeams = { teamA: forwardPlayers("Azul"), teamB: forwardPlayers("Rojo") };
    const action = vi.fn().mockResolvedValue({ ok: true, version: 1 });
    render(<MatchFormationEditor {...base} action={action} initialFormation={null} teams={forwardTeams} />);

    expect(screen.getAllByText("6 jugadores fuera de sus posiciones habituales")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Guardar formaciones" })).toBeEnabled();
    for (const label of ["Azul", "Rojo"]) {
      const pitch = within(screen.getByRole("group", { name: `Cancha de ${label}` }));
      expect(pitch.queryAllByRole("button", { name: /: Elegir jugador$/ })).toHaveLength(0);
      expect(pitch.getByRole("button", { name: `Arco: ${label} Jugador 0` })).toBeVisible();
    }

    await user.selectOptions(screen.getByRole("combobox", { name: "Esquema de Azul" }), "4-3-1");
    expect(screen.getByText("7 jugadores fuera de sus posiciones habituales")).toHaveAttribute("role", "status");
    expect(screen.getByText("6 jugadores fuera de sus posiciones habituales")).toHaveAttribute("role", "status");
    await user.click(screen.getByRole("button", { name: "Guardar formaciones" }));
    await waitFor(() => expect(screen.getByText(/Formaciones guardadas/)).toBeInTheDocument());
    expect(action).toHaveBeenCalledOnce();
    const saved = JSON.parse(action.mock.calls[0][1]) as MatchFormation;
    for (const key of ["teamA", "teamB"] as const) {
      expect(new Set(saved[key].slots.map((slot) => slot.participantId)).size).toBe(9);
      expect(saved[key].slots.map((slot) => slot.participantId)).not.toContain(null);
    }
  });
  it("no advierte por posiciones secundarias, jugadores sin preferencia ni un arquero elegido para el partido", () => {
    const preferredTeam = players("Azul");
    preferredTeam[0].preferredPosition = "DEF";
    for (const index of [1, 2, 3]) {
      preferredTeam[index].preferredPosition = "FWD";
      preferredTeam[index].secondaryPosition = "DEF";
    }
    for (const index of [4, 5, 6]) {
      preferredTeam[index].preferredPosition = null;
      preferredTeam[index].secondaryPosition = null;
    }
    for (const index of [7, 8]) preferredTeam[index].preferredPosition = "FWD";
    render(<MatchFormationEditor {...base} action={vi.fn()} initialFormation={complete()} teams={{ teamA: preferredTeam, teamB: teams.teamB }} />);

    expect(screen.queryAllByText(/fuera de sus posiciones habituales/i)).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Guardar formaciones" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Arco: Azul Jugador 0" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Defensa 1: Azul Jugador 1" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Mediocampo 1: Azul Jugador 4" })).toBeVisible();
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
  it("intercambia con un solo clic sin dejar vacantes y permite deshacer", async () => {
    const user = userEvent.setup();
    render(<MatchFormationEditor {...base} action={vi.fn()} initialFormation={complete()} />);
    const blue = within(screen.getByRole("region", { name: "Formación de Azul" }));
    const selectedShirt = blue.getByRole("button", { name: "Defensa 1: Azul Jugador 1" });
    const panel = document.getElementById(selectedShirt.getAttribute("aria-controls")!)!;
    panel.scrollIntoView = vi.fn();
    await user.click(selectedShirt);
    await waitFor(() => expect(blue.getByRole("searchbox")).toHaveFocus());
    expect(panel.scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    const candidate = blue.getByRole("button", { name: "Azul Jugador 2" });
    expect(candidate).toHaveAccessibleDescription("Intercambia con Defensa 2 Sin preferencia guardada");
    expect(candidate).toHaveAttribute("data-formation-candidate");
    expect(blue.queryByRole("button", { name: "Azul Jugador 0" })).not.toBeInTheDocument();
    await user.click(candidate);
    expect(blue.getByRole("button", { name: "Defensa 1: Azul Jugador 2" })).toBeInTheDocument();
    expect(blue.getByRole("button", { name: "Defensa 2: Azul Jugador 1" })).toBeInTheDocument();
    expect(blue.queryByRole("button", { name: /Elegir jugador/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar formaciones" })).toBeEnabled();
    expect(screen.getByText(/Tenés cambios sin guardar/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Deshacer último cambio" }));
    expect(blue.getByRole("button", { name: "Defensa 1: Azul Jugador 1" })).toBeInTheDocument();
    expect(blue.getByRole("button", { name: "Defensa 2: Azul Jugador 2" })).toBeInTheDocument();
    expect(screen.queryByText(/Tenés cambios sin guardar/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deshacer último cambio" })).not.toBeInTheDocument();
  });
  it("reacomoda a pedido el esquema actual, explica el desajuste y permite recuperar el armado manual", async () => {
    const user = userEvent.setup();
    const preferredTeam: FormationPlayer[] = players("Azul").map((player, index) => ({ ...player,
      preferredPosition: index === 0 ? "FWD" : index <= 3 ? "DEF" : index <= 6 ? "MID" : "FWD",
      ...(index === 5 ? { secondaryPosition: "DEF" as const } : {})
    }));
    render(<MatchFormationEditor {...base} action={vi.fn()} initialFormation={complete()} teams={{ teamA: preferredTeam, teamB: teams.teamB }} />);
    const blue = within(screen.getByRole("region", { name: "Formación de Azul" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Esquema de Azul" }), "4-2-2");
    expect(screen.getByText("1 arquero · 4 defensores · 2 mediocampistas · 2 delanteros")).toBeInTheDocument();
    expect(blue.getByRole("button", { name: "Defensa 4: Azul Jugador 4" })).toHaveAccessibleDescription("Fuera de sus posiciones habituales");
    expect(blue.getByText("1 jugador fuera de sus posiciones habituales")).toBeInTheDocument();
    await user.click(blue.getByRole("button", { name: "Revisar a Azul Jugador 4" }));
    await waitFor(() => expect(blue.getByRole("searchbox")).toHaveFocus());
    expect(blue.getByRole("button", { name: "Azul Jugador 5" })).toHaveAccessibleDescription(/Prefiere mediocampista · También defensor/);
    await user.click(screen.getAllByRole("button", { name: "Reacomodar según posiciones" })[0]);
    expect(blue.queryByText("1 jugador fuera de sus posiciones habituales")).not.toBeInTheDocument();
    expect(blue.getByRole("button", { name: /Defensa \d: Azul Jugador 5/ })).toBeInTheDocument();
    expect(blue.getByRole("button", { name: "Arco: Azul Jugador 0" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Deshacer último cambio" }));
    expect(blue.getByRole("button", { name: "Defensa 4: Azul Jugador 4" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Esquema de Azul" })).toHaveValue("4-2-2");
    expect(screen.getByText(/Tenés cambios sin guardar/)).toBeInTheDocument();
  });
  it("prioriza jugadores sin ubicar para completar vacantes y explica suplentes por separado", async () => {
    const user = userEvent.setup();
    const substitute: FormationPlayer = { participantId: "guest:sub", name: "ZZ Suplente" };
    const incomplete = complete();
    incomplete.teamA.slots[1].participantId = null;
    render(<MatchFormationEditor {...base} action={vi.fn()} initialFormation={incomplete} teams={{ ...teams, teamA: [...teams.teamA, substitute] }} />);
    expect(screen.getByText("8 de 9 puestos completos · 1 suplente · 2 sin ubicar")).toBeInTheDocument();
    const blue = within(screen.getByRole("region", { name: "Formación de Azul" }));
    await user.click(blue.getByRole("button", { name: "Defensa 1: Elegir jugador" }));
    const candidates = screen.getByRole("region", { name: "Formación de Azul" }).querySelectorAll("[data-formation-candidate]");
    expect([...candidates].slice(0, 2).map((candidate) => candidate.getAttribute("aria-label"))).toEqual(["Azul Jugador 1", "ZZ Suplente"]);
    await user.click(blue.getByRole("button", { name: "ZZ Suplente" }));
    expect(screen.getByText("9 de 9 puestos completos · 1 suplente")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar formaciones" })).toBeEnabled();
    expect(blue.getByRole("button", { name: "Azul Jugador 1" })).toHaveAccessibleDescription(/Sin ubicar · Reemplaza a ZZ Suplente/);
  });
  it("ordena candidatos por preferida, secundaria, sin preferencia y fuera de puesto", async () => {
    const user = userEvent.setup();
    const roster: FormationPlayer[] = players("Azul").map((player) => ({ ...player, preferredPosition: "FWD" }));
    roster[7].preferredPosition = "DEF";
    roster[6].secondaryPosition = "DEF";
    roster[5].preferredPosition = null;
    render(<MatchFormationEditor {...base} action={vi.fn()} initialFormation={complete()} teams={{ ...teams, teamA: roster }} />);
    const region = screen.getByRole("region", { name: "Formación de Azul" });
    await user.click(within(region).getByRole("button", { name: "Defensa 1: Azul Jugador 1" }));
    const candidates = region.querySelectorAll("[data-formation-candidate]");
    expect([...candidates].slice(0, 3).map((candidate) => candidate.getAttribute("aria-label"))).toEqual(["Azul Jugador 7", "Azul Jugador 6", "Azul Jugador 5"]);
  });
  it("protege navegación y recarga sólo con cambios pendientes y limpia la protección al guardar", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockResolvedValue({ ok: true, version: 1 });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const navigate = vi.fn((event: React.MouseEvent<HTMLAnchorElement>) => event.preventDefault());
    try {
      render(<><a href="/otra-pantalla" onClick={navigate}>Salir del editor</a><MatchFormationEditor {...base} action={action} initialFormation={complete()} /></>);
      const cleanUnload = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(cleanUnload);
      expect(cleanUnload.defaultPrevented).toBe(false);
      await user.selectOptions(screen.getByRole("combobox", { name: "Esquema de Azul" }), "4-2-2");
      const dirtyUnload = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(dirtyUnload);
      expect(dirtyUnload.defaultPrevented).toBe(true);
      await user.click(screen.getByRole("link", { name: "Salir del editor" }));
      expect(confirm).toHaveBeenCalledOnce();
      expect(navigate).not.toHaveBeenCalled();
      await user.click(screen.getByRole("button", { name: "Guardar formaciones" }));
      await screen.findByText(/Formaciones guardadas/);
      const savedUnload = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(savedUnload);
      expect(savedUnload.defaultPrevented).toBe(false);
      await user.click(screen.getByRole("link", { name: "Salir del editor" }));
      expect(navigate).toHaveBeenCalledOnce();
      expect(confirm).toHaveBeenCalledOnce();
      expect(screen.queryByRole("button", { name: "Deshacer último cambio" })).not.toBeInTheDocument();
    } finally { confirm.mockRestore(); }
  });
  it("mostrar la lista conserva el borrador pendiente, deshacer y la protección hasta guardar la cancha", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockResolvedValueOnce({ ok: true, version: 1 }).mockResolvedValueOnce({ ok: true, version: 2 });
    render(<MatchFormationEditor {...base} action={action} initialFormation={complete()} />);
    const blue = within(screen.getByRole("region", { name: "Formación de Azul" }));
    await user.click(blue.getByRole("button", { name: "Defensa 1: Azul Jugador 1" }));
    await user.click(blue.getByRole("button", { name: "Azul Jugador 2" }));
    await user.click(screen.getByRole("button", { name: "Mostrar lista en el enlace" }));
    await screen.findByText("El enlace vuelve a mostrar la lista de equipos.");
    expect(action).toHaveBeenLastCalledWith(0, "null");
    expect(blue.getByRole("button", { name: "Defensa 1: Azul Jugador 2" })).toBeInTheDocument();
    expect(screen.getByText("Tenés cambios sin guardar. El enlace muestra la lista de equipos.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deshacer último cambio" })).toBeEnabled();
    const pendingUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(pendingUnload);
    expect(pendingUnload.defaultPrevented).toBe(true);
    await user.click(screen.getByRole("button", { name: "Guardar formaciones" }));
    await screen.findByText(/Formaciones guardadas/);
    expect(action.mock.calls[1][0]).toBe(1);
    expect(JSON.parse(action.mock.calls[1][1]).teamA.slots[1].participantId).toBe(teams.teamA[2].participantId);
    expect(screen.queryByText(/Tenés cambios sin guardar/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deshacer último cambio" })).not.toBeInTheDocument();
  });
});
