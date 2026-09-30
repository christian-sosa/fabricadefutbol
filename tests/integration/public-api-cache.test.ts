import { beforeEach, describe, expect, it, vi } from "vitest";

const { standings, history } = vi.hoisted(() => ({ standings: vi.fn(), history: vi.fn() }));
vi.mock("@/lib/queries/public", () => ({ getPlayersWithStats: standings, getMatchHistoryCardsPage: history }));
import { GET as getStandings } from "@/app/api/organizations/[organizationId]/standings/route";
import { GET as getMatches } from "@/app/api/organizations/[organizationId]/matches/route";

beforeEach(() => {
  vi.clearAllMocks();
  standings.mockResolvedValue([]);
  history.mockResolvedValue({ matches: [], pagination: { page: 1, totalCount: 0 } });
});

describe("public group API cache isolation", () => {
  it.each([
    ["standings", getStandings],
    ["matches", getMatches]
  ] as const)("keeps %s responses out of shared caches for anonymous and authenticated requests", async (path, handler) => {
    for (const cookie of ["", "sb-session=privileged-session"]) {
      const response = await handler(new Request(`https://example.test/api/organizations/group/${path}`, {
        headers: cookie ? { cookie } : {}
      }), { params: Promise.resolve({ organizationId: "group" }) });
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("server-timing")).toMatch(/^group-query;dur=\d+(\.\d+)?$/);
    }
  });
});
