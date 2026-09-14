import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ActionForm } from "@/components/ui/action-form";
import { FormSubmitButton } from "@/components/ui/form-submit-button";

describe("ActionForm", () => {
  it("bloquea envíos duplicados y conserva los datos cuando el servidor devuelve un error", async () => {
    let finish!: (value: { error: string | null }) => void;
    const action = vi.fn(() => new Promise<{ error: string | null }>((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    render(<ActionForm action={action}><input aria-label="Nombre" name="name" defaultValue="" /><FormSubmitButton pendingLabel="Guardando…">Guardar</FormSubmitButton></ActionForm>);
    await user.type(screen.getByRole("textbox", { name: "Nombre" }), "Los viernes");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(screen.getByRole("button", { name: "Guardando…" })).toBeDisabled();
    expect(action).toHaveBeenCalledOnce();
    await act(async () => finish({ error: "No se pudo guardar. Intentá de nuevo." }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveFocus());
    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveValue("Los viernes");
    expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled();
  });
  it("explica un fallo de red sin borrar lo escrito", async () => {
    render(<ActionForm action={async () => { throw new Error("network"); }}><input aria-label="Cancha" defaultValue="La esquina" /><FormSubmitButton>Guardar</FormSubmitButton></ActionForm>);
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("comprobá si se guardó");
    expect(screen.getByRole("textbox")).toHaveValue("La esquina");
  });
  it("incluye y conserva los controles externos de toda la planilla", async () => {
    const action = vi.fn<(data: FormData) => Promise<{ error: string }>>(async () => ({ error: "Reintentá el guardado" }));
    render(<><ActionForm action={action} id="roster"><FormSubmitButton>Guardar planilla</FormSubmitButton></ActionForm><input aria-label="Nombre uno" defaultValue="" name="fullName" form="roster" /><input aria-label="Nombre dos" defaultValue="" name="fullName" form="roster" /></>);
    await userEvent.type(screen.getByRole("textbox", { name: "Nombre uno" }), "Ana");
    await userEvent.type(screen.getByRole("textbox", { name: "Nombre dos" }), "Luz");
    await userEvent.click(screen.getByRole("button", { name: "Guardar planilla" }));
    await screen.findByRole("alert");
    expect(action.mock.calls[0][0].getAll("fullName")).toEqual(["Ana", "Luz"]);
    expect(screen.getByRole("textbox", { name: "Nombre uno" })).toHaveValue("Ana");
    expect(screen.getByRole("textbox", { name: "Nombre dos" })).toHaveValue("Luz");
  });
});
