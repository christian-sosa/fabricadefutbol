import { describe, expect, it } from "vitest";

import {
  buildOrganizationImagePlaceholderSvg,
  getOrganizationImageObjectPath,
  getOrganizationImageUrl,
  isSupportedOrganizationImageFile
} from "@/lib/organization-images";

function buildFile(name: string, type: string) {
  return new File(["image"], name, { type });
}

describe("organization image helpers", () => {
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
