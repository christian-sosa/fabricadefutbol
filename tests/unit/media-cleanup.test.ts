import { beforeEach, describe, expect, it, vi } from "vitest";
const { adminClient } = vi.hoisted(() => ({ adminClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: adminClient }));
import { enqueueMediaCleanup, processMediaCleanup } from "@/lib/domain/media-cleanup";

describe("durable media cleanup worker", () => {
  beforeEach(() => vi.clearAllMocks());
  it("reserves cleanup before a new upload and fails before uploading if persistence is unavailable", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    adminClient.mockReturnValue({ rpc });
    await enqueueMediaCleanup("player-photos-dev", "app_dev/group/player/revision.webp", true);
    expect(rpc).toHaveBeenCalledWith("enqueue_media_cleanup", {
      p_bucket: "player-photos-dev", p_path: "app_dev/group/player/revision.webp", p_pending_upload: true
    });
    rpc.mockResolvedValue({ data: null, error: { message: "database unavailable" } });
    await expect(enqueueMediaCleanup("bucket", "path")).rejects.toThrow("database unavailable");
  });
  it("only removes paths returned by the reference-checking claim and records retryable errors", async () => {
    const jobs = [
      { id: "job-1", bucketName: "player-photos-dev", objectPath: "old-version.webp", leaseToken: "lease-1" },
      { id: "job-2", bucketName: "organization-images-dev", objectPath: "cover.webp", leaseToken: "lease-2" }
    ];
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    rpc.mockResolvedValueOnce({ data: jobs, error: null });
    const remove = vi.fn().mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: "Storage unavailable" } });
    const client = { rpc, storage: { from: vi.fn(() => ({ remove })) } };
    expect(await processMediaCleanup(client as never)).toEqual({ attempted: 2, deleted: 1, failed: 1 });
    expect(remove.mock.calls).toEqual([[["old-version.webp"]], [["cover.webp"]]]);
    expect(rpc).toHaveBeenCalledWith("complete_media_cleanup", { p_job_id: "job-2", p_lease_token: "lease-2", p_error: "Storage unavailable" });
  });
  it("persists thrown network failures and keeps an unacknowledged lease retryable if the database fails", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: [{ id: "job", bucketName: "bucket", objectPath: "path", leaseToken: "lease" }], error: null })
      .mockResolvedValueOnce({ error: { message: "ack failed" } });
    const remove = vi.fn().mockRejectedValue(new Error("network failed"));
    await expect(processMediaCleanup({ rpc, storage: { from: () => ({ remove }) } } as never)).rejects.toThrow("ack failed");
    expect(rpc).toHaveBeenLastCalledWith("complete_media_cleanup", { p_job_id: "job", p_lease_token: "lease", p_error: "network failed" });
  });
  it("does not touch Storage when the claim is empty or fails", async () => {
    const from = vi.fn();
    const rpc = vi.fn().mockResolvedValueOnce({ data: [], error: null }).mockResolvedValueOnce({ data: null, error: { message: "claim unavailable" } });
    const client = { rpc, storage: { from } };
    expect(await processMediaCleanup(client as never)).toEqual({ attempted: 0, deleted: 0, failed: 0 });
    await expect(processMediaCleanup(client as never)).rejects.toThrow("claim unavailable");
    expect(from).not.toHaveBeenCalled();
  });
});
