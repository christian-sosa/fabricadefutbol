import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClubSiteCatalog } from "@/components/clubs/club-site";
import { resolveClubSiteFromRequestHost } from "@/lib/club-site-request";
import { buildClubSitePublicHref } from "@/lib/domain/club-sites";

export async function generateMetadata(): Promise<Metadata> {
  const { data } = await resolveClubSiteFromRequestHost();

  if (!data || !data.settings.sectionVisibility.catalog) {
    return {
      title: "Catalogo",
      robots: {
        index: false,
        follow: false
      }
    };
  }

  return {
    title: { absolute: `Catalogo - ${data.club.name}` },
    alternates: { canonical: buildClubSitePublicHref(data.club, data.settings, "/catalogo") },
    robots: {
      index: true,
      follow: true
    }
  };
}

export default async function CustomDomainCatalogPage({
  searchParams
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  const [{ data }, resolvedSearchParams] = await Promise.all([
    resolveClubSiteFromRequestHost(),
    searchParams
  ]);

  if (!data || !data.settings.sectionVisibility.catalog) notFound();

  return <ClubSiteCatalog category={resolvedSearchParams.categoria} data={data} />;
}
