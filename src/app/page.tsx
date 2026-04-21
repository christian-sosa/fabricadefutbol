import Link from "next/link";

import { AdPlaceholder } from "@/components/layout/ad-placeholder";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { TournamentStatusBadge } from "@/components/tournaments/tournament-badges";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { withOrgQuery, withPublicQuery } from "@/lib/org";
import { getHomeSummary, getViewerAdminOrganizations, resolvePublicOrganization } from "@/lib/queries/public";
import { getPublicTournaments } from "@/lib/queries/tournaments";
import { formatDateTime } from "@/lib/utils";

export default async function HomePage({
  searchParams
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const [{ organizations, selectedOrganization }, viewerAdminOrganizations, tournaments] = await Promise.all([
    resolvePublicOrganization(resolvedSearchParams.org, { defaultContext: "home" }),
    getViewerAdminOrganizations(),
    getPublicTournaments()
  ]);
  const summary = await getHomeSummary(selectedOrganization?.id ?? null);
  const featuredTournaments = tournaments.slice(0, 4);
  const selectedOrganizationSlug = selectedOrganization?.slug ?? null;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-800 bg-slate-900/75 p-5 shadow-[0_24px_40px_-30px_rgba(16,185,129,0.7)] md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">Futbol amateur, ordenado</p>
        <h1 className="mt-2 text-3xl font-black text-slate-100 md:text-5xl">
          Organizaciones para tu grupo. Torneos para tu competencia.
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-300 md:text-base">
          Fabrica de Futbol ahora trabaja con dos modulos separados: Organizaciones para partidos balanceados y ranking,
          y Torneos para ligas, equipos, fixture, capitanes y estadisticas publicas.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Organizaciones</p>
            <p className="mt-2 text-3xl font-black text-slate-100">{organizations.length}</p>
            <p className="mt-1 text-sm text-slate-400">Publicas y listas para consultar.</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Torneos</p>
            <p className="mt-2 text-3xl font-black text-slate-100">{tournaments.length}</p>
            <p className="mt-1 text-sm text-slate-400">Competiciones independientes publicadas.</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Organizacion destacada</p>
            <p className="mt-2 text-xl font-black text-slate-100">{selectedOrganization?.name ?? "Sin seleccion"}</p>
            <p className="mt-1 text-sm text-slate-400">
              {selectedOrganization
                ? `${summary.totalFinishedMatches} partidos finalizados publicados.`
                : "Crea la primera organizacion para empezar."}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_-14px_rgba(16,185,129,1)]"
            href={withPublicQuery("/organizations", {
              organizationKey: selectedOrganizationSlug,
              module: "organizations"
            })}
          >
            Explorar organizaciones
          </Link>
          <Link
            className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
            href={withPublicQuery("/tournaments", {
              organizationKey: selectedOrganizationSlug,
              module: "tournaments"
            })}
          >
            Explorar torneos
          </Link>
          <Link
            className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
            href={withPublicQuery("/pricing", {
              organizationKey: selectedOrganizationSlug
            })}
          >
            Ver precios
          </Link>
          <Link
            className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
            href={withPublicQuery("/help", {
              organizationKey: selectedOrganizationSlug
            })}
          >
            Ayuda / FAQ
          </Link>
        </div>
      </section>

      <AdPlaceholder slot="home-top-banner" />

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Modulo Organizaciones</CardTitle>
              <CardDescription className="mt-1">
                Elige una organizacion publica para ver su ranking, jugadores, historial y proximos partidos.
              </CardDescription>
            </div>
            <Link
              className="text-sm font-semibold text-emerald-300 hover:underline"
              href={withPublicQuery("/organizations", {
                organizationKey: selectedOrganizationSlug,
                module: "organizations"
              })}
            >
              Ver modulo
            </Link>
          </div>

          <div className="mt-4">
            <OrganizationSwitcher
              basePath="/"
              currentOrganizationSlug={selectedOrganization?.slug}
              label="Organizaciones publicas"
              organizations={organizations}
              quickOrganizations={viewerAdminOrganizations}
            />
          </div>

          {selectedOrganization ? (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Jugadores activos</p>
                  <p className="mt-2 text-2xl font-black text-slate-100">{summary.totalPlayers}</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Partidos cerrados</p>
                  <p className="mt-2 text-2xl font-black text-slate-100">{summary.totalFinishedMatches}</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Proximos partidos</p>
                  <p className="mt-2 text-2xl font-black text-slate-100">{summary.upcomingMatches.length}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
                  href={withOrgQuery("/ranking", selectedOrganization.slug)}
                >
                  Ver ranking
                </Link>
                <Link
                  className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
                  href={withOrgQuery("/upcoming", selectedOrganization.slug)}
                >
                  Ver proximos partidos
                </Link>
              </div>
            </>
          ) : (
            <CardDescription className="mt-4">
              No hay organizaciones publicas cargadas todavia. Ingresa al panel y crea la primera para empezar a
              publicar datos.
            </CardDescription>
          )}
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Modulo Torneos</CardTitle>
              <CardDescription className="mt-1">
                Ligas y torneos con equipos propios, fixture, tabla, goleadores, figuras y detalle de partidos.
              </CardDescription>
            </div>
            <Link
              className="text-sm font-semibold text-emerald-300 hover:underline"
              href={withPublicQuery("/tournaments", {
                organizationKey: selectedOrganizationSlug,
                module: "tournaments"
              })}
            >
              Ver modulo
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {featuredTournaments.length ? (
              featuredTournaments.map((tournament) => (
                <Link
                  className="block rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-slate-600 hover:bg-slate-900"
                  href={`/tournaments/${tournament.slug}`}
                  key={tournament.id}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">{tournament.name}</CardTitle>
                    <TournamentStatusBadge status={tournament.status} />
                  </div>
                  <CardDescription className="mt-2">
                    {tournament.seasonLabel} - {tournament.description || "Competencia publica disponible para consultar."}
                  </CardDescription>
                  <p className="mt-3 text-sm font-semibold text-emerald-300">Abrir torneo</p>
                </Link>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-4">
                <p className="text-sm text-slate-400">Todavia no hay torneos publicos cargados.</p>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
              href={withPublicQuery("/pricing", {
                organizationKey: selectedOrganizationSlug,
                module: "tournaments"
              })}
            >
              Ver precios del modulo
            </Link>
            <Link
              className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
              href={withPublicQuery("/help", {
                organizationKey: selectedOrganizationSlug,
                module: "tournaments"
              })}
            >
              Como funciona Torneos
            </Link>
          </div>
        </Card>
      </section>

      {selectedOrganization ? (
        <section className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardTitle>Top 5 - {selectedOrganization.name}</CardTitle>
            <div className="mt-3 space-y-2">
              {summary.topPlayers.map((player, index) => (
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
              ))}
            </div>
          </Card>
          <Card>
            <CardTitle>Proximas Fechas Confirmadas</CardTitle>
            <div className="mt-3 space-y-2">
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
      ) : null}

      <AdPlaceholder slot="home-bottom-banner" />
    </div>
  );
}
