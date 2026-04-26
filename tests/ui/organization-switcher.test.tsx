import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OrganizationSwitcher } from "@/components/layout/organization-switcher";

describe("OrganizationSwitcher", () => {
  it("no repite en el buscador los grupos que ya muestra como propios", () => {
    render(
      <OrganizationSwitcher
        basePath="/groups"
        currentOrganizationSlug="grupo-a"
        organizations={[
          { id: "org-a", name: "Grupo A", slug: "grupo-a" },
          { id: "org-b", name: "Grupo B", slug: "grupo-b" },
          { id: "org-c", name: "Grupo C", slug: "grupo-c" }
        ]}
        quickOrganizations={[
          { id: "org-a", name: "Grupo A", slug: "grupo-a" },
          { id: "org-b", name: "Grupo B", slug: "grupo-b" }
        ]}
      />
    );

    expect(screen.getByText("Mis grupos")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Grupo A" })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "Grupo B" })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "Grupo C" })).toHaveLength(1);
  });

  it("muestra un estado vacio cuando todos los grupos publicos ya son propios", () => {
    render(
      <OrganizationSwitcher
        basePath="/groups"
        organizations={[
          { id: "org-a", name: "Grupo A", slug: "grupo-a" },
          { id: "org-b", name: "Grupo B", slug: "grupo-b" }
        ]}
        quickOrganizations={[
          { id: "org-a", name: "Grupo A", slug: "grupo-a" },
          { id: "org-b", name: "Grupo B", slug: "grupo-b" }
        ]}
      />
    );

    expect(screen.getByText("No hay otros grupos publicos por ahora.")).toBeInTheDocument();
  });
});
