import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { refresh, router } = vi.hoisted(() => {
  const refresh = vi.fn();
  return { refresh, router: { refresh } };
});
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { SeasonClosingCountdown } from "@/components/groups/season-closing-countdown";

describe("cuenta regresiva de temporada", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-06T15:00:00Z"));
    refresh.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("muestra días y una estimación semanal sin pedir datos cada minuto", () => {
    render(<SeasonClosingCountdown initialNow={new Date().toISOString()} />);

    expect(screen.getByText("Recta final · Temporada 2026")).toBeVisible();
    expect(screen.getByText(/^Faltan/)).toHaveTextContent("Faltan 56 días");
    expect(screen.getByText("unos 8 partidos más")).toBeVisible();
    expect(screen.getByText(/Estimación orientativa/)).toBeVisible();
    act(() => vi.advanceTimersByTime(120_000));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("actualiza días y ranking cuando vuelve a una pestaña al día siguiente", () => {
    render(<SeasonClosingCountdown initialNow={new Date().toISOString()} />);
    vi.setSystemTime(new Date("2026-11-07T15:00:00Z"));
    fireEvent(document, new Event("visibilitychange"));

    expect(screen.getByText(/^Faltan/)).toHaveTextContent("Faltan 55 días");
    expect(refresh).toHaveBeenCalledTimes(1);
    fireEvent(document, new Event("visibilitychange"));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("retira la recta final y refresca el ranking al empezar un nuevo año en Buenos Aires", () => {
    vi.setSystemTime(new Date("2027-01-01T02:59:00Z"));
    render(<SeasonClosingCountdown initialNow={new Date().toISOString()} />);
    expect(screen.getByText("Hoy cierra la temporada")).toBeVisible();
    expect(screen.getByText(/todavía puede entrar un último partido/)).toBeVisible();

    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.queryByText(/Recta final/)).not.toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("activa el contador al comenzar octubre sin recargar manualmente", () => {
    vi.setSystemTime(new Date("2026-10-01T02:59:00Z"));
    render(<SeasonClosingCountdown initialNow={new Date().toISOString()} />);
    expect(screen.queryByText(/Recta final/)).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByText("Recta final · Temporada 2026")).toBeVisible();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
