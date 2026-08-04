import { afterEach, describe, expect, it, vi } from "vitest";

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { GUIDES } from "@/lib/guides";

describe("public routes for crawlers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("bloquea superficies privadas y permite el contenido publico", () => {
    expect(robots()).toMatchObject({
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api",
          "/captain",
          "/invite",
          "/tournaments",
          "/clubs",
          "/catalogo",
          "/equipo",
          "/historia"
        ]
      }
    });
  });

  it("publica home, ayuda y guias sin Clubes ni precios en produccion", () => {
    vi.stubEnv("NODE_ENV", "production");
    const urls = sitemap().map((entry) => entry.url);

    expect(urls).toContain("https://fabricadefutbol.com.ar/");
    expect(urls).not.toContain("https://fabricadefutbol.com.ar/clubs");
    expect(urls).toContain("https://fabricadefutbol.com.ar/help");
    expect(urls).toContain("https://fabricadefutbol.com.ar/guides");
    for (const guide of GUIDES) {
      expect(urls).toContain(`https://fabricadefutbol.com.ar/guides/${guide.slug}`);
    }
    expect(urls).not.toContain("https://fabricadefutbol.com.ar/pricing");
  });

  it("mantiene suficientes guias originales para AdSense", () => {
    expect(GUIDES.length).toBeGreaterThanOrEqual(8);

    for (const guide of GUIDES) {
      expect(guide.description.length).toBeGreaterThanOrEqual(90);
      expect(guide.sections.length).toBeGreaterThanOrEqual(3);
      for (const section of guide.sections) {
        expect(section.body.length).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
