import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AdminGroupDirectory } from "@/components/admin/admin-group-directory";

const organizations = [
  { id: "group-1", name: "Fútbol del sábado", slug: "sabado", is_public: true },
  { id: "group-2", name: "Los miércoles", slug: "los-miercoles", is_public: false }
];

describe("directorio de administración", () => {
  it("permite encontrar un grupo sin tildes y conserva su contexto al entrar", async () => {
    const user = userEvent.setup();
    render(<AdminGroupDirectory organizations={organizations} />);

    await user.type(screen.getByRole("searchbox", { name: "Buscar entre tus grupos" }), "futbol");

    expect(screen.getByRole("link", { name: "Administrar Fútbol del sábado" })).toHaveAttribute("href", "/admin?org=sabado");
    expect(screen.queryByRole("link", { name: "Administrar Los miércoles" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1 de 2 grupos");
    await user.click(screen.getByRole("button", { name: "Limpiar" }));
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.getByText("Privado")).toBeInTheDocument();
  });

  it("busca por identificador y permite recuperarse cuando no hay coincidencias", async () => {
    const user = userEvent.setup();
    render(<AdminGroupDirectory organizations={organizations} />);
    const search = screen.getByRole("searchbox");
    await user.type(search, "los-miercoles");
    expect(screen.getByRole("link", { name: "Administrar Los miércoles" })).toHaveAttribute("href", "/admin?org=los-miercoles");
    await user.clear(search);
    await user.type(search, "inexistente");
    expect(screen.getByText("No encontramos ese grupo")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Limpiar" }));
    expect(search).toHaveValue("");
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});
