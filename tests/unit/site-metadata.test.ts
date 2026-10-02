import { describe, expect, it } from "vitest";

import { metadata } from "@/app/layout";
import { metadata as adminMetadata } from "@/app/admin/layout";
import { metadata as authMetadata } from "@/app/auth/layout";
import { metadata as inviteMetadata } from "@/app/invite/layout";
import { buildPublicMetadata, buildSiteJsonLd } from "@/lib/seo";

describe("site metadata", () => {
  it("declara canonical self-referential para evitar señales mixtas de indexacion", () => {
    expect(metadata.alternates).toMatchObject({
      canonical: "./"
    });
  });

  it("comparte la URL, título y descripción propios de una guía", () => {
    const result = buildPublicMetadata({
      title: "Cómo armar equipos parejos",
      description: "Un método para organizar el fútbol entre amigos.",
      path: "/guides/equipos-parejos",
      article: true
    });

    expect(result.openGraph).toMatchObject({
      type: "article",
      url: "https://fabricadefutbol.com.ar/guides/equipos-parejos",
      title: "Cómo armar equipos parejos — Fábrica de Fútbol",
      description: result.description,
      images: [{
        url: "https://fabricadefutbol.com.ar/opengraph-image",
        width: 1200,
        height: 630,
        alt: expect.stringContaining("Fábrica de Fútbol")
      }]
    });
    expect(result.twitter).toMatchObject({
      description: result.description,
      title: "Cómo armar equipos parejos — Fábrica de Fútbol",
      images: [{
        url: "https://fabricadefutbol.com.ar/twitter-image",
        width: 1200,
        height: 630,
        alt: expect.stringContaining("Fábrica de Fútbol")
      }]
    });
    expect(result.alternates?.canonical).toBe("https://fabricadefutbol.com.ar/guides/equipos-parejos");
  });

  it("evita indexar acceso, administración e invitaciones", () => {
    for (const accessMetadata of [adminMetadata, authMetadata, inviteMetadata]) {
      expect(accessMetadata.robots).toMatchObject({ index: false, follow: false });
    }
  });

  it("describe el producto gratuito sin inventar valoraciones", () => {
    const schema = buildSiteJsonLd();
    expect(schema["@graph"]).toEqual(expect.arrayContaining([
      expect.objectContaining({ "@type": "Organization", name: "Fábrica de Fútbol" }),
      expect.objectContaining({ "@type": "WebSite", inLanguage: "es-AR" }),
      expect.objectContaining({ "@type": "WebApplication", isAccessibleForFree: true })
    ]));
    expect(JSON.stringify(schema)).not.toContain("aggregateRating");
  });
});
