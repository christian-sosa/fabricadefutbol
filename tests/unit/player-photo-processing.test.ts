import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { optimizePlayerAvatarImage, isOrganizationPlayerPhotoObjectPath } from "@/lib/player-photos";

describe("player photo processing", () => {
  it("convierte una foto real a un avatar WEBP cuadrado sin metadata", async () => {
    const original = await sharp({ create: { width: 900, height: 600, channels: 3, background: "#446688" } }).jpeg().toBuffer();
    const result = await optimizePlayerAvatarImage(new File([new Uint8Array(original)], "foto.jpg", { type: "image/jpeg" }));
    const metadata = await sharp(result).metadata();
    expect(metadata).toMatchObject({ width: 320, height: 320, format: "webp" });
    expect(metadata.exif).toBeUndefined();
  });
  it("rechaza archivos mayores de 5 MB también en servidor", async () => {
    await expect(optimizePlayerAvatarImage(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "foto.jpg", { type: "image/jpeg" }))).rejects.toThrow("5 MB");
  });
  it("rechaza bytes inválidos aunque el nombre prometa JPG", async () => {
    await expect(optimizePlayerAvatarImage(new File(["esto no es una foto"], "foto.jpg", { type: "image/jpeg" }))).rejects.toThrow();
  });
  it("acepta una versión del jugador y rechaza rutas ajenas o traversal", () => {
    expect(isOrganizationPlayerPhotoObjectPath("app_dev/org/p/10000000-0000-4000-8000-000000000001.webp", "app_dev", "org", "p")).toBe(true);
    expect(isOrganizationPlayerPhotoObjectPath("app_dev/org/other.webp", "app_dev", "org", "p")).toBe(false);
    expect(isOrganizationPlayerPhotoObjectPath("app_dev/org/p/../other.webp", "app_dev", "org", "p")).toBe(false);
  });
});
