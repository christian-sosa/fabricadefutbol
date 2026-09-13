import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { preparePlayerPhoto } from "@/lib/prepare-player-photo";

describe("browser photo preparation", () => {
  const drawImage = vi.fn();
  const revoke = vi.fn();
  const create = vi.fn(() => "blob:test-photo");
  beforeEach(() => {
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });
    vi.stubGlobal("Image", class {
      naturalWidth = 1600;
      naturalHeight = 900;
      onload: (() => void) | null = null;
      set src(_value: string) { queueMicrotask(() => this.onload?.()); }
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(new Blob(["compressed"], { type: "image/webp" })));
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
  it("recorta al centro un original grande y entrega un archivo pequeño", async () => {
    const original = new File([new Uint8Array(8 * 1024 * 1024)], "viaje.jpg", { type: "image/jpeg" });
    const output = await preparePlayerPhoto(original);
    expect(output.name).toBe("viaje.webp");
    expect(output.type).toBe("image/webp");
    expect(output.size).toBeLessThan(5 * 1024 * 1024);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 350, 0, 900, 900, 0, 0, 320, 320);
    expect(revoke).toHaveBeenCalledWith("blob:test-photo");
  });
  it("descarta un archivo mayor de 20 MB antes de decodificarlo", async () => {
    await expect(preparePlayerPhoto(new File([new Uint8Array(20 * 1024 * 1024 + 1)], "grande.jpg", { type: "image/jpeg" }))).rejects.toThrow("20 MB");
    expect(create).not.toHaveBeenCalled();
  });
  it("libera el recurso si el canvas no logra comprimir", async () => {
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation((callback) => callback(null));
    await expect(preparePlayerPhoto(new File(["small"], "foto.jpg", { type: "image/jpeg" }))).rejects.toThrow("comprimir");
    expect(revoke).toHaveBeenCalledWith("blob:test-photo");
  });
});
