import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminCurrentGroupCard } from "@/components/admin/admin-current-group-card";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useSearchParams: () => new URLSearchParams("org=la-banda"),
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn()
  })
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      signOut: vi.fn()
    }
  })
}));

describe("AdminCurrentGroupCard", () => {
  const admin = {
    userId: "admin-1",
    displayName: "Admin Demo",
    email: "admin@example.invalid",
    isSuperAdmin: true
  };

  it("unifica datos de admin, grupo actual y acciones de contexto", () => {
    render(
      <AdminCurrentGroupCard
        admin={admin}
        organization={{
          name: "La Banda",
          slug: "la-banda"
        }}
      />
    );

    expect(screen.getByText("Modo administrador / Admin Demo")).toBeInTheDocument();
    expect(screen.getByText("admin@example.invalid")).toBeInTheDocument();
    expect(screen.getByText("Grupo actual")).toBeInTheDocument();
    expect(screen.getByText("La Banda")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /La Banda/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Super Admin" })).toHaveAttribute("href", "/admin/super");
    expect(screen.getByRole("link", { name: "Cambiar espacio" })).toHaveAttribute("href", "/admin");
    expect(screen.queryByRole("button", { name: "Cerrar sesion" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Nuevo grupo" })).not.toBeInTheDocument();
  });
});
