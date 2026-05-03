import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GroupActivityValueCard } from "@/components/admin/group-activity-value-card";

vi.mock("@vercel/analytics", () => ({
  track: vi.fn()
}));

describe("GroupActivityValueCard", () => {
  it("muestra actividad acumulada sin CTA de pago", () => {
    render(
      <GroupActivityValueCard
        finishedCount={3}
        organizationSlug="la-cantera"
        playersCount={16}
        totalMatches={5}
      />
    );

    expect(screen.getByText("Tu grupo ya tiene valor acumulado")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Activar plan/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/trial|prueba|plan mensual|pago/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Crear proximo partido" })).toHaveAttribute(
      "href",
      "/admin/matches/new?org=la-cantera"
    );
    expect(screen.getByRole("link", { name: "Ir a jugadores" })).toHaveAttribute(
      "href",
      "/admin/players?org=la-cantera"
    );
  });
});
