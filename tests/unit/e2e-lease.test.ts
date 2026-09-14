import { afterEach, describe, expect, it, vi } from "vitest";
import { fixtureLeaseRpc, startLeaseHeartbeat } from "../../scripts/lib/e2e-lease.mjs";

const token = "00000000-0000-4000-8000-000000000001";
const env = {NEXT_PUBLIC_SUPABASE_URL_DEV: "https://test.supabase.co", SUPABASE_SERVICE_ROLE_KEY_DEV: "secret", NEXT_PUBLIC_SUPABASE_TARGET_ENV: "development", NEXT_PUBLIC_SUPABASE_DB_SCHEMA_DEV: "app_dev"};
afterEach(() => {vi.useRealTimers();});
describe("shared E2E fixture lease", () => {
  it("uses only the app_dev RPC with an owner token and checks its boolean response", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("true"));
    expect(await fixtureLeaseRpc("acquire", token, env, fetcher)).toBe(true);
    expect(fetcher).toHaveBeenCalledWith("https://test.supabase.co/rest/v1/rpc/acquire_e2e_fixture_lease", expect.objectContaining({method: "POST", headers: expect.objectContaining({"content-profile": "app_dev"}), body: JSON.stringify({p_token: token})}));
    fetcher.mockResolvedValue(new Response("false"));
    expect(await fixtureLeaseRpc("acquire", token, env, fetcher)).toBe(false);
    fetcher.mockClear();
    await expect(fixtureLeaseRpc("acquire", token, {...env, NEXT_PUBLIC_SUPABASE_TARGET_ENV: "production"}, fetcher)).rejects.toThrow("app_dev");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("aborts on lost heartbeat and never starts another heartbeat after stopping", async () => {
    vi.useFakeTimers();
    const renew = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const failure = vi.fn();
    const stop = startLeaseHeartbeat(renew, failure);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(failure).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(failure).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(renew).toHaveBeenCalledTimes(2);
    await stop();
  });
  it("stops cleanly and propagates network failures exactly once", async () => {
    vi.useFakeTimers();
    const failure = vi.fn();
    const stop = startLeaseHeartbeat(() => Promise.reject(new Error("offline")), failure);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(failure).toHaveBeenCalledWith(expect.objectContaining({message: "offline"}));
    await stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(failure).toHaveBeenCalledOnce();
  });
});
