import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useOrganizationMatchesQuery, useOrganizationStandingsQuery } from "@/lib/query/hooks";
import { organizationQueryKeys } from "@/lib/query/keys";
import type { OrganizationMatchesResponse } from "@/lib/query/types";
import type { PlayerComputedStats } from "@/types/domain";

const clients: QueryClient[] = [];
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, refetchOnMount: false } } });
  clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}
const players = [{ playerId: "original", playerName: "Original" }] as PlayerComputedStats[];
const updatedPlayers = [{ playerId: "updated", playerName: "Actualizado" }] as PlayerComputedStats[];
function matches(organizationId = "group-1"): OrganizationMatchesResponse {
  return { organizationId, matches: [], pagination: { page: 1, pageSize: 10, totalCount: 20, totalPages: 2, hasNextPage: true, hasPreviousPage: false } };
}

afterEach(() => { clients.forEach((client) => client.clear()); clients.length = 0; onlineManager.setOnline(true); });

describe("public query lifecycle", () => {
  it("revalidates an old ranking on return even when the cache already has initial data", async () => {
    const { client, wrapper } = setup();
    client.setQueryData(organizationQueryKeys.standings("group-1"), players, { updatedAt: Date.now() - 120_000 });
    const fetcher = vi.fn().mockResolvedValue(Response.json({ standings: updatedPlayers }));
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => useOrganizationStandingsQuery({ organizationId: "group-1", initialData: players }), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(updatedPlayers));
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("keeps fresh data without an unnecessary mount request", () => {
    const { wrapper } = setup();
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => useOrganizationStandingsQuery({ organizationId: "group-1", initialData: players }), { wrapper });
    expect(result.current.data).toEqual(players);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("recovers an expired query when connection returns", async () => {
    const { client, wrapper } = setup();
    client.setQueryData(organizationQueryKeys.standings("group-1"), players, { updatedAt: Date.now() - 120_000 });
    onlineManager.setOnline(false);
    const fetcher = vi.fn().mockResolvedValue(Response.json({ standings: updatedPlayers })); vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => useOrganizationStandingsQuery({ organizationId: "group-1" }), { wrapper });
    expect(result.current.data).toEqual(players);
    expect(fetcher).not.toHaveBeenCalled();
    act(() => { onlineManager.setOnline(true); });
    await waitFor(() => expect(result.current.data).toEqual(updatedPlayers));
  });

  it.each(["group", "season"])("never presents another ranking after a %s change", (change) => {
    const { wrapper } = setup();
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const { result, rerender } = renderHook(({ organizationId, season, initialData }: { organizationId: string; season: string; initialData?: PlayerComputedStats[] }) =>
      useOrganizationStandingsQuery({ organizationId, season, initialData }), {
      wrapper, initialProps: { organizationId: "group-1", season: "current", initialData: players as PlayerComputedStats[] | undefined }
    });
    rerender({ organizationId: change === "group" ? "group-2" : "group-1", season: change === "season" ? "all" : "current", initialData: undefined });
    expect(result.current.data).toBeUndefined();
  });

  it.each(["group", "season", "pageSize"])("does not use previous history from another %s", (change) => {
    const { wrapper } = setup();
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const { result, rerender } = renderHook((props: { organizationId: string; season: string; pageSize: number; initialData?: OrganizationMatchesResponse }) =>
      useOrganizationMatchesQuery({ ...props, page: 1 }), {
      wrapper, initialProps: { organizationId: "group-1", season: "current", pageSize: 10, initialData: matches() as OrganizationMatchesResponse | undefined }
    });
    rerender({ organizationId: change === "group" ? "group-2" : "group-1", season: change === "season" ? "all" : "current", pageSize: change === "pageSize" ? 5 : 10, initialData: undefined });
    expect(result.current.data).toBeUndefined();
  });

  it("can keep the previous page only while loading within the same history", () => {
    const { wrapper } = setup();
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const firstPage = matches();
    const { result, rerender } = renderHook(({ page }: { page: number }) => useOrganizationMatchesQuery({ organizationId: "group-1", page, initialData: page === 1 ? firstPage : undefined }), { wrapper, initialProps: { page: 1 } });
    rerender({ page: 2 });
    expect(result.current.data).toEqual(firstPage);
    expect(result.current.isPlaceholderData).toBe(true);
  });
});
