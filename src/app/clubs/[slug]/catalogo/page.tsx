import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { ClubSiteCatalog } from "@/components/clubs/club-site";
import { buildClubSitePublicHref, isClubSiteCustomDomainHost } from "@/lib/domain/club-sites";
import { getPublicClubSiteBySlug } from "@/lib/queries/clubs";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicClubSiteBySlug(slug);
  const requestHeaders = await headers();
  const isCustomDomain = data ? isClubSiteCustomDomainHost(requestHeaders.get("host"), data.settings) : false;

  return {
    title: data ? { absolute: `Catalogo - ${data.club.name}` } : { absolute: "Catalogo" },
    alternates: data ? { canonical: buildClubSitePublicHref(data.club, data.settings, "/catalogo") } : undefined,
    robots: {
      index: isCustomDomain,
      follow: true
    }
  };
}

export default async function ClubSiteCatalogPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ categoria?: string }>;
}) {
  const [{ slug }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const data = await getPublicClubSiteBySlug(slug);
  if (!data || !data.settings.sectionVisibility.catalog) notFound();

  return <ClubSiteCatalog category={resolvedSearchParams.categoria} data={data} />;
}
