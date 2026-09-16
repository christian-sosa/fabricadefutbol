import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/admin/(panel)/form-actions", () => ({
  createMatchFormAction: vi.fn(async () => ({ error: null }))
}));

import { NewMatchForm } from "@/components/admin/new-match-form";
import { createMatchFormAction } from "@/app/admin/(panel)/form-actions";

const DEFAULT_SCHEDULED_DATE = "2026-05-05";

function buildPlayers(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `player-${index + 1}`,
    full_name: `Jugador ${index + 1}`,
    current_rating: 1000 - index * 10,
    initial_rank: index + 1,
    skill_level: Math.min(7, Math.floor(index / 2) + 1),
    display_order: index + 1
  }));
}

function getCheckbox(container: HTMLElement, name: string, value: string) {
  const element = container.querySelector(
    `input[name="${name}"][value="${value}"]`
  ) as HTMLInputElement | null;

  if (!element) {
    throw new Error(`No se encontro ${name}=${value}`);
  }

  return element;
}

describe("NewMatchForm", () => {
  it("no crea el partido al presionar Enter en el buscador con la convocatoria completa", async () => {
    const user = userEvent.setup();
    const createAction = vi.mocked(createMatchFormAction);
    createAction.mockClear();
    const players = buildPlayers(10);
    render(<NewMatchForm defaultScheduledDate={DEFAULT_SCHEDULED_DATE} organizationId="org-1" players={players}
      initialValues={{ modality: "5v5", scheduledTime: "21:00", playerIds: players.map((player) => player.id), goalkeeperPlayerIds: [], guests: [] }} />);
    const submit = screen.getByRole("button", { name: "Crear partido y generar equipos" });
    expect(submit).toBeEnabled();

    const search = screen.getByRole("searchbox", { name: "Buscar jugador" });
    await user.type(search, "Jugador 1{Enter}");
    expect(createAction).not.toHaveBeenCalled();
    expect(search).toHaveFocus();
    expect(search).toHaveValue("Jugador 1");

    await user.click(submit);
    await waitFor(() => expect(createAction).toHaveBeenCalledOnce());
    expect(createAction.mock.calls[0][0].getAll("playerIds")).toEqual(players.map((player) => player.id));
  });

  it("busca sin acentos y conserva convocados y arqueros ocultos en el envío", async () => {
    const user = userEvent.setup();
    const players = buildPlayers(10);
    players[0].full_name = "Álvaro Pérez";
    const { container } = render(<NewMatchForm defaultScheduledDate={DEFAULT_SCHEDULED_DATE} organizationId="org-1" players={players}
      initialValues={{ modality: "5v5", playerIds: players.map((player) => player.id), goalkeeperPlayerIds: ["player-1", "player-2"], guests: [] }} />);
    await user.type(screen.getByLabelText("Buscar jugador"), "alvaro");
    expect(screen.getByRole("checkbox", { name: "Juega Álvaro Pérez" })).toBeVisible();
    expect(screen.queryByRole("checkbox", { name: "Juega Jugador 2" })).not.toBeInTheDocument();
    const data = new FormData(container.querySelector("form")!);
    expect(data.getAll("playerIds")).toEqual(players.map((player) => player.id));
    expect(data.getAll("goalkeeperPlayerIds")).toEqual(["player-1", "player-2"]);
    await user.clear(screen.getByLabelText("Buscar jugador"));
    await user.click(screen.getByRole("checkbox", { name: "Juega Jugador 3" }));
    await user.click(screen.getByRole("button", { name: "Convocados (9)" }));
    expect(screen.queryByRole("checkbox", { name: "Juega Jugador 3" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Convocados (9)" })).toHaveAttribute("aria-pressed", "true");
  });
  it("ofrece F10 y exige exactamente 20 convocados", async () => {
    const user = userEvent.setup();
    const players = buildPlayers(21);
    render(<NewMatchForm defaultScheduledDate={DEFAULT_SCHEDULED_DATE} organizationId="org-1" players={players}
      initialValues={{ modality: "10v10", playerIds: players.slice(0, 19).map((player) => player.id), goalkeeperPlayerIds: [], guests: [] }} />);
    expect(screen.getByRole("option", { name: "10 vs 10 (20 jugadores)" })).toBeInTheDocument();
    expect(screen.getByLabelText("Modalidad")).toHaveValue("10v10");
    const submit = screen.getByRole("button", { name: "Crear partido y generar equipos" });
    expect(submit).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Falta 1 convocado");
    await user.click(screen.getByRole("checkbox", { name: "Juega Jugador 20" }));
    expect(submit).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("Convocatoria completa: 20 de 20");
    await user.click(screen.getByRole("checkbox", { name: "Juega Jugador 21" }));
    expect(submit).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Sobra 1 convocado");
  });
  it("habilita la generación automática sólo con la cantidad exacta y cero o dos arqueros", async () => {
    const user = userEvent.setup();
    const players = buildPlayers(11);
    render(<NewMatchForm defaultScheduledDate={DEFAULT_SCHEDULED_DATE} organizationId="org-1" players={players}
      initialValues={{ modality: "5v5", playerIds: players.slice(0, 9).map((player) => player.id), goalkeeperPlayerIds: [], guests: [] }} />);
    const submit = screen.getByRole("button", { name: "Crear partido y generar equipos" });

    expect(submit).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Falta 1 convocado");
    await user.click(screen.getByRole("checkbox", { name: "Juega Jugador 10" }));
    expect(submit).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("Convocatoria completa: 10 de 10");

    await user.click(screen.getByRole("checkbox", { name: "Arquero Jugador 1" }));
    expect(submit).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Elegiste un arquero");
    await user.click(screen.getByRole("checkbox", { name: "Arquero Jugador 2" }));
    expect(submit).toBeEnabled();

    await user.click(screen.getByRole("checkbox", { name: "Juega Jugador 11" }));
    expect(submit).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Sobra 1 convocado");
  });

  it("conserva el invitado incompleto, enfoca el nivel y permite corregirlo antes de crear", async () => {
    const user = userEvent.setup();
    const createAction = vi.mocked(createMatchFormAction);
    createAction.mockClear();
    const players = buildPlayers(10);
    render(<NewMatchForm defaultScheduledDate={DEFAULT_SCHEDULED_DATE} organizationId="org-1" players={players}
      initialValues={{ modality: "5v5", scheduledTime: "21:00", playerIds: players.map((player) => player.id), goalkeeperPlayerIds: [], guests: [] }} />);

    await user.click(screen.getByRole("button", { name: "Agregar invitado" }));
    await user.type(screen.getByRole("textbox", { name: "Nombre del invitado 1" }), "Refuerzo");
    await user.click(screen.getByRole("button", { name: "Crear partido y generar equipos" }));

    expect(createAction).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Completá el nombre y el nivel del invitado 1");
    expect(screen.getByRole("combobox", { name: "Nivel de Refuerzo" })).toHaveFocus();
    expect(screen.getByRole("combobox", { name: "Nivel de Refuerzo" })).toHaveAttribute("aria-invalid", "true");

    await user.selectOptions(screen.getByRole("combobox", { name: "Nivel de Refuerzo" }), "2");
    await user.click(screen.getByRole("checkbox", { name: "Juega Jugador 10" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Crear partido y generar equipos" }));
    await waitFor(() => expect(createAction).toHaveBeenCalledOnce());
    const formData = createAction.mock.calls[0][0];
    expect(formData.getAll("guestNames")).toEqual(["Refuerzo"]);
    expect(formData.getAll("guestRatings")).toEqual(["2"]);
    expect(formData.getAll("playerIds")).toHaveLength(9);
  });

  it("distingue convocar de marcar arquero con etiquetas propias", async () => {
    const user = userEvent.setup();
    render(<NewMatchForm defaultScheduledDate={DEFAULT_SCHEDULED_DATE} organizationId="org-1" players={buildPlayers(10)} />);
    const plays = screen.getByRole("checkbox", { name: "Juega Jugador 1" });
    await user.click(plays);
    const goalkeeper = screen.getByRole("checkbox", { name: "Arquero Jugador 1" });
    await user.click(goalkeeper);
    expect(plays).toBeChecked();
    expect(goalkeeper).toBeChecked();
    await user.click(goalkeeper);
    expect(plays).toBeChecked();
    expect(goalkeeper).not.toBeChecked();
  });
  it("precarga el partido anterior y permite revisar la nueva fecha", () => {
    const players = buildPlayers(10);
    const { container } = render(<NewMatchForm defaultScheduledDate="2026-09-20" organizationId="org-1" players={players}
      initialValues={{ modality: "5v5", location: "Cancha del barrio", scheduledTime: "21:30", playerIds: players.map((p) => p.id), goalkeeperPlayerIds: ["player-1", "player-10"], guests: [] }} />);
    expect(screen.getByLabelText("Modalidad")).toHaveValue("5v5");
    expect(screen.getByLabelText("Ubicacion")).toHaveValue("Cancha del barrio");
    expect(screen.getByLabelText("Hora")).toHaveValue("21:30");
    expect(screen.getByLabelText("Fecha")).toHaveValue("2026-09-20");
    expect(getCheckbox(container, "playerIds", "player-10")).toBeChecked();
    expect(getCheckbox(container, "goalkeeperPlayerIds", "player-1")).toBeChecked();
  });
  it("respeta la modalidad elegida durante el alta", () => {
    render(<NewMatchForm defaultScheduledDate={DEFAULT_SCHEDULED_DATE} defaultModality="7v7" organizationId="org-1" players={buildPlayers(14)} />);
    expect(screen.getByLabelText("Modalidad")).toHaveValue("7v7");
  });

  it("muestra nombres de equipos solo cuando se arma el partido manual", async () => {
    const user = userEvent.setup();
    render(
      <NewMatchForm defaultScheduledDate={DEFAULT_SCHEDULED_DATE} organizationId="org-1" players={buildPlayers(10)} />
    );

    expect(screen.queryByLabelText("Nombre del primer equipo")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Nombre del segundo equipo")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Armar equipos yo mismo" }));

    expect(screen.getByLabelText("Nombre del primer equipo")).toHaveAttribute("name", "teamALabel");
    expect(screen.getByLabelText("Nombre del segundo equipo")).toHaveAttribute("name", "teamBLabel");
    expect(screen.getByPlaceholderText("Negro")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Blanco")).toBeInTheDocument();
  });

  it("muestra nivel cargado y solo destaca rendimiento alto o bajo al seleccionar convocados", () => {
    render(
      <NewMatchForm
        defaultScheduledDate={DEFAULT_SCHEDULED_DATE}
        organizationId="org-1"
        players={[
          {
            id: "player-high",
            full_name: "Jugador Alto",
            current_rating: 1050,
            initial_rank: 1,
            skill_level: 2,
            display_order: 1
          },
          {
            id: "player-even",
            full_name: "Jugador Parejo",
            current_rating: 1000,
            initial_rank: 2,
            skill_level: 4,
            display_order: 2
          },
          {
            id: "player-low",
            full_name: "Jugador Bajo",
            current_rating: 950,
            initial_rank: 3,
            skill_level: 6,
            display_order: 3
          }
        ]}
      />
    );

    expect(screen.getByText("Nivel 2 - Figura")).toBeInTheDocument();
    expect(screen.getByText("Nivel 4 - Bueno")).toBeInTheDocument();
    expect(screen.getByText("Nivel 6 - Recreativo")).toBeInTheDocument();
    expect(screen.getByText("+ Viene bien")).toBeInTheDocument();
    expect(screen.queryByText("Parejo")).not.toBeInTheDocument();
    expect(screen.getByText("- Viene mal")).toBeInTheDocument();
    expect(screen.queryByText("1050")).not.toBeInTheDocument();
    expect(screen.queryByText("1000")).not.toBeInTheDocument();
    expect(screen.queryByText("950")).not.toBeInTheDocument();
  });

  it("arma un payload manual valido cuando el roster esta completo", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <NewMatchForm defaultScheduledDate={DEFAULT_SCHEDULED_DATE} organizationId="org-1" players={buildPlayers(10)} />
    );

    await user.selectOptions(screen.getByLabelText("Modalidad"), "5v5");

    for (let index = 1; index <= 10; index += 1) {
      await user.click(getCheckbox(container, "playerIds", `player-${index}`));
    }

    await user.click(getCheckbox(container, "goalkeeperPlayerIds", "player-1"));
    await user.click(getCheckbox(container, "goalkeeperPlayerIds", "player-6"));
    await user.click(screen.getByRole("button", { name: "Armar equipos yo mismo" }));

    const manualButton = screen.getByRole("button", {
      name: "Crear partido con equipos manuales"
    });
    expect(manualButton).toBeEnabled();

    const payloadInput = container.querySelector(
      'input[name="manualAssignmentsPayload"]'
    ) as HTMLInputElement;
    const payload = JSON.parse(payloadInput.value) as Array<{
      participantId: string;
      team: "A" | "B";
    }>;

    expect(payload).toHaveLength(10);
    expect(payload.find((item) => item.participantId === "player:player-1")?.team).toBe("A");
    expect(payload.find((item) => item.participantId === "player:player-6")?.team).toBe("B");
  });

  it("bloquea el submit manual si faltan jugadores", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <NewMatchForm defaultScheduledDate={DEFAULT_SCHEDULED_DATE} organizationId="org-1" players={buildPlayers(10)} />
    );

    await user.selectOptions(screen.getByLabelText("Modalidad"), "5v5");

    for (let index = 1; index <= 9; index += 1) {
      await user.click(getCheckbox(container, "playerIds", `player-${index}`));
    }

    await user.click(screen.getByRole("button", { name: "Armar equipos yo mismo" }));

    expect(
      screen.getByText("Para crear el partido manual debes completar exactamente 10 convocados.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Crear partido con equipos manuales" })
    ).toBeDisabled();
  });

  it("aclara la escala especial para invitados temporales", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <NewMatchForm defaultScheduledDate={DEFAULT_SCHEDULED_DATE} organizationId="org-1" players={buildPlayers(10)} />
    );

    await user.click(screen.getByRole("button", { name: "Agregar invitado" }));

    expect(screen.getByText(/Invitado superior: mejor que Estrella/)).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Invitado superior - mejor que Estrella" })
    ).toHaveValue("0.5");

    await user.type(screen.getByPlaceholderText("Nombre invitado #1"), "Crack");
    await user.selectOptions(screen.getByLabelText("Nivel de Crack"), "0.5");

    const ratingSelect = container.querySelector('select[name="guestRatings"]') as HTMLSelectElement;
    expect(ratingSelect.value).toBe("0.5");
  });

  it("bloquea el submit manual si los arqueros quedan en el mismo equipo", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <NewMatchForm defaultScheduledDate={DEFAULT_SCHEDULED_DATE} organizationId="org-1" players={buildPlayers(10)} />
    );

    await user.selectOptions(screen.getByLabelText("Modalidad"), "5v5");

    for (let index = 1; index <= 10; index += 1) {
      await user.click(getCheckbox(container, "playerIds", `player-${index}`));
    }

    await user.click(getCheckbox(container, "goalkeeperPlayerIds", "player-1"));
    await user.click(getCheckbox(container, "goalkeeperPlayerIds", "player-2"));
    await user.click(screen.getByRole("button", { name: "Armar equipos yo mismo" }));

    await user.selectOptions(screen.getByLabelText("Equipo de Jugador 2"), "A");

    expect(screen.getByText("Los dos arqueros deben quedar en equipos separados.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Crear partido con equipos manuales" })
    ).toBeDisabled();
  });
});
