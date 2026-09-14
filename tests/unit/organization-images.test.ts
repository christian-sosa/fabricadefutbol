import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { MAX_ORGANIZATION_IMAGE_SIZE_BYTES } from "@/lib/organization-image-constraints";

import {
  buildOrganizationImagePlaceholderSvg,
  getOrganizationImageObjectPath,
  getOrganizationImageUrl,
  isSupportedOrganizationImageFile,
  optimizeOrganizationImage
} from "@/lib/organization-images";

function buildFile(name: string, type: string) {
  return new File(["image"], name, { type });
}

describe("organization image helpers", () => {
  it("recodifica una imagen real a WEBP horizontal y rechaza bytes corruptos", async () => {
    const bytes = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: "green" } }).png().toBuffer();
    const output = await optimizeOrganizationImage(new File([new Uint8Array(bytes)], "grupo.png", { type: "image/png" }));
    const metadata = await sharp(output).metadata();
    expect(metadata).toMatchObject({ format: "webp", width: 1200, height: 675 });
    expect(output.byteLength).toBeLessThan(MAX_ORGANIZATION_IMAGE_SIZE_BYTES);
    await expect(optimizeOrganizationImage(buildFile("corrupto.jpg", "image/jpeg"))).rejects.toThrow();
  });
  it("deja margen para el cuerpo multipart completo debajo del límite Vercel", async () => {
    const data = new FormData();
    data.set("organizationId", "a".repeat(36));
    data.set("image", new File([new Uint8Array(MAX_ORGANIZATION_IMAGE_SIZE_BYTES)], "portada.webp", { type: "image/webp" }));
    const request = new Request("https://local.invalid/admin", { method: "POST", body: data });
    expect((await request.arrayBuffer()).byteLength).toBeLessThan(4_000_000);
    await expect(optimizeOrganizationImage(new File([new Uint8Array(MAX_ORGANIZATION_IMAGE_SIZE_BYTES + 1)], "grande.webp", { type: "image/webp" }))).rejects.toThrow("3 MB");
  });
  it("acepta formatos compatibles para imagenes de grupo", () => {
    expect(isSupportedOrganizationImageFile(buildFile("grupo.jpg", "image/jpeg"))).toBe(true);
    expect(isSupportedOrganizationImageFile(buildFile("grupo.png", "image/png"))).toBe(true);
    expect(isSupportedOrganizationImageFile(buildFile("grupo.webp", "image/webp"))).toBe(true);
    expect(isSupportedOrganizationImageFile(buildFile("grupo.gif", "image/gif"))).toBe(false);
  });

  it("arma path y url estables para storage y API", () => {
    expect(getOrganizationImageObjectPath("app_dev", "org-123")).toBe(
      "app_dev/organizations/org-123.webp"
    );
    expect(getOrganizationImageUrl("org-123")).toBe("/api/organization-image/org-123");
  });

  it("genera un placeholder svg con el nombre del grupo", () => {
    const svg = buildOrganizationImagePlaceholderSvg("La Cantera de LQ");

    expect(svg).toContain("La Cantera de LQ");
    expect(svg).toMatch(/>\s*LC\s*</);
    expect(svg).toContain("<svg");
  });

  it("escapa el nombre del grupo antes de interpolarlo en el svg", () => {
    const svg = buildOrganizationImagePlaceholderSvg(`La <Cantera> & "LQ"`);

    expect(svg).toContain("aria-label=\"La &lt;Cantera&gt; &amp; &quot;LQ&quot;\"");
    expect(svg).toContain("La &lt;Cantera&gt; &amp; \"LQ\"");
    expect(svg).not.toContain(`La <Cantera> & "LQ"`);
  });
});
