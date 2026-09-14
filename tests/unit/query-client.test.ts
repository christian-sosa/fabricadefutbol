import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchOrganizationMatches, fetchOrganizationStandings, updateMatchResult } from "@/lib/query/client";

const fetcher = vi.fn<typeof fetch>();
beforeEach(() => {fetcher.mockReset(); vi.stubGlobal("fetch", fetcher);});
describe("public and result HTTP client behavior", () => {
  it("keeps organization, season and pagination scopes in requests", async () => {
    fetcher.mockResolvedValueOnce(Response.json({standings: [{playerId: "player-1"}]}));
    expect(await fetchOrganizationStandings("group-1", "season + historic")).toEqual([{playerId: "player-1"}]);
    expect(fetcher.mock.calls[0][0]).toBe("/api/organizations/group-1/standings?season=season+%2B+historic");
    const response = {matches: [], pagination: {page: 2}};
    fetcher.mockResolvedValueOnce(Response.json(response));
    expect(await fetchOrganizationMatches({organizationId: "group-1", page: 2, pageSize: 20, season: "all"})).toEqual(response);
    expect(String(fetcher.mock.calls[1][0])).toContain("page=2&pageSize=20&season=all");
  });
  it("sends one versioned acta, preserves failure and permits an explicit retry", async () => {
    const request = {organizationId: "group-1", matchId: "match-1", payload: {expectedVersion: 7, scoreA: 3, scoreB: 2, mvpParticipantId: null, notes: "Keep these notes", lineup: {assignments: [{participantId: "player:1", team: "A" as const}], handicapTeam: "A" as const, absencePenaltyParticipantIds: ["player:2"]}}};
    fetcher.mockResolvedValueOnce(Response.json({error: "Reintentá más tarde"}, {status: 503}));
    await expect(updateMatchResult(request)).rejects.toThrow("Reintentá más tarde");
    expect(fetcher).toHaveBeenCalledOnce();
    fetcher.mockResolvedValueOnce(Response.json({ok: true}));
    await expect(updateMatchResult(request)).resolves.toEqual({ok: true});
    expect(fetcher.mock.calls[1]).toEqual(fetcher.mock.calls[0]);
    expect(fetcher.mock.calls[1][1]).toMatchObject({method: "PATCH", body: JSON.stringify(request.payload)});
  });
  it.each([
    new Response("bad gateway", {status: 503}), Response.json({}, {status: 503}), Response.json({error: "  "}, {status: 503})
  ])("does not turn an unreadable API failure into empty data", async (response) => {
    fetcher.mockResolvedValue(response);
    await expect(fetchOrganizationStandings("group-1")).rejects.toThrow("503");
  });
  it("propagates stale version conflicts and transport failures", async () => {
    fetcher.mockResolvedValueOnce(Response.json({error: "Otra pestaña guardó una versión nueva"}, {status: 409}));
    await expect(updateMatchResult({organizationId: "group-1", matchId: "match-1", payload: {expectedVersion: 2, scoreA: 1, scoreB: 0}})).rejects.toThrow("Otra pestaña");
    fetcher.mockRejectedValueOnce(new TypeError("Network unavailable"));
    await expect(fetchOrganizationMatches({organizationId: "group-1", page: 1, pageSize: 20})).rejects.toThrow("Network unavailable");
  });
});
