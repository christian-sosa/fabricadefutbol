import { beforeEach, describe, expect, it, vi } from "vitest";
const { factory, rpc } = vi.hoisted(() => ({ factory: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: factory }));
import { checkSharedRateLimit } from "@/lib/shared-rate-limit";

describe("shared abuse limit", () => {
  const input = { key: "recovery:203.0.113.7", limit: 3, windowMs: 60000 };
  beforeEach(() => { vi.clearAllMocks(); factory.mockReturnValue({ rpc }); });
  it("uses the same persisted counter across requests and sends no raw IP", async () => {
    rpc.mockResolvedValueOnce({ data: { allowed: true, remaining: 0, retryAfterMs: 0 }, error: null })
      .mockResolvedValueOnce({ data: { allowed: false, remaining: 0, retryAfterMs: 1234 }, error: null });
    expect((await checkSharedRateLimit(input)).allowed).toBe(true);
    expect(await checkSharedRateLimit(input)).toEqual({ allowed: false, remaining: 0, retryAfterMs: 1234 });
    expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
    expect(rpc.mock.calls[0][1].p_key_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("203.0.113.7");
  });
  it.each([null, { allowed: true }, { allowed: "true", remaining: 3, retryAfterMs: 0 }, { allowed: true, remaining: -1, retryAfterMs: 0 }])("fails closed for invalid counter responses %j", async (data) => {
    rpc.mockResolvedValue({ data, error: null });
    expect((await checkSharedRateLimit(input)).allowed).toBe(false);
  });
  it("fails closed for missing credentials, transport errors and database errors", async () => {
    factory.mockReturnValueOnce(null);
    expect((await checkSharedRateLimit(input)).allowed).toBe(false);
    rpc.mockRejectedValueOnce(new Error("offline"));
    expect((await checkSharedRateLimit(input)).allowed).toBe(false);
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501" } });
    expect((await checkSharedRateLimit(input)).allowed).toBe(false);
  });
  it("rejects invalid configuration before accessing the service", async () => {
    await expect(checkSharedRateLimit({ ...input, limit: 0 })).rejects.toThrow("Configuración");
    await expect(checkSharedRateLimit({ ...input, windowMs: NaN })).rejects.toThrow("Configuración");
    expect(factory).not.toHaveBeenCalled();
  });
});
