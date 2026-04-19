import { AdPlaceholder } from "@/components/layout/ad-placeholder";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { PlayersStatsTable } from "@/components/players/players-stats-table";
import { Card } from "@/components/ui/card";
import { getPlayersWithStats, getViewerAdminOrganizations, resolvePublicOrganization } from "@/lib/queries/public";

export default async function PlayersPage({
  searchParams
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const [{ organizations, selectedOrganization }, viewerAdminOrganizations] = await Promise.all([
    resolvePublicOrganization(resolvedSearchParams.org),
    getViewerAdminOrganizations()
  ]);
  const players = await getPlayersWithStats(selectedOrganization?.id ?? null);

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black text-slate-100">
        Jugadores {selectedOrganization ? `- ${selectedOrganization.name}` : ""}
      </h1>

      <OrganizationSwitcher
        basePath="/players"
        currentOrganizationSlug={selectedOrganization?.slug}
        label="Elegir organizacion"
        organizations={organizations}
        quickOrganizations={viewerAdminOrganizations}
      />

      <AdPlaceholder slot="players-top" />

      <Card>
        <PlayersStatsTable players={players} />
      </Card>
    </div>
  );
}
