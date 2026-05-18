import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClubSiteTeamData } from "@/components/clubs/club-site";
import { resolveClubSiteFromRequestHost } from "@/lib/club-site-request";
import { buildClubSitePublicHref } from "@/lib/domain/club-sites";

export async function generateMetadata(): Promise<Metadata> {
  const { data } = await resolveClubSiteFromRequestHost();

  if (!data || !data.settings.sectionVisibility.teamData) {
    return {
      title: "Informacion",
      robots: {
        index: false,
        follow: false
      }
    };
  }

  return {
    title: { absolute: `Informacion - ${data.club.name}` },
    alternates: { canonical: buildClubSitePublicHref(data.club, data.settings, "/equipo") },
    robots: {
      index: true,
      follow: true
    }
  };
}

export default async function CustomDomainTeamDataPage() {
  const { data } = await resolveClubSiteFromRequestHost();
  if (!data || !data.settings.sectionVisibility.teamData) notFound();

  return <ClubSiteTeamData data={data} />;
}
