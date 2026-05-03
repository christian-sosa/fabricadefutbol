import { PublicGroupGrowthCta } from "@/components/groups/public-group-growth-cta";
import { SeasonFilterLinks } from "@/components/groups/season-filter-links";
import { OrganizationPublicNav } from "@/components/layout/organization-public-nav";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { MatchesHistoryQueryTable } from "@/components/matches/matches-history-query-table";
import {
  getMatchHistoryCardsPage,
  getOrganizationSeasons,
  getViewerAdminOrganizations,
  resolvePublicOrganization
} from "@/lib/queries/public";

export default async function MatchesPage({
  searchParams
}: {
  searchParams: Promise<{ org?: string; season?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const selectedSeason = resolvedSearchParams.season ?? "current";
  const [{ organizations, selectedOrganization }, viewerAdminOrganizations] = await Promise.all([
    resolvePublicOrganization(resolvedSearchParams.org),
    getViewerAdminOrganizations()
  ]);
  const [initialMatchesData, seasons] = await Promise.all([
    getMatchHistoryCardsPage(selectedOrganization?.id ?? null, {
      page: 1,
      pageSize: 10,
      season: selectedSeason
    }),
    getOrganizationSeasons(selectedOrganization?.id ?? null)
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black text-slate-100">
        Historial de Partidos {selectedOrganization ? `- ${selectedOrganization.name}` : ""}
      </h1>

      <OrganizationSwitcher
        basePath="/matches"
        currentOrganizationSlug={selectedOrganization?.slug}
        label="Elegir grupo"
        organizations={organizations}
        quickOrganizations={viewerAdminOrganizations}
      />

      {selectedOrganization ? (
        <SeasonFilterLinks
          basePath="/matches"
          currentSeason={selectedSeason}
          organizationSlug={selectedOrganization.slug}
          seasons={seasons}
        />
      ) : null}

      {selectedOrganization ? (
        <section className="lg:hidden">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
            <OrganizationPublicNav
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              currentPath="/matches"
              itemClassName="flex min-h-10 items-center justify-center px-2 py-2 text-center"
              organizationKey={selectedOrganization.slug}
            />
          </div>
        </section>
      ) : null}

      <MatchesHistoryQueryTable
        initialData={initialMatchesData}
        initialPage={1}
        organizationId={selectedOrganization?.id ?? null}
        organizationSlug={selectedOrganization?.slug}
        pageSize={10}
        season={selectedSeason}
      />

      <PublicGroupGrowthCta source="matches_page" />
    </div>
  );
}
