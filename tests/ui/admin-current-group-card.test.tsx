import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminCurrentGroupCard } from "@/components/admin/admin-current-group-card";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useSearchParams: () => new URLSearchParams("org=la-banda")
}));

describe("AdminCurrentGroupCard", () => {
  it("no ofrece crear otro grupo desde el grupo actual", () => {
    render(
      <AdminCurrentGroupCard
        organization={{
          name: "La Banda",
          slug: "la-banda"
        }}
      />
    );

    expect(screen.getByRole("link", { name: "Cambiar espacio" })).toHaveAttribute("href", "/admin");
    expect(screen.queryByRole("link", { name: "Nuevo grupo" })).not.toBeInTheDocument();
  });
});
