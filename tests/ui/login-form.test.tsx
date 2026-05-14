import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/admin/(auth)/login/actions", () => ({
  loginWithGoogleAction: vi.fn(),
  loginAdminAction: vi.fn(),
  registerAdminAction: vi.fn()
}));

import { LoginForm } from "@/app/admin/(auth)/login/login-form";

describe("LoginForm", () => {
  it("prioriza Google y conserva el destino seguro en el ingreso", () => {
    render(<LoginForm nextPath="/admin/clubs" />);

    expect(screen.getByRole("heading", { name: "Entrar al panel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar con Google" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.queryByLabelText("Nombre")).not.toBeInTheDocument();

    const nextInputs = screen.getAllByDisplayValue("/admin/clubs");
    expect(nextInputs).toHaveLength(2);
    for (const input of nextInputs) {
      expect(input).toHaveAttribute("name", "next");
      expect(input).toHaveAttribute("type", "hidden");
    }
  });

  it("muestra el registro solo cuando el usuario lo pide", async () => {
    const user = userEvent.setup();
    render(<LoginForm nextPath="/admin/clubs" />);

    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(screen.getByRole("heading", { name: "Crear cuenta" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirmar contrase\u00f1a")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ingresar con email" })).not.toBeInTheDocument();

    const nextInputs = screen.getAllByDisplayValue("/admin/clubs");
    expect(nextInputs).toHaveLength(2);
  });
});
