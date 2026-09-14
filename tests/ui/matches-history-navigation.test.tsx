import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  const subscribe = (callback: () => void) => {
    window.addEventListener("popstate", callback);
    return () => window.removeEventListener("popstate", callback);
  };
  return { useSearchParams: () => new URLSearchParams(useSyncExternalStore(subscribe, () => window.location.search)) };
});

import { MatchesHistoryQueryTable } from "@/components/matches/matches-history-query-table";
import type { OrganizationMatchesResponse } from "@/lib/query/types";

function pageData(page: number): OrganizationMatchesResponse {
  return {
    organizationId: "group-1",
    matches: [{ id: `match-${page}`, scheduledAt: "2026-09-14T21:00:00Z", modality: "6v6", status: "finished", scoreA: page, scoreB: 0, winnerTeam: "A", mvpDisplayName: `Figura de página ${page}` }],
    pagination: { page, pageSize: 10, totalCount: 30, totalPages: 3, hasNextPage: page < 3, hasPreviousPage: page > 1 }
  };
}
const clients: QueryClient[] = [];
function mountHistory(initialPage = 1) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 600_000 } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}>
    <MatchesHistoryQueryTable organizationId="group-1" organizationSlug="la-banda" season="all" initialPage={initialPage} initialData={pageData(initialPage)} />
  </QueryClientProvider>);
}

beforeEach(() => {
  window.history.replaceState(null, "", "/matches?org=la-banda&season=all");
  const nativePush = window.history.pushState.bind(window.history);
  vi.spyOn(window.history, "pushState").mockImplementation((state, title, url) => {
    nativePush(state, title, url);
    // Next's patched History API publishes this URL change to useSearchParams.
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
});
afterEach(() => { clients.forEach((client) => client.clear()); clients.length = 0; });

describe("history navigation", () => {
  it("retries the requested page after failure, without showing page one as its result or skipping to page three", async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({ error: "Sin conexión" }, { status: 503 }))
      .mockResolvedValueOnce(Response.json(pageData(2)));
    vi.stubGlobal("fetch", fetcher);
    mountHistory();
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await screen.findByRole("alert");
    expect(window.location.search).toBe("?org=la-banda&season=all&page=2");
    expect(screen.getByText("Página 2")).toBeInTheDocument();
    expect(screen.queryAllByText("MVP: Figura de página 1")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByText("Página 2 de 3 · 30 partidos");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.every(([url]) => String(url).includes("page=2&"))).toBe(true);
    expect(screen.getAllByRole("link", { name: "Ver detalle" })[0]).toHaveAttribute("href", "/matches/match-2?org=la-banda&season=all&page=2");
  });

  it("restores the page when navigating Back and Forward", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(pageData(2))));
    mountHistory();
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await screen.findByText("Página 2 de 3 · 30 partidos");
    act(() => { window.history.back(); });
    await screen.findByText("Página 1 de 3 · 30 partidos");
    expect(window.location.search).toBe("?org=la-banda&season=all");
    act(() => { window.history.forward(); });
    await screen.findByText("Página 2 de 3 · 30 partidos");
  });

  it("honors the URL and server data on a fresh page-two mount", () => {
    window.history.replaceState(null, "", "/matches?org=la-banda&season=all&page=2");
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    mountHistory(2);
    expect(screen.getByText("Página 2 de 3 · 30 partidos")).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns from a failed page to the previous cached page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network failed")));
    mountHistory();
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await screen.findByRole("alert");
    await userEvent.click(screen.getByRole("button", { name: "Anterior" }));
    await waitFor(() => expect(screen.getByText("Página 1 de 3 · 30 partidos")).toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("explains an unavailable page and returns directly to the first page", async () => {
    window.history.replaceState(null, "", "/matches?org=la-banda&season=all&page=99999");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(pageData(1))));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    clients.push(client);
    const emptyPage = { ...pageData(99999), matches: [], pagination: { ...pageData(99999).pagination, totalCount: 2, totalPages: 1, hasNextPage: false } };
    render(<QueryClientProvider client={client}>
      <MatchesHistoryQueryTable organizationId="group-1" organizationSlug="la-banda" season="all" initialPage={99999} initialData={emptyPage} />
    </QueryClientProvider>);
    expect(screen.getByText("Página 99999 · 2 partidos")).toBeInTheDocument();
    expect(screen.getAllByText("No hay partidos en esta página.")).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: "Volver al inicio del historial" }));
    await screen.findByText("Página 1 de 3 · 30 partidos");
    expect(window.location.search).toBe("?org=la-banda&season=all");
  });
});
