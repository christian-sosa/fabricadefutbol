import type { Guide } from "@/lib/guides";
import { buildAbsolutePublicUrl } from "@/lib/public-url";

const SITE_NAME = "Fábrica de Fútbol";
const LANGUAGE = "es-AR";

function guideUrl(guide: Guide) {
  return buildAbsolutePublicUrl(`/guides/${guide.slug}`);
}

function wordCount(value: string) {
  const matches = value.trim().match(/\S+/g);
  return matches?.length ?? 0;
}

export function getGuideWordCount(guide: Guide) {
  return [
    guide.title,
    guide.description,
    ...guide.sections.flatMap((section) => [section.title, ...section.body])
  ].reduce((total, value) => total + wordCount(value), 0);
}

export function buildGuideArticleJsonLd(guide: Guide) {
  const url = guideUrl(guide);

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    inLanguage: LANGUAGE,
    articleSection: "Fútbol amateur",
    mainEntityOfPage: url,
    url,
    author: {
      "@type": "Organization",
      name: SITE_NAME
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME
    },
    wordCount: getGuideWordCount(guide)
  };
}

export function buildGuideBreadcrumbJsonLd(guide: Guide) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Guías",
        item: buildAbsolutePublicUrl("/guides")
      },
      {
        "@type": "ListItem",
        position: 2,
        name: guide.title,
        item: guideUrl(guide)
      }
    ]
  };
}

export function buildGuidesItemListJsonLd(guides: Guide[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Guías para fútbol amateur",
    numberOfItems: guides.length,
    itemListElement: guides.map((guide, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: guide.title,
      description: guide.description,
      url: guideUrl(guide)
    }))
  };
}
