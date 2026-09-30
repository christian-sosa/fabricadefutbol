import { describe, expect, it, vi } from "vitest";
import { ensureTargetBucket } from "../../scripts/copy-storage-bucket.mjs";

describe("storage copy destination privacy", () => {
  it.each([null, { message: "The resource already exists" }])("keeps new and existing destinations private (%j)", async (createError) => {
    const createBucket = vi.fn().mockResolvedValue({ error: createError });
    const updateBucket = vi.fn().mockResolvedValue({ error: null });
    await ensureTargetBucket({ storage: { createBucket, updateBucket } }, "player-photos");
    const options = { public: false, fileSizeLimit: 5 * 1024 * 1024, allowedMimeTypes: ["image/webp"] };
    expect(createBucket).toHaveBeenCalledWith("player-photos", options);
    expect(updateBucket).toHaveBeenCalledWith("player-photos", options);
  });
});
