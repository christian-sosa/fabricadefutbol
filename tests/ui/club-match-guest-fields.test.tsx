import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { MatchGuestFields } from "@/app/admin/(panel)/clubs/[clubId]/match-guest-fields";

describe("MatchGuestFields", () => {
  it("no muestra slots de invitados hasta tocar agregar", async () => {
    const user = userEvent.setup();
    render(<MatchGuestFields />);

    expect(screen.queryByPlaceholderText("Nombre")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Agregar invitado" }));

    expect(screen.getByPlaceholderText("Nombre")).toBeInTheDocument();
  });

  it("permite cargar pago de cancha para invitados", async () => {
    const user = userEvent.setup();
    render(<MatchGuestFields />);

    await user.click(screen.getByRole("button", { name: "Agregar invitado" }));

    expect(screen.getByLabelText("Pago cancha invitado 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Monto pagado invitado 1")).toBeInTheDocument();
  });
});
