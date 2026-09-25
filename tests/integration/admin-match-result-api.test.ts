import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(), client: vi.fn(), save: vi.fn(), refresh: vi.fn(), analytics: vi.fn()
}));
vi.mock("@/lib/auth/admin", () => ({ assertOrganizationAdminAction: mocks.authorize }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));
vi.mock("@/lib/domain/match-workflow", () => ({ saveMatchResult: mocks.save }));
vi.mock("@/lib/queries/public", () => ({ refreshOrganizationPublicSnapshotSafe: mocks.refresh }));
vi.mock("@/lib/analytics/server", () => ({ recordAnalyticsEvent: mocks.analytics }));
vi.mock("@/lib/observability/log", () => ({ logInfo: vi.fn(), logWarn: vi.fn(), logError: vi.fn() }));

import { PATCH } from "@/app/api/admin/organizations/[organizationId]/matches/[matchId]/result/route";

const context = { params: Promise.resolve({ organizationId: "group-a", matchId: "match-1" }) };
const basePayload = { expectedVersion: 7, scoreA: 3, scoreB: 0 };
function request(body: unknown) {
  return new Request("http://localhost/api/admin/organizations/group-a/matches/match-1/result", {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
}

describe("API de resultado con autores privados", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue({ userId: "admin-1" });
    mocks.client.mockResolvedValue({ rpc: vi.fn() });
    mocks.save.mockResolvedValue({ firstFinished: false, resultVersion: 8, seasonId: "season-1" });
    mocks.refresh.mockResolvedValue(undefined);
  });

  it("envía goles, formación y versión juntos a la operación atómica sin confiar en nombres del cliente", async () => {
    const payload = {
      ...basePayload,
      scorers: [{ participantId: "newGuest:1", goals: 2 }],
      lineup: {
        assignments: [{ participantId: "player:p1", team: "A" }],
        newGuests: [{ clientId: "1", name: "Refuerzo", rating: 3, team: "A" }]
      }
    };
    const response = await PATCH(request(payload), context);
    expect(response.status).toBe(200);
    expect(mocks.authorize).toHaveBeenCalledWith("group-a");
    expect(mocks.save).toHaveBeenCalledOnce();
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({
      adminId: "admin-1", organizationId: "group-a", matchId: "match-1", resultInput: payload
    }));
    expect(await response.json()).toMatchObject({ resultVersion: 8, firstFinished: false });
    expect(mocks.analytics).not.toHaveBeenCalled();
  });

  it.each([
    [[{ participantId: "player:p1", goals: 1 }, { participantId: "player:p1", goals: 2 }]],
    [[{ participantId: "player:p1", goals: 0 }]],
    [[{ participantId: "player:p1", goals: 1.5 }]],
    [[{ participantId: "player:p1", goals: 1000 }]],
    [[{ participantId: "player:p1", goals: 1, display_name: "Nombre falso" }]]
  ])("rechaza autores inválidos antes de ejecutar escrituras: %j", async (scorers) => {
    const response = await PATCH(request({ ...basePayload, scorers }), context);
    expect(response.status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("distingue borrar todos los autores de omitirlos al corregir otro dato", async () => {
    await PATCH(request({ ...basePayload, scorers: [] }), context);
    expect(mocks.save.mock.calls[0][0].resultInput.scorers).toEqual([]);
    await PATCH(request(basePayload), context);
    expect(mocks.save.mock.calls[1][0].resultInput).not.toHaveProperty("scorers");
  });

  it("impide escrituras de un administrador sin acceso al grupo", async () => {
    mocks.authorize.mockRejectedValueOnce(new Error("No autorizado para administrar este grupo."));
    const response = await PATCH(request({ ...basePayload, scorers: [{ participantId: "player:p1", goals: 2 }] }), context);
    expect(response.status).toBe(403);
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("conserva el conflicto de versión cuando otro admin ya corrigió los goleadores", async () => {
    mocks.save.mockRejectedValueOnce(new Error("El partido cambio mientras lo editabas."));
    const response = await PATCH(request({ ...basePayload, scorers: [] }), context);
    expect(response.status).toBe(409);
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.analytics).not.toHaveBeenCalled();
  });
});
