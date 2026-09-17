import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { MatchActivityCalendar } from "@/components/matches/match-activity-calendar";

const matches = [
  { id: "august", scheduledAt: "2026-08-31T21:00:00.000Z", modality: "6v6" },
  { id: "early", scheduledAt: "2026-09-07T00:30:00.000Z", modality: "5v5" },
  { id: "late", scheduledAt: "2026-09-07T21:00:00.000Z", modality: "6v6" },
  { id: "latest", scheduledAt: "2026-09-14T20:00:00.000Z", modality: "7v7" }
];

function mountCalendar(overrides: Partial<React.ComponentProps<typeof MatchActivityCalendar>> = {}) {
  render(<MatchActivityCalendar matches={matches} organizationSlug="la-banda" season="all" today="2026-09-17" historyPage={3} {...overrides} />);
}

function metric(label: string) {
  const term = screen.getByText(label, { selector: "dt" });
  return within(term.parentElement!).getByRole("definition");
}

describe("MatchActivityCalendar", () => {
  it("navega meses dentro del período y permite saltar directamente a un mes", async () => {
    const user = userEvent.setup();
    mountCalendar();

    expect(screen.getByRole("table", { name: "septiembre de 2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mes siguiente" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Mes anterior" }));
    expect(screen.getByRole("table", { name: "agosto de 2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mes anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "31 de agosto de 2026: 1 partido" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("link", { name: /Ver partido/ })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Ir al mes"), { target: { value: "2026-09" } });
    expect(screen.getByRole("table", { name: "septiembre de 2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mes siguiente" })).toBeDisabled();
  });

  it("selecciona un día marcado y enlaza sus partidos con grupo, temporada, página y calendario", async () => {
    mountCalendar();
    await userEvent.click(screen.getByRole("button", { name: "7 de septiembre de 2026: 2 partidos" }));

    expect(screen.getByRole("button", { name: "7 de septiembre de 2026: 2 partidos" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "14 de septiembre de 2026: 1 partido" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("link", { name: /5v5.*00:30 hs.*Ver partido/ })).toHaveAttribute("href", "/matches/early?org=la-banda&season=all&page=3&view=calendar");
    expect(screen.getByRole("link", { name: /6v6.*21:00 hs.*Ver partido/ })).toHaveAttribute("href", "/matches/late?org=la-banda&season=all&page=3&view=calendar");
    expect(screen.getAllByRole("link", { name: /Ver partido/ })).toHaveLength(2);
  });

  it("actualiza calendario y estadísticas al acotar las fechas, incluido un solo día", () => {
    mountCalendar();
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-09-07" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-09-07" } });

    expect(metric("Partidos")).toHaveTextContent("2");
    expect(metric("Días con fútbol")).toHaveTextContent("1");
    expect(metric("Partidos por semana")).toHaveTextContent("—");
    expect(screen.getByText("El promedio semanal aparece al seleccionar al menos 7 días.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "14 de septiembre de 2026: 1 partido" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("explica fechas invertidas o futuras y recupera la vista al corregirlas", () => {
    mountCalendar();
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-09-18" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Desde debe ser anterior o igual a Hasta");
    expect(screen.getByLabelText("Desde")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-09-18" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Hasta no puede superar el 17 de septiembre de 2026");
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-09-17" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(metric("Partidos")).toHaveTextContent("3");
  });

  it("los atajos restauran el período y muestran un rango sin actividad sin inventar partidos", async () => {
    mountCalendar();
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-09-15" } });
    expect(metric("Partidos")).toHaveTextContent("0");
    expect(screen.getByText("No hubo partidos finalizados en este mes dentro del período.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Ver partido/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Últimos 30 días" }));
    expect(screen.getByLabelText("Desde")).toHaveValue("2026-08-19");
    expect(screen.getByLabelText("Hasta")).toHaveValue("2026-09-17");
    expect(metric("Partidos")).toHaveTextContent("4");
    await userEvent.click(screen.getByRole("button", { name: "Desde el primer partido" }));
    expect(screen.getByLabelText("Desde")).toHaveValue("2026-08-31");
  });

  it("limita una temporada cerrada a su fecha de cierre inclusive", async () => {
    mountCalendar({
      seasonEndsAt: "2025-12-31",
      matches: [
        { id: "first", scheduledAt: "2025-11-03T20:00:00.000Z", modality: "5v5" },
        { id: "last", scheduledAt: "2025-12-31T00:30:00.000Z", modality: "5v5" }
      ]
    });

    expect(screen.getByLabelText("Hasta")).toHaveValue("2025-12-31");
    expect(screen.getByLabelText("Hasta")).toHaveAttribute("max", "2025-12-31");
    expect(screen.getByLabelText("Ir al mes")).toHaveAttribute("max", "2025-12");
    expect(screen.getByRole("button", { name: "31 de diciembre de 2025: 1 partido" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mes siguiente" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Últimos 30 días" }));
    expect(screen.getByLabelText("Desde")).toHaveValue("2025-12-02");
    expect(screen.getByLabelText("Hasta")).toHaveValue("2025-12-31");
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-01-01" } });
    expect(screen.getByRole("alert")).toHaveTextContent("31 de diciembre de 2025");
  });

  it("explica el estado vacío cuando todavía no hay partidos finalizados", () => {
    mountCalendar({ matches: [] });
    expect(screen.getByText("El calendario espera el primer partido")).toBeInTheDocument();
    expect(screen.queryByLabelText("Desde")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("no calcula períodos anteriores a la temporada y acota el atajo de 30 días a su inicio", async () => {
    mountCalendar({ matches: matches.slice(1), season: "00000000-0000-4000-8000-000000000001", seasonStartsAt: "2026-09-01" });
    expect(screen.getByLabelText("Desde")).toHaveAttribute("min", "2026-09-01");
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-08-31" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Para ampliar el período, elegí Histórico.");
    expect(screen.queryByText("Partidos por semana", { selector: "dt" })).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Últimos 30 días" }));
    expect(screen.getByLabelText("Desde")).toHaveValue("2026-09-01");
    expect(screen.getByLabelText("Hasta")).toHaveValue("2026-09-17");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(metric("Partidos")).toHaveTextContent("3");
  });
});
