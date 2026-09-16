import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OrganizationPublicNav } from "@/components/layout/organization-public-nav";

describe("OrganizationPublicNav", () => {
  it("conserva el grupo seleccionado en los accesos publicos", () => {
    render(<OrganizationPublicNav organizationKey="grupo-a" />);

    expect(screen.getByRole("link", { name: "Grupo" })).toHaveAttribute("href", "/groups?org=grupo-a");
    expect(screen.getByRole("link", { name: "Ranking" })).toHaveAttribute("href", "/ranking?org=grupo-a");
    expect(screen.getByRole("link", { name: "Historial" })).toHaveAttribute("href", "/matches?org=grupo-a");
    expect(screen.getByRole("link", { name: "Próximos" })).toHaveAttribute("href", "/upcoming?org=grupo-a");
  });

  it("marca como activa la seccion actual", () => {
    render(<OrganizationPublicNav currentPath="/matches" organizationKey="grupo-a" />);

    expect(screen.getByRole("link", { name: "Historial" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Ranking" })).not.toHaveAttribute("aria-current");
  });

  it("conserva el período al navegar y no confunde historial con próximos", () => {
    render(<OrganizationPublicNav currentPath="/matches/partido-a" organizationKey="grupo-a" season="all" />);

    expect(screen.getByRole("link", { name: "Ranking" })).toHaveAttribute("href", "/ranking?season=all&org=grupo-a");
    expect(screen.getByRole("link", { name: "Historial" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Próximos" })).not.toHaveAttribute("aria-current");
  });
});
