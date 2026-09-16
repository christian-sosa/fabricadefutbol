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
  it("abre el alta desde un CTA de crear grupo y permite recuperar acceso", () => {
    const { unmount } = render(<LoginForm initialMode="register" />);
    expect(screen.getByRole("heading", { name: "Creá tu grupo gratis" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Pasos para crear tu grupo" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
    unmount();
    render(<LoginForm />);
    expect(screen.getByRole("link", { name: "Olvidé mi contraseña" })).toHaveAttribute("href", "/admin/forgot-password");
  });
  it("prioriza Google y conserva el destino seguro en el ingreso", () => {
    render(<LoginForm nextPath="/admin/players" />);

    expect(screen.getByRole("heading", { name: "Ingresar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar con Google" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.queryByLabelText("Nombre")).not.toBeInTheDocument();

    const nextInputs = screen.getAllByDisplayValue("/admin/players");
    expect(nextInputs).toHaveLength(2);
    for (const input of nextInputs) {
      expect(input).toHaveAttribute("name", "next");
      expect(input).toHaveAttribute("type", "hidden");
    }
  });

  it("muestra el registro solo cuando el usuario lo pide", async () => {
    const user = userEvent.setup();
    render(<LoginForm nextPath="/admin/players" />);

    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(screen.getByRole("heading", { name: "Crear cuenta" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirmar contrase\u00f1a")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ingresar con email" })).not.toBeInTheDocument();

    const nextInputs = screen.getAllByDisplayValue("/admin/players");
    expect(nextInputs).toHaveLength(2);
  });

  it("permite revisar la contraseña sin perderla ni enviar el formulario", async () => {
    const user = userEvent.setup();
    render(<LoginForm initialMode="register" />);
    const password = screen.getByLabelText("Contraseña", { exact: true });

    expect(password).toHaveAccessibleDescription("Usá al menos 6 caracteres.");
    await user.type(password, "clave-ejemplo");
    await user.click(screen.getByRole("button", { name: /^Mostrar contraseña$/ }));

    expect(password).toHaveAttribute("type", "text");
    expect(password).toHaveValue("clave-ejemplo");
    expect(screen.getByRole("button", { name: /^Ocultar contraseña$/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Confirmar contraseña")).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: /^Ocultar contraseña$/ }));
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveValue("clave-ejemplo");
  });

  it("conserva el destino de una invitación sin prometer la creación de otro grupo", () => {
    render(<LoginForm initialMode="register" nextPath="/invite/test-token" />);

    expect(screen.getByRole("heading", { name: "Crear cuenta" })).toBeInTheDocument();
    expect(screen.getByText("Creá tu cuenta para aceptar la invitación al grupo.")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Pasos para crear tu grupo" })).not.toBeInTheDocument();
    expect(screen.getAllByDisplayValue("/invite/test-token")).toHaveLength(2);
  });
});
