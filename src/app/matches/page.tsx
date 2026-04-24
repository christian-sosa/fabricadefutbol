import { AdPlaceholder } from "@/components/layout/ad-placeholder";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { MatchesHistoryQueryTable } from "@/components/matches/matches-history-query-table";
import { getMatchHistoryCardsPage, getViewerAdminOrganizations, resolvePublicOrganization } from "@/lib/queries/public";

export default async function MatchesPage({
  searchParams
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const [{ organizations, selectedOrganization }, viewerAdminOrganizations] = await Promise.all([
    resolvePublicOrganization(resolvedSearchParams.org),
    getViewerAdminOrganizations()
  ]);
  const initialMatchesData = await getMatchHistoryCardsPage(selectedOrganization?.id ?? null, {
    page: 1,
    pageSize: 10
  });

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

      <AdPlaceholder slot="matches-top" />

      <MatchesHistoryQueryTable
        initialData={initialMatchesData}
        initialPage={1}
        organizationId={selectedOrganization?.id ?? null}
        organizationSlug={selectedOrganization?.slug}
        pageSize={10}
      />
    </div>
  );
}
