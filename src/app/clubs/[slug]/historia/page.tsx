import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { ClubSiteHistory } from "@/components/clubs/club-site";
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
    title: data ? { absolute: `Historia - ${data.club.name}` } : { absolute: "Historia" },
    description: data?.club.description ?? `Historia de ${data?.club.name ?? "club"}.`,
    alternates: data ? { canonical: buildClubSitePublicHref(data.club, data.settings, "/historia") } : undefined,
    robots: {
      index: isCustomDomain,
      follow: true
    }
  };
}

export default async function ClubSiteHistoryPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getPublicClubSiteBySlug(slug);
  if (!data) notFound();

  return <ClubSiteHistory data={data} />;
}
