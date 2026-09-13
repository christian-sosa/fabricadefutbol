import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminNav } from "@/components/admin/admin-nav";

const navigationState = vi.hoisted(() => ({
  pathname: "/admin",
  searchParams: new URLSearchParams()
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
  useSearchParams: () => navigationState.searchParams
}));

describe("AdminNav", () => {
  beforeEach(() => {
    navigationState.pathname = "/admin";
    navigationState.searchParams = new URLSearchParams();
  });

  it("muestra la navegacion de Grupos a admins comunes", () => {
    navigationState.searchParams = new URLSearchParams({ org: "grupo-a" });

    render(<AdminNav isSuperAdmin={false} />);

    expect(screen.getByRole("link", { name: "Grupos" })).toHaveAttribute(
      "href",
      "/admin?org=grupo-a"
    );
    expect(screen.queryByRole("link", { name: "Torneos" })).not.toBeInTheDocument();
  });

  it("muestra Grupos y metricas al super admin", () => {
    render(<AdminNav isSuperAdmin />);

    expect(screen.getByRole("link", { name: "Super Admin" })).toHaveAttribute("href", "/admin/super");
    expect(screen.queryByRole("link", { name: "Torneos" })).not.toBeInTheDocument();
  });
});
