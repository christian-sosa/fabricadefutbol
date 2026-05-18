import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { ClubSiteTeamData } from "@/components/clubs/club-site";
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
    title: data ? { absolute: `Informacion - ${data.club.name}` } : { absolute: "Informacion" },
    alternates: data ? { canonical: buildClubSitePublicHref(data.club, data.settings, "/equipo") } : undefined,
    robots: {
      index: isCustomDomain,
      follow: true
    }
  };
}

export default async function ClubSiteTeamDataPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getPublicClubSiteBySlug(slug);
  if (!data || !data.settings.sectionVisibility.teamData) notFound();

  return <ClubSiteTeamData data={data} />;
}
