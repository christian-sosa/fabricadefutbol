import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/admin/(auth)/login/actions", () => ({
  loginWithGoogleAction: vi.fn(),
  loginAdminAction: vi.fn(),
  registerAdminAction: vi.fn()
}));

import { LoginForm } from "@/app/admin/(auth)/login/login-form";

describe("LoginForm", () => {
  it("muestra el ingreso con Google y conserva el destino seguro", () => {
    render(<LoginForm nextPath="/admin/clubs" />);

    expect(screen.getByRole("button", { name: "Continuar con Google" })).toBeInTheDocument();

    const nextInputs = screen.getAllByDisplayValue("/admin/clubs");
    expect(nextInputs).toHaveLength(3);
    for (const input of nextInputs) {
      expect(input).toHaveAttribute("name", "next");
      expect(input).toHaveAttribute("type", "hidden");
    }
  });
});
