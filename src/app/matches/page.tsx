import { AdPlaceholder } from "@/components/layout/ad-placeholder";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { MatchesHistoryQueryTable } from "@/components/matches/matches-history-query-table";
import { getViewerAdminOrganizations, resolvePublicOrganization } from "@/lib/queries/public";

export default async function MatchesPage({
  searchParams
}: {
  searchParams: { org?: string };
}) {
  const [{ organizations, selectedOrganization }, viewerAdminOrganizations] = await Promise.all([
    resolvePublicOrganization(searchParams.org),
    getViewerAdminOrganizations()
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black text-slate-100">
        Historial de Partidos {selectedOrganization ? `- ${selectedOrganization.name}` : ""}
      </h1>

      <OrganizationSwitcher
        basePath="/matches"
        currentOrganizationSlug={selectedOrganization?.slug}
        label="Elegir organizacion"
        organizations={organizations}
        quickOrganizations={viewerAdminOrganizations}
      />

      <AdPlaceholder slot="matches-top" />

      <MatchesHistoryQueryTable
        organizationId={selectedOrganization?.id ?? null}
        organizationSlug={selectedOrganization?.slug}
      />
    </div>
  );
}
