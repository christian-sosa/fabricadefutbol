import { describe, expect, it } from "vitest";

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { GUIDES } from "@/lib/guides";

describe("public routes for crawlers", () => {
  it("bloquea superficies privadas y permite el contenido publico", () => {
    expect(robots()).toMatchObject({
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api", "/captain", "/invite"]
      }
    });
  });

  it("publica home, ayuda y guias en sitemap sin precios", () => {
    const urls = sitemap().map((entry) => entry.url);

    expect(urls).toContain("https://fabricadefutbol.com.ar/");
    expect(urls).toContain("https://fabricadefutbol.com.ar/help");
    expect(urls).toContain("https://fabricadefutbol.com.ar/guides");
    for (const guide of GUIDES) {
      expect(urls).toContain(`https://fabricadefutbol.com.ar/guides/${guide.slug}`);
    }
    expect(urls).not.toContain("https://fabricadefutbol.com.ar/pricing");
  });
});
