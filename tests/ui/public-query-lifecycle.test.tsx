import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, focusManager, onlineManager, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useOrganizationMatchesQuery, useOrganizationStandingsQuery, useUpdateMatchResultMutation } from "@/lib/query/hooks";
import { organizationQueryKeys } from "@/lib/query/keys";
import type { OrganizationMatchesResponse } from "@/lib/query/types";
import type { PlayerComputedStats } from "@/types/domain";
import { ReactQueryProvider } from "@/components/providers/react-query-provider";

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

afterEach(() => { clients.forEach((client) => client.clear()); clients.length = 0; onlineManager.setOnline(true); focusManager.setFocused(undefined); });

describe("public query lifecycle", () => {
  it("reuses fresh browser data when moving between layouts with separate providers", () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const firstVisit = renderHook(() => useOrganizationStandingsQuery({
      organizationId: "group-navigation", initialData: players
    }), { wrapper: ReactQueryProvider });
    expect(firstVisit.result.current.data).toEqual(players);
    firstVisit.unmount();

    const returnVisit = renderHook(() => useOrganizationStandingsQuery({
      organizationId: "group-navigation"
    }), { wrapper: ReactQueryProvider });
    expect(returnVisit.result.current.data).toEqual(players);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(["standings", "matches"] as const)("cancels an unused %s request after its scope changes", async (kind) => {
    const { wrapper } = setup();
    const signals: AbortSignal[] = [];
    const fetcher = vi.fn((_url: string, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
      const signal = options.signal as AbortSignal;
      signals.push(signal);
      signal?.addEventListener("abort", () => reject(new DOMException("Cancelled", "AbortError")));
    }));
    vi.stubGlobal("fetch", fetcher);
    const { rerender, unmount } = renderHook(({ season }: { season: string }) => {
      const standings = useOrganizationStandingsQuery({ organizationId: kind === "standings" ? "group-1" : null, season });
      const history = useOrganizationMatchesQuery({ organizationId: kind === "matches" ? "group-1" : null, page: 1, season });
      return kind === "standings" ? standings : history;
    }, { wrapper, initialProps: { season: "current" } });
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    rerender({ season: "all" });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
    unmount();
    expect(signals[1]?.aborted).toBe(true);
  });

  it("refreshes each active group query once after saving a result and leaves other groups fresh", async () => {
    const { client, wrapper } = setup();
    const reads = Array.from({ length: 4 }, () => vi.fn(async () => "updated"));
    const keys = [
      organizationQueryKeys.matchesPage("group-1", 1, 10),
      organizationQueryKeys.matchDetail("group-1", "match-1"),
      organizationQueryKeys.standings("group-1"),
      organizationQueryKeys.standings("group-2")
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ success: true })));
    const { result } = renderHook(() => {
      useQuery({ queryKey: keys[0], queryFn: reads[0], initialData: "original", staleTime: Infinity });
      useQuery({ queryKey: keys[1], queryFn: reads[1], initialData: "original", staleTime: Infinity });
      useQuery({ queryKey: keys[2], queryFn: reads[2], initialData: "original", staleTime: Infinity });
      useQuery({ queryKey: keys[3], queryFn: reads[3], initialData: "original", staleTime: Infinity });
      return useUpdateMatchResultMutation({ organizationId: "group-1", matchId: "match-1" });
    }, { wrapper });
    await act(async () => { await result.current.mutateAsync({ scoreA: 2, scoreB: 1, expectedVersion: 3 }); });
    for (let index = 0; index < 3; index++) {
      expect(reads[index]).toHaveBeenCalledOnce();
      expect(client.getQueryData(keys[index])).toBe("updated");
    }
    expect(reads[3]).not.toHaveBeenCalled();
    expect(client.getQueryState(keys[3])?.isInvalidated).toBe(false);
    expect(client.getQueryData(keys[3])).toBe("original");
  });

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

  it("refreshes expired calendar absence when returning to an already open ranking", async () => {
    const { client, wrapper } = setup();
    const before = [{ ...players[0], isAbsent: false }];
    const after = [{ ...players[0], isAbsent: true }];
    const fetcher = vi.fn().mockResolvedValue(Response.json({ standings: after }));
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => useOrganizationStandingsQuery({ organizationId: "group-1", initialData: before }), { wrapper });
    expect(fetcher).not.toHaveBeenCalled();
    act(() => {
      focusManager.setFocused(false);
      client.setQueryData(organizationQueryKeys.standings("group-1"), before, { updatedAt: Date.now() - 120_000 });
      focusManager.setFocused(true);
    });
    await waitFor(() => expect(result.current.data).toEqual(after));
    expect(fetcher).toHaveBeenCalledOnce();
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
