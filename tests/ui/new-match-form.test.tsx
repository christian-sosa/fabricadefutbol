import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/admin/(panel)/matches/new/actions", () => ({
  createMatchAction: vi.fn()
}));

import { NewMatchForm } from "@/components/admin/new-match-form";

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
