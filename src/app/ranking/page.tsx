import { GroupShareActions } from "@/components/groups/group-share-actions";
import { PublicGroupGrowthCta } from "@/components/groups/public-group-growth-cta";
import { SeasonFilterLinks } from "@/components/groups/season-filter-links";
import { OrganizationPublicNav } from "@/components/layout/organization-public-nav";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { RankingTableQuery } from "@/components/ranking/ranking-table-query";
import { withShareTracking } from "@/lib/growth";
import { withOrgQuery } from "@/lib/org";
import { buildAbsolutePublicUrl } from "@/lib/public-url";
import {
  getOrganizationSeasons,
  getPlayersWithStats,
  getViewerAdminOrganizations,
  resolvePublicOrganization
} from "@/lib/queries/public";

export default async function RankingPage({
  searchParams
}: {
  searchParams: Promise<{ org?: string; season?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const selectedSeason = resolvedSearchParams.season ?? "current";
  const [{ organizations, selectedOrganization }, viewerAdminOrganizations] = await Promise.all([
    resolvePublicOrganization(resolvedSearchParams.org, { defaultContext: "ranking" }),
    getViewerAdminOrganizations()
  ]);
  const [initialPlayers, seasons] = await Promise.all([
    getPlayersWithStats(selectedOrganization?.id ?? null, { season: selectedSeason }),
    getOrganizationSeasons(selectedOrganization?.id ?? null)
  ]);
  const rankingShareUrl = selectedOrganization
    ? buildAbsolutePublicUrl(withShareTracking(withOrgQuery("/ranking", selectedOrganization.slug), "ranking"))
    : null;

  return (
    <div className="-mx-4 min-h-[calc(100vh-6.5rem)] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-6 md:rounded-3xl md:border md:border-slate-800 md:p-8">
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-bold uppercase tracking-[0.28em] text-emerald-400">Tabla de Posiciones</p>
          <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">
            Ranking Actual {selectedOrganization ? `- ${selectedOrganization.name}` : ""}
          </h1>
          <p className="max-w-3xl text-sm text-slate-300 md:text-base">
            Puesto actual, rendimiento y estadisticas completas de cada jugador en una sola vista.
          </p>
        </div>

        <OrganizationSwitcher
          basePath="/ranking"
          currentOrganizationSlug={selectedOrganization?.slug}
          label="Elegir grupo"
          organizations={organizations}
          quickOrganizations={viewerAdminOrganizations}
        />

        {selectedOrganization ? (
          <SeasonFilterLinks
            basePath="/ranking"
            currentSeason={selectedSeason}
            organizationSlug={selectedOrganization.slug}
            seasons={seasons}
          />
        ) : null}

        {selectedOrganization ? (
          <GroupShareActions
            groupName={selectedOrganization.name}
            rankingUrl={rankingShareUrl ?? undefined}
            source="ranking_page"
          />
        ) : null}

        {selectedOrganization ? (
          <section className="lg:hidden">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
              <OrganizationPublicNav
                className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                currentPath="/ranking"
                itemClassName="flex min-h-10 items-center justify-center px-2 py-2 text-center"
                organizationKey={selectedOrganization.slug}
              />
            </div>
          </section>
        ) : null}

        <RankingTableQuery
          initialPlayers={initialPlayers}
          organizationId={selectedOrganization?.id ?? null}
          season={selectedSeason}
        />

        <PublicGroupGrowthCta source="ranking_page" />
      </div>
    </div>
  );
}
