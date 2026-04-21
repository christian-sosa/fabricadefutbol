import Link from "next/link";

import { AdPlaceholder } from "@/components/layout/ad-placeholder";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { withOrgQuery } from "@/lib/org";
import { getHomeSummary, getViewerAdminOrganizations, resolvePublicOrganization } from "@/lib/queries/public";
import { formatDateTime } from "@/lib/utils";

const organizationModuleLinks = [
  {
    href: "/ranking",
    title: "Ranking",
    description: "Tabla completa de rendimiento y posiciones actuales."
  },
  {
    href: "/players",
    title: "Jugadores",
    description: "Plantel, foto y estadisticas resumidas por jugador."
  },
  {
    href: "/matches",
    title: "Historial",
    description: "Resultados ya jugados con detalle de cada encuentro."
  },
  {
    href: "/upcoming",
    title: "Proximos",
    description: "Fechas confirmadas, convocados y detalle del partido."
  }
] as const;

export default async function OrganizationsPage({
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
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">Modulo publico</p>
        <h1 className="mt-2 text-3xl font-black text-slate-100 md:text-5xl">Organizaciones</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-300 md:text-base">
          Elegi una organizacion y navega su ranking, jugadores, historial y proximos partidos desde un solo lugar.
        </p>

        <div className="mt-6">
          <OrganizationSwitcher
            basePath="/organizations"
            currentOrganizationSlug={selectedOrganization?.slug}
            label="Organizaciones publicas"
            organizations={organizations}
            quickOrganizations={viewerAdminOrganizations}
          />
        </div>
      </section>

      <AdPlaceholder slot="organizations-top" />

      {selectedOrganization ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardDescription>Organizacion activa</CardDescription>
              <CardTitle className="mt-1 text-2xl md:text-3xl">{selectedOrganization.name}</CardTitle>
            </Card>
            <Card>
              <CardDescription>Jugadores activos</CardDescription>
              <CardTitle className="mt-1 text-3xl">{summary.totalPlayers}</CardTitle>
            </Card>
            <Card>
              <CardDescription>Partidos finalizados</CardDescription>
              <CardTitle className="mt-1 text-3xl">{summary.totalFinishedMatches}</CardTitle>
            </Card>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {organizationModuleLinks.map((item) => (
              <Card key={item.href}>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription className="mt-2">{item.description}</CardDescription>
                <Link
                  className="mt-4 inline-flex text-sm font-semibold text-emerald-300 hover:underline"
                  href={withOrgQuery(item.href, selectedOrganization.slug)}
                >
                  Abrir {item.title.toLowerCase()}
                </Link>
              </Card>
            ))}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
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
              <CardTitle>Proximos confirmados</CardTitle>
              <CardDescription className="mt-2">
                Acceso rapido a los partidos ya programados de la organizacion.
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
                        {match.modality} - {formatDateTime(match.scheduled_at)}
                      </span>
                      <span className="font-semibold text-emerald-300">Ver detalle</span>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">No hay partidos confirmados proximos.</p>
                )}
              </div>
            </Card>
          </section>
        </>
      ) : (
        <Card>
          <CardTitle>No hay organizaciones publicas cargadas</CardTitle>
          <CardDescription>
            Cuando exista al menos una organizacion publica, desde aqui vas a poder navegar todo su contenido.
          </CardDescription>
        </Card>
      )}

      <AdPlaceholder slot="organizations-bottom" />
    </div>
  );
}
