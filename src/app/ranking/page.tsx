import { AdPlaceholder } from "@/components/layout/ad-placeholder";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { RankingTableQuery } from "@/components/ranking/ranking-table-query";
import { getViewerAdminOrganizations, resolvePublicOrganization } from "@/lib/queries/public";

export default async function RankingPage({
  searchParams
}: {
  searchParams: { org?: string };
}) {
  const [{ organizations, selectedOrganization }, viewerAdminOrganizations] = await Promise.all([
    resolvePublicOrganization(searchParams.org),
    getViewerAdminOrganizations()
  ]);

  return (
    <div className="-mx-4 min-h-[calc(100vh-6.5rem)] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-6 md:rounded-3xl md:border md:border-slate-800 md:p-8">
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-bold uppercase tracking-[0.28em] text-emerald-400">Tabla de Posiciones</p>
          <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">
            Ranking Actual {selectedOrganization ? `- ${selectedOrganization.name}` : ""}
          </h1>
        </div>

        <OrganizationSwitcher
          basePath="/ranking"
          currentOrganizationSlug={selectedOrganization?.slug}
          label="Elegir organizacion"
          organizations={organizations}
          quickOrganizations={viewerAdminOrganizations}
        />

        <AdPlaceholder slot="ranking-top" />

        <RankingTableQuery organizationId={selectedOrganization?.id ?? null} />

        <AdPlaceholder slot="ranking-bottom" />
      </div>
    </div>
  );
}
