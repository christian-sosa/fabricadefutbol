import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MatchTeamLabelsShareForm } from "@/components/admin/match-team-labels-share-form";

vi.mock("@/lib/analytics/client", () => ({ trackAnalyticsEvent: vi.fn() }));

const matchUrl = "https://fabricadefutbol.com.ar/matches/match-1?org=viernes";

describe("nombres guardados al compartir", () => {
  it("bloquea edición y WhatsApp mientras guarda aunque los nombres coincidan con las props", async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    let finishSaving!: () => void;
    const saving = new Promise<void>((resolve) => { finishSaving = resolve; });
    const action = vi.fn(() => saving);
    const view = render(<MatchTeamLabelsShareForm action={action} canShare initialTeamALabel="Negro" initialTeamBLabel="Blanco" matchUrl={matchUrl} />);
    const name = screen.getByLabelText("Nombre del primer equipo");
    await user.clear(name);
    await user.type(name, "Rojos");
    await user.click(screen.getByRole("button", { name: "Guardar nombres" }));
    expect(action).toHaveBeenCalledOnce();
    expect(name).toBeDisabled();
    expect(screen.getByLabelText("Nombre del segundo equipo")).toBeDisabled();
    await user.type(name, "Negro");
    expect(name).toHaveValue("Rojos");
    // Even if refreshed props already match the edit, pending must independently block sharing.
    view.rerender(<MatchTeamLabelsShareForm action={action} canShare initialTeamALabel="Rojos" initialTeamBLabel="Blanco" matchUrl={matchUrl} />);
    expect(screen.getByRole("button", { name: "Compartir en WhatsApp" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Compartir en WhatsApp" }));
    expect(open).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Guardando nombres");
    await act(async () => { finishSaving(); await saving; });
    expect(name).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Compartir en WhatsApp" }));
    expect(decodeURIComponent(String(open.mock.calls[0][0]))).toContain("Rojos vs Blanco");
  });
  it("comparte los nombres persistidos y bloquea WhatsApp hasta guardar cualquier cambio", async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(<MatchTeamLabelsShareForm action={vi.fn()} canShare initialTeamALabel="Negro" initialTeamBLabel="Blanco" matchUrl={matchUrl} />);
    await user.click(screen.getByRole("button", { name: "Compartir en WhatsApp" }));
    expect(open).toHaveBeenCalledOnce();
    expect(decodeURIComponent(String(open.mock.calls[0][0]))).toContain("Negro");
    await user.clear(screen.getByLabelText("Nombre del primer equipo"));
    await user.type(screen.getByLabelText("Nombre del primer equipo"), "Rojos");
    expect(screen.getByRole("button", { name: "Compartir en WhatsApp" })).toBeDisabled();
    expect(screen.getByText(/Tenés cambios sin guardar/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Compartir en WhatsApp" }));
    expect(open).toHaveBeenCalledOnce();
  });

  it("conserva el nombre editado y el bloqueo si falla el guardado", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockRejectedValue({ digest: "NEXT_REDIRECT;replace;/admin/matches/match-1?org=viernes&error=No%20se%20pudo%20guardar;307;" });
    render(<MatchTeamLabelsShareForm action={action} canShare initialTeamALabel="Negro" initialTeamBLabel="Blanco" matchUrl={matchUrl} />);
    await user.clear(screen.getByLabelText("Nombre del primer equipo"));
    await user.type(screen.getByLabelText("Nombre del primer equipo"), "Rojos");
    await user.click(screen.getByRole("button", { name: "Guardar nombres" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar");
    expect(screen.getByLabelText("Nombre del primer equipo")).toHaveValue("Rojos");
    expect(screen.getByRole("button", { name: "Compartir en WhatsApp" })).toBeDisabled();
  });

  it("habilita compartir cuando la respuesta de servidor trae los nombres guardados", async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const action = vi.fn();
    const view = render(<MatchTeamLabelsShareForm action={action} canShare initialTeamALabel="Negro" initialTeamBLabel="Blanco" matchUrl={matchUrl} />);
    await user.clear(screen.getByLabelText("Nombre del primer equipo"));
    await user.type(screen.getByLabelText("Nombre del primer equipo"), "Rojos");
    expect(screen.getByRole("button", { name: "Compartir en WhatsApp" })).toBeDisabled();
    view.rerender(<MatchTeamLabelsShareForm action={action} canShare initialTeamALabel="Rojos" initialTeamBLabel="Blanco" matchUrl={matchUrl} />);
    await user.click(screen.getByRole("button", { name: "Compartir en WhatsApp" }));
    expect(decodeURIComponent(String(open.mock.calls[0][0]))).toContain("Rojos vs Blanco");
  });
});
