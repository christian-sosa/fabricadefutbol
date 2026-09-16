import { PublicGroupGrowthCta } from "@/components/groups/public-group-growth-cta";
import { SeasonFilterLinks } from "@/components/groups/season-filter-links";
import { OrganizationPublicNav } from "@/components/layout/organization-public-nav";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { MatchesHistoryQueryTable } from "@/components/matches/matches-history-query-table";
import { parseMatchHistoryPage, parseMatchHistorySeason } from "@/lib/match-history-navigation";
import {
  getMatchHistoryCardsPage,
  getOrganizationSeasons,
  getViewerAdminOrganizations,
  resolvePublicOrganization
} from "@/lib/queries/public";

export default async function MatchesPage({
  searchParams
}: {
  searchParams: Promise<{ org?: string; season?: string; page?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const selectedSeason = parseMatchHistorySeason(resolvedSearchParams.season);
  const selectedPage = parseMatchHistoryPage(resolvedSearchParams.page);
  const [{ organizations, selectedOrganization }, viewerAdminOrganizations] = await Promise.all([
    resolvePublicOrganization(resolvedSearchParams.org),
    getViewerAdminOrganizations()
  ]);
  const [initialMatchesData, seasons] = await Promise.all([
    getMatchHistoryCardsPage(selectedOrganization?.id ?? null, {
      page: selectedPage,
      pageSize: 10,
      season: selectedSeason
    }),
    getOrganizationSeasons(selectedOrganization?.id ?? null)
  ]);
  const groupSwitcher = <OrganizationSwitcher
    basePath="/matches"
    currentOrganizationSlug={selectedOrganization?.slug}
    label="Elegir grupo"
    organizations={organizations}
    pickerOnly={Boolean(selectedOrganization)}
    quickOrganizations={viewerAdminOrganizations}
  />;

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <h1 className="text-2xl font-black text-slate-100 sm:text-3xl">Historial de partidos</h1>
        {selectedOrganization ? (
          <details className="rounded-xl border border-slate-800 px-3">
            <summary className="min-h-11 cursor-pointer content-center text-sm text-slate-300"><span className="font-semibold text-slate-100">{selectedOrganization.name}</span> · Cambiar grupo</summary>
            <div className="pb-3 pt-1">{groupSwitcher}</div>
          </details>
        ) : groupSwitcher}
        {selectedOrganization ? <OrganizationPublicNav className="lg:hidden" currentPath="/matches" organizationKey={selectedOrganization.slug} season={selectedSeason} /> : null}
      </header>

      {selectedOrganization ? (
        <SeasonFilterLinks
          basePath="/matches"
          currentSeason={selectedSeason}
          organizationSlug={selectedOrganization.slug}
          seasons={seasons}
        />
      ) : null}

      <MatchesHistoryQueryTable
        initialData={initialMatchesData}
        initialPage={selectedPage}
        organizationId={selectedOrganization?.id ?? null}
        organizationSlug={selectedOrganization?.slug}
        pageSize={10}
        season={selectedSeason}
      />

      <PublicGroupGrowthCta source="matches_page" />
    </div>
  );
}
