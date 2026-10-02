import type { Metadata } from "next";

import { buildAbsolutePublicUrl } from "@/lib/public-url";

export const SITE_NAME = "Fábrica de Fútbol";
export const HOME_TITLE = "Armá equipos de fútbol parejos gratis";
export const HOME_DESCRIPTION =
  "Organizá fútbol entre amigos gratis: armá equipos parejos, compartí por WhatsApp y guardá resultados y ranking. Los jugadores no necesitan registrarse.";

export const ACCESS_ROBOTS: Metadata["robots"] = {
  index: false,
  follow: false,
  googleBot: {
    index: false,
    follow: false,
    noimageindex: true
  }
};

type PublicMetadataOptions = {
  title: string;
  description: string;
  path: string;
  article?: boolean;
};

export function buildPublicMetadata({
  title,
  description,
  path,
  article = false
}: PublicMetadataOptions): Metadata {
  const url = buildAbsolutePublicUrl(path);
  const socialTitle = `${title} — ${SITE_NAME}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: article ? "article" : "website",
      locale: "es_AR",
      url,
      siteName: SITE_NAME,
      title: socialTitle,
      description
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description
    }
  };
}

export function buildSiteJsonLd() {
  const url = buildAbsolutePublicUrl("/");
  const organizationId = `${url}#organization`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: SITE_NAME,
        url,
        logo: buildAbsolutePublicUrl("/logo.png"),
        email: "info@fabricadefutbol.com.ar"
      },
      {
        "@type": "WebSite",
        "@id": `${url}#website`,
        name: SITE_NAME,
        url,
        inLanguage: "es-AR",
        publisher: { "@id": organizationId }
      },
      {
        "@type": "WebApplication",
        "@id": `${url}#application`,
        name: SITE_NAME,
        url,
        description: HOME_DESCRIPTION,
        applicationCategory: "SportsApplication",
        operatingSystem: "Web",
        inLanguage: "es-AR",
        isAccessibleForFree: true,
        provider: { "@id": organizationId }
      }
    ]
  };
}
