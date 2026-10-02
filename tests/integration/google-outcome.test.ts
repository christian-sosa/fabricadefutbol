import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ insert: vi.fn(), cookie: vi.fn(), id: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: mocks.cookie }) }));
vi.mock("@/lib/env", () => ({ getGoogleAnalyticsMeasurementId: mocks.id }));
vi.mock("@/lib/analytics/attribution", () => ({ getAnalyticsAttribution: async () => ({}) }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ from: () => ({ insert: () => ({ select: () => ({ single: mocks.insert }) }) }) }) }));
import { recordAnalyticsEvent } from "@/lib/analytics/server";
import { GOOGLE_OUTCOME_COOKIE, parseGoogleOutcome } from "@/lib/analytics/google-outcome";

describe("notificación de grupo creado para Google", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.id.mockReturnValue("G-TEST12345");
    mocks.insert.mockResolvedValue({ data: { id: "private-analytics-id" }, error: null });
  });
  it("notifica sólo un alta confirmada, sin identificadores de entidades", async () => {
    const result = await recordAnalyticsEvent({ eventName: "group_created", entityId: "private-group-id", adminId: "private-admin-id" });
    expect(result.recorded).toBe(true);
    expect(mocks.cookie).toHaveBeenCalledWith(GOOGLE_OUTCOME_COOKIE, expect.stringMatching(/^group_created:/), expect.objectContaining({ maxAge: 120, path: "/", sameSite: "lax" }));
    expect(parseGoogleOutcome(mocks.cookie.mock.calls[0][1])).toMatchObject({ eventName: "group_created" });
    expect(JSON.stringify(mocks.cookie.mock.calls)).not.toMatch(/private-/);
  });
  it("no notifica reintentos deduplicados ni cuando Google está desactivado", async () => {
    mocks.insert.mockResolvedValueOnce({ data: null, error: { code: "23505", message: "duplicate" } });
    expect((await recordAnalyticsEvent({ eventName: "group_created", entityId: "private-group-id" })).recorded).toBe(false);
    expect(mocks.cookie).not.toHaveBeenCalled();
    mocks.id.mockReturnValue(null);
    expect((await recordAnalyticsEvent({ eventName: "group_created", entityId: "another-group" })).recorded).toBe(true);
    expect(mocks.cookie).not.toHaveBeenCalled();
  });
  it("un fallo de cookie no cambia el resultado de la operación", async () => {
    mocks.cookie.mockImplementationOnce(() => { throw new Error("cookies unavailable"); });
    expect((await recordAnalyticsEvent({ eventName: "group_created", entityId: "another-group" })).recorded).toBe(true);
  });
});
