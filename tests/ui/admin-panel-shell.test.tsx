import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPanelShell } from "@/components/admin/admin-panel-shell";

const route = vi.hoisted(() => ({ pathname: "/admin", search: "" }));
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useSearchParams: () => new URLSearchParams(route.search)
}));

const admin = { userId: "admin-1", displayName: "Ana", email: "ana@example.test", isSuperAdmin: true };

describe("contexto de la cuenta en el panel", () => {
  beforeEach(() => { route.pathname = "/admin"; route.search = ""; });

  it.each(["/admin", "/admin/players"])("evita duplicar el encabezado de cuenta dentro del grupo en %s", (pathname) => {
    route.pathname = pathname;
    route.search = "org=viernes";
    render(<AdminPanelShell admin={admin}><p>Contenido del grupo</p></AdminPanelShell>);

    expect(screen.queryByRole("region", { name: "Cuenta de administrador" })).not.toBeInTheDocument();
    expect(screen.getByText("Contenido del grupo")).toBeVisible();
  });

  it.each([
    { pathname: "/admin", search: "" },
    { pathname: "/admin/super", search: "org=viernes" }
  ])("mantiene el acceso a seguridad fuera del contexto de grupo: $pathname", ({ pathname, search }) => {
    route.pathname = pathname;
    route.search = search;
    render(<AdminPanelShell admin={admin}><p>Contenido del panel</p></AdminPanelShell>);

    expect(screen.getByRole("region", { name: "Cuenta de administrador" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Seguridad de la cuenta" })).toHaveAttribute("href", "/admin/security");
    expect(screen.getByText("Contenido del panel")).toBeVisible();
  });
});
