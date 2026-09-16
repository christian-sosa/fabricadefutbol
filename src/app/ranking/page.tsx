import { PublicGroupGrowthCta } from "@/components/groups/public-group-growth-cta";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { OrganizationPublicNav } from "@/components/layout/organization-public-nav";
import { RankingActionsRow } from "@/components/ranking/ranking-actions-row";
import { RankingTableQuery } from "@/components/ranking/ranking-table-query";
import { RankingTools } from "@/components/ranking/ranking-tools";
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
    <div className="space-y-4">
      <OrganizationPublicNav className="lg:hidden" currentPath="/ranking" organizationKey={selectedOrganization?.slug} season={selectedSeason} />
      <div className="space-y-3 md:space-y-5">
        <div className="space-y-2">
          <h1 className="text-2xl font-black tracking-tight text-white md:text-4xl">
            Ranking<span className="hidden md:inline">{selectedOrganization ? ` · ${selectedOrganization.name}` : ""}</span>
          </h1>
        </div>

        <RankingTools groupName={selectedOrganization?.name ?? "Elegir grupo"} period={selectedSeason === "all" ? "Histórico" : seasons.find((season) => selectedSeason === "current" ? season.status === "active" : season.id === selectedSeason)?.label ?? "Temporada actual"}>
        <OrganizationSwitcher
          pickerOnly
          basePath="/ranking"
          currentOrganizationSlug={selectedOrganization?.slug}
          label="Elegir grupo"
          organizations={organizations}
          quickOrganizations={viewerAdminOrganizations}
        />

        {selectedOrganization ? (
          <RankingActionsRow
            currentSeason={selectedSeason}
            groupName={selectedOrganization.name}
            organizationSlug={selectedOrganization.slug}
            rankingShareUrl={rankingShareUrl}
            seasons={seasons}
          />
        ) : null}
        </RankingTools>

        <RankingTableQuery
          initialPlayers={initialPlayers}
          organizationId={selectedOrganization?.id ?? null}
          season={selectedSeason}
        />

        <details className="text-sm text-slate-400">
          <summary className="flex min-h-11 cursor-pointer items-center">Cómo se ordena el ranking</summary>
          <p className="max-w-3xl pb-3">Primero se ordena por puntos de rendimiento; a igualdad de puntos, por más figuras en el período elegido. La figura del partido no suma puntos.</p>
        </details>

        <PublicGroupGrowthCta source="ranking_page" />
      </div>
    </div>
  );
}
