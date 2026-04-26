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

  it("mantiene el grupo solo en la navegacion de Grupos", () => {
    navigationState.searchParams = new URLSearchParams({ org: "grupo-a" });

    render(<AdminNav isSuperAdmin={false} />);

    expect(screen.getByRole("link", { name: "Grupos" })).toHaveAttribute(
      "href",
      "/admin?org=grupo-a"
    );
    expect(screen.getByRole("link", { name: "Torneos" })).toHaveAttribute(
      "href",
      "/admin/tournaments"
    );
  });
});
