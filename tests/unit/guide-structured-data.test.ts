import { describe, expect, it, vi } from "vitest";

import type { Guide } from "@/lib/guides";
import {
  buildGuideArticleJsonLd,
  buildGuideBreadcrumbJsonLd,
  buildGuidesItemListJsonLd,
  getGuideWordCount
} from "@/lib/guide-structured-data";

vi.mock("@/lib/public-url", () => ({
  buildAbsolutePublicUrl: (path: string) => `https://fabricadefutbol.com.ar${path}`
}));

const guide: Guide = {
  slug: "organizar-futbol-semanal",
  title: "Guía para organizar fútbol semanal sin caos",
  description: "Una guía práctica para ordenar convocatoria, equipos y resultados en un grupo amateur.",
  readingTime: "6 min",
  sections: [
    {
      title: "Definí una cadencia",
      body: [
        "Elegí un día fijo para abrir convocatoria y otro momento para cerrar confirmados.",
        "La previsibilidad reduce cambios de último minuto."
      ]
    },
    {
      title: "Cerrá el resultado",
      body: [
        "Cargar el resultado apenas termina el partido mantiene vivo el ranking.",
        "El historial básico vale más que esperar una carga perfecta."
      ]
    }
  ]
};

describe("guide structured data", () => {
  it("calcula palabras de titulo, descripcion y cuerpo", () => {
    expect(getGuideWordCount(guide)).toBe(67);
  });

  it("genera Article JSON-LD para una guia", () => {
    expect(buildGuideArticleJsonLd(guide)).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: guide.title,
      description: guide.description,
      inLanguage: "es-AR",
      articleSection: "Fútbol amateur",
      mainEntityOfPage: "https://fabricadefutbol.com.ar/guides/organizar-futbol-semanal",
      publisher: {
        "@type": "Organization",
        name: "Fábrica de Fútbol"
      },
      wordCount: 67
    });
  });

  it("genera breadcrumb e item list para mejorar crawlability", () => {
    expect(buildGuideBreadcrumbJsonLd(guide)).toMatchObject({
      "@type": "BreadcrumbList",
      itemListElement: [
        expect.objectContaining({ position: 1, name: "Guías" }),
        expect.objectContaining({ position: 2, name: guide.title })
      ]
    });

    expect(buildGuidesItemListJsonLd([guide])).toMatchObject({
      "@type": "ItemList",
      numberOfItems: 1,
      itemListElement: [
        expect.objectContaining({
          position: 1,
          url: "https://fabricadefutbol.com.ar/guides/organizar-futbol-semanal",
          name: guide.title
        })
      ]
    });
  });
});
