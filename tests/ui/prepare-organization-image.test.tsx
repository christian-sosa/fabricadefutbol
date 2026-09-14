import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prepareOrganizationImage } from "@/lib/prepare-organization-image";

describe("browser cover preparation", () => {
  const drawImage = vi.fn();
  const revoke = vi.fn();
  const create = vi.fn(() => "blob:cover");
  beforeEach(() => {
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });
    vi.stubGlobal("Image", class {
      naturalWidth = 1600; naturalHeight = 1200;
      onload: (() => void) | null = null;
      set src(_value: string) { queueMicrotask(() => this.onload?.()); }
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(new Blob(["compressed"], { type: "image/webp" })));
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
  it("prepara un original de 8 MB como portada horizontal y libera recursos", async () => {
    const result = await prepareOrganizationImage(new File([new Uint8Array(8 * 1024 * 1024)], "cancha.jpg", { type: "image/jpeg" }));
    expect(result.type).toBe("image/webp");
    expect(result.size).toBeLessThan(3 * 1024 * 1024);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 150, 1600, 900, 0, 0, 1200, 675);
    expect(revoke).toHaveBeenCalledWith("blob:cover");
  });
  it("rechaza un original de más de 20 MB antes de decodificar", async () => {
    await expect(prepareOrganizationImage(new File([new Uint8Array(20 * 1024 * 1024 + 1)], "cancha.jpg", { type: "image/jpeg" }))).rejects.toThrow("20 MB");
    expect(create).not.toHaveBeenCalled();
  });
  it("rechaza una compresión que exceda el límite de envío y libera recursos", async () => {
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation((callback) => callback(new Blob([new Uint8Array(3 * 1024 * 1024 + 1)], { type: "image/png" })));
    await expect(prepareOrganizationImage(new File(["image"], "cancha.jpg", { type: "image/jpeg" }))).rejects.toThrow("3 MB");
    expect(revoke).toHaveBeenCalledWith("blob:cover");
  });
});
