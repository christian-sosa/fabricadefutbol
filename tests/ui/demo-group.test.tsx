import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DemoGroup } from "@/app/demo/demo-group";

describe("demo de Grupos", () => {
  it("permite probar otra opción y consultar el historial coherente con los jugadores", async () => {
    const user = userEvent.setup();
    render(<DemoGroup />);
    expect(screen.getAllByRole("listitem")).toHaveLength(12);
    await user.click(screen.getByRole("button", { name: "Ver otra opción de equipos" }));
    expect(screen.getByText(/Opción 2 de ejemplo/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ranking" }));
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows).toHaveLength(13);
    expect(within(rows[1]).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["Juan", "1010", "1", "1", "1", "0"]);
    expect(within(rows[2]).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["Nicolás", "1010", "0", "1", "1", "0"]);
    await user.click(screen.getByRole("button", { name: "Historial" }));
    expect(screen.getByText("Equipo A 3 — 2 Equipo B")).toBeInTheDocument();
    expect(screen.getByText("MVP: Juan")).toBeInTheDocument();
    expect(screen.getByText(/no suma puntos/)).toBeInTheDocument();
  });
});
