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
        playersCount={16}
        totalMatches={5}
      />
    );

    expect(screen.getByText("Resumen del grupo")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Activar plan/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/trial|prueba|plan mensual|pago/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Grupos gratis")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ir a partidos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ir a jugadores" })).not.toBeInTheDocument();
  });
});
