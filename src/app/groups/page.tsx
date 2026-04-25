import Link from "next/link";

import { OrganizationImage } from "@/components/groups/organization-image";
import { AdPlaceholder } from "@/components/layout/ad-placeholder";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { formatMatchDateTime } from "@/lib/match-datetime";
import { getOrganizationImageUrl } from "@/lib/organization-images";
import { withOrgQuery } from "@/lib/org";
import { getHomeSummary, getViewerAdminOrganizations, resolvePublicOrganization } from "@/lib/queries/public";

export default async function GroupsPage({
  searchParams
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const [{ organizations, selectedOrganization }, viewerAdminOrganizations] = await Promise.all([
    resolvePublicOrganization(resolvedSearchParams.org, { defaultContext: "home" }),
    getViewerAdminOrganizations()
  ]);
  const summary = await getHomeSummary(selectedOrganization?.id ?? null);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-800 bg-slate-900/75 p-5 shadow-[0_24px_40px_-30px_rgba(16,185,129,0.7)] md:p-8">
        <h1 className="mt-2 text-3xl font-black text-slate-100 md:text-5xl">Grupos</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-300 md:text-base">
          Elige un grupo y recorre su ranking, historial y agenda confirmada desde un solo lugar.
        </p>

        <div className="mt-6">
          <OrganizationSwitcher
            basePath="/groups"
            currentOrganizationSlug={selectedOrganization?.slug}
            label="Grupos publicos"
            organizations={organizations}
            quickOrganizations={viewerAdminOrganizations}
          />
        </div>
      </section>

      <AdPlaceholder slot="organizations-top" />

      {selectedOrganization ? (
        <>
          <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <Card className="overflow-hidden p-0">
              <div className="relative">
                <OrganizationImage
                  alt={`Imagen de ${selectedOrganization.name}`}
                  className="aspect-[16/9] min-h-[260px] rounded-none border-0"
                  priority
                  src={getOrganizationImageUrl(selectedOrganization.id)}
                />
                <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
                  <h2 className="text-2xl font-black text-white md:text-4xl">{selectedOrganization.name}</h2>
                </div>
              </div>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <Card>
                <CardDescription>Jugadores activos</CardDescription>
                <CardTitle className="mt-1 text-3xl">{summary.totalPlayers}</CardTitle>
              </Card>
              <Card>
                <CardDescription>Partidos finalizados</CardDescription>
                <CardTitle className="mt-1 text-3xl">{summary.totalFinishedMatches}</CardTitle>
              </Card>
            </div>
          </section>

          <p className="max-w-3xl text-sm text-slate-300 md:text-base">
            Un vistazo rapido para entrar al grupo, ver quienes vienen arriba y seguir las fechas que ya quedaron confirmadas.
          </p>

          <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <Card>
              <CardTitle>Top jugadores</CardTitle>
              <CardDescription className="mt-2">
                Vista rapida del rendimiento actual de {selectedOrganization.name}.
              </CardDescription>
              <div className="mt-4 space-y-2">
                {summary.topPlayers.length ? (
                  summary.topPlayers.map((player, index) => (
                    <div
                      className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
                      key={player.id}
                    >
                      <div className="flex items-center gap-3">
                        <PlayerAvatar name={player.full_name} playerId={player.id} size="sm" />
                        <span>
                          #{index + 1} {player.full_name}
                        </span>
                      </div>
                      <span className="font-semibold text-emerald-300">{Number(player.current_rating).toFixed(2)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">Todavia no hay jugadores activos cargados.</p>
                )}
              </div>
            </Card>

            <Card>
              <CardTitle>Lo que viene</CardTitle>
              <CardDescription className="mt-2">
                Los partidos ya confirmados para {selectedOrganization.name}.
              </CardDescription>
              <div className="mt-4 space-y-2">
                {summary.upcomingMatches.length ? (
                  summary.upcomingMatches.map((match) => (
                    <Link
                      className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm transition hover:border-slate-600 hover:bg-slate-800"
                      href={withOrgQuery(`/matches/${match.id}`, selectedOrganization.slug)}
                      key={match.id}
                      >
                        <span>
                          {match.modality} - {formatMatchDateTime(match.scheduled_at)}
                      </span>
                      <span className="font-semibold text-emerald-300">Ver detalle</span>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">No hay partidos confirmados por ahora.</p>
                )}
              </div>
            </Card>
          </section>
        </>
      ) : (
        <Card>
          <CardTitle>No hay grupos publicos cargados</CardTitle>
          <CardDescription>
            Cuando exista al menos un grupo publico, desde aqui vas a poder navegar todo su contenido.
          </CardDescription>
        </Card>
      )}

      <AdPlaceholder slot="organizations-bottom" />
    </div>
  );
}
