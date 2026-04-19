import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/admin/(panel)/matches/new/actions", () => ({
  createMatchAction: vi.fn()
}));

import { NewMatchForm } from "@/components/admin/new-match-form";

function buildPlayers(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `player-${index + 1}`,
    full_name: `Jugador ${index + 1}`,
    current_rating: 1000 - index * 10,
    initial_rank: index + 1
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
  it("arma un payload manual valido cuando el roster esta completo", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <NewMatchForm organizationId="org-1" players={buildPlayers(10)} />
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
      <NewMatchForm organizationId="org-1" players={buildPlayers(10)} />
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

  it("bloquea el submit manual si los arqueros quedan en el mismo equipo", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <NewMatchForm organizationId="org-1" players={buildPlayers(10)} />
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
