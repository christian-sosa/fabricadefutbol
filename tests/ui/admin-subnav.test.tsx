import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminSubnav } from "@/components/admin/admin-subnav";

const navigationState = vi.hoisted(() => ({
  pathname: "/admin",
  searchParams: new URLSearchParams()
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
  useSearchParams: () => navigationState.searchParams
}));

describe("AdminSubnav", () => {
  beforeEach(() => {
    navigationState.pathname = "/admin";
    navigationState.searchParams = new URLSearchParams();
  });

  it("no muestra subpanel de contexto en la entrada general de admin", () => {
    const { container } = render(<AdminSubnav />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Contexto grupos")).not.toBeInTheDocument();
    expect(screen.queryByText("Grupo actual")).not.toBeInTheDocument();
  });

  it("muestra navegacion de grupo sin repetir el encabezado de grupo actual", () => {
    navigationState.searchParams = new URLSearchParams({ org: "grupo-a" });

    render(<AdminSubnav />);

    expect(screen.queryByText("Grupo actual")).not.toBeInTheDocument();
    expect(screen.queryByText("Contexto grupos")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Jugadores" })).toHaveAttribute(
      "href",
      "/admin/players?org=grupo-a"
    );
  });

  it("muestra navegacion de liga dentro de una liga seleccionada", () => {
    navigationState.pathname = "/admin/tournaments/league-1";

    render(<AdminSubnav />);

    expect(screen.getByText("Liga actual")).toBeInTheDocument();
    expect(screen.queryByText("Contexto torneos")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Competencias" })).toHaveAttribute(
      "href",
      "/admin/tournaments/league-1?tab=competitions"
    );
  });
});
