import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminMatchOverview } from "@/components/admin/admin-match-overview";

describe("resumen operativo de partidos", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-25T18:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("ofrece cargar el resultado pendiente con el contexto correcto, sin reconfirmar finalizados", () => {
    render(<AdminMatchOverview canWrite organizationSlug="la-banda" matches={[
      { id: "finished", scheduled_at: "2026-09-20T12:00:00Z", modality: "9v9", status: "finished" },
      { id: "pending", scheduled_at: "2026-09-24T12:00:00Z", modality: "11v11", status: "confirmed" },
      { id: "future", scheduled_at: "2026-10-01T12:00:00Z", modality: "10v10", status: "confirmed" }
    ]} />);
    expect(screen.getByRole("link", { name: /Hay un resultado por cargar/ })).toHaveAttribute("href", "/admin/matches/pending/result?org=la-banda");
    expect(screen.getByRole("link", { name: /Finalizado/ })).toHaveAttribute("href", "/admin/matches/finished?org=la-banda");
    expect(screen.getByRole("link", { name: /Nuevo partido/ })).toHaveAttribute("href", "/admin/matches/new?org=la-banda");
  });

  it("mantiene accesos de consulta sin acciones de escritura para solo lectura", () => {
    render(<AdminMatchOverview canWrite={false} organizationSlug="la-banda" matches={[
      { id: "pending", scheduled_at: "2026-09-24T12:00:00Z", modality: "11v11", status: "confirmed" }
    ]} />);
    expect(screen.getByText("Solo lectura")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Nuevo partido|Cargar resultado/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver todos/ })).toHaveAttribute("href", "/admin/matches?org=la-banda");
  });
});
