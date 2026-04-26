import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OrganizationPublicNav } from "@/components/layout/organization-public-nav";

describe("OrganizationPublicNav", () => {
  it("conserva el grupo seleccionado en los accesos publicos", () => {
    render(<OrganizationPublicNav organizationKey="grupo-a" />);

    expect(screen.getByRole("link", { name: "Ranking" })).toHaveAttribute("href", "/ranking?org=grupo-a");
    expect(screen.getByRole("link", { name: "Historial" })).toHaveAttribute("href", "/matches?org=grupo-a");
    expect(screen.getByRole("link", { name: "Proximos" })).toHaveAttribute("href", "/upcoming?org=grupo-a");
  });

  it("marca como activa la seccion actual", () => {
    render(<OrganizationPublicNav currentPath="/matches" organizationKey="grupo-a" />);

    expect(screen.getByRole("link", { name: "Historial" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Ranking" })).not.toHaveAttribute("aria-current");
  });
});
