import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClubSiteHistory } from "@/components/clubs/club-site";
import { resolveClubSiteFromRequestHost } from "@/lib/club-site-request";
import { buildClubSitePublicHref } from "@/lib/domain/club-sites";

export async function generateMetadata(): Promise<Metadata> {
  const { data } = await resolveClubSiteFromRequestHost();

  if (!data) {
    return {
      title: "Historia",
      robots: {
        index: false,
        follow: false
      }
    };
  }

  return {
    title: { absolute: `Historia - ${data.club.name}` },
    description: data.club.description ?? `Historia de ${data.club.name}.`,
    alternates: { canonical: buildClubSitePublicHref(data.club, data.settings, "/historia") },
    robots: {
      index: true,
      follow: true
    }
  };
}

export default async function CustomDomainHistoryPage() {
  const { data } = await resolveClubSiteFromRequestHost();
  if (!data) notFound();

  return <ClubSiteHistory data={data} />;
}
