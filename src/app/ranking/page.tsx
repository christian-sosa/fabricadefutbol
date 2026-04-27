import { AdPlaceholder } from "@/components/layout/ad-placeholder";
import { OrganizationPublicNav } from "@/components/layout/organization-public-nav";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { RankingTableQuery } from "@/components/ranking/ranking-table-query";
import { getPlayersWithStats, getViewerAdminOrganizations, resolvePublicOrganization } from "@/lib/queries/public";

export default async function RankingPage({
  searchParams
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const [{ organizations, selectedOrganization }, viewerAdminOrganizations] = await Promise.all([
    resolvePublicOrganization(resolvedSearchParams.org, { defaultContext: "ranking" }),
    getViewerAdminOrganizations()
  ]);
  const initialPlayers = await getPlayersWithStats(selectedOrganization?.id ?? null);

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

        <AdPlaceholder slot="ranking-top" />

        <RankingTableQuery initialPlayers={initialPlayers} organizationId={selectedOrganization?.id ?? null} />

        <AdPlaceholder slot="ranking-bottom" />
      </div>
    </div>
  );
}
