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

type RankingTrend = "up" | "down" | "same";

const problemItems = [
  "Equipos desbalanceados",
  "Discusiones constantes",
  "No hay historial"
] as const;

const solutionItems = [
  "Equipos equilibrados automaticamente",
  "Ranking real",
  "Historial completo"
] as const;

const howItWorksSteps = [
  {
    title: "Paso 1",
    heading: "Crear grupo",
    description: "Abres tu grupo en minutos y dejas lista la base para organizar cada fecha."
  },
  {
    title: "Paso 2",
    heading: "Invitar jugadores",
    description: "Sumas a todo el plantel y ordenas el grupo para que cada partido tenga contexto real."
  },
  {
    title: "Paso 3",
    heading: "Armar partidos",
    description: "Convocas, equilibras equipos y dejas el partido listo sin discusiones eternas."
  },
  {
    title: "Paso 4",
    heading: "Ranking automatico",
    description: "Cargas el resultado y la plataforma actualiza posiciones, puntos e historial."
  }
] as const;

const testimonials = [
  {
    quote: "Desde que usamos Fabrica no discutimos mas los equipos. Llegamos, armamos y jugamos.",
    author: "Equipo La Quinta"
  },
  {
    quote: "El ranking le dio mucha mas seriedad al grupo. Ahora todos quieren subir puestos de verdad.",
    author: "Los del Jueves"
  },
  {
    quote: "Tener historial y partidos guardados nos ordeno todo. Ya no dependemos de la memoria del admin.",
    author: "Club del Martes"
  }
] as const;

const fallbackRankingPreview = [
  { name: "Mati", points: 1048, trend: "up" },
  { name: "Lucho", points: 1032, trend: "up" },
  { name: "Franco", points: 1015, trend: "same" },
  { name: "Nico", points: 998, trend: "down" },
  { name: "Tomi", points: 986, trend: "up" }
] as const satisfies ReadonlyArray<{
  name: string;
  points: number;
  trend: RankingTrend;
}>;

function getTrendMeta(trend: RankingTrend) {
  switch (trend) {
    case "up":
      return {
        icon: "↑",
        label: "Sube",
        className: "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
      };
    case "down":
      return {
        icon: "↓",
        label: "Baja",
        className: "border-rose-400/35 bg-rose-500/10 text-rose-200"
      };
    default:
      return {
        icon: "•",
        label: "Se mantiene",
        className: "border-slate-600 bg-slate-800 text-slate-200"
      };
  }
}

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
  const selectedOrganizationSlug = selectedOrganization?.slug ?? null;
  const featuredTournaments = tournaments.slice(0, 3);
  const trendPattern: RankingTrend[] = ["up", "up", "same", "down", "up"];

  const rankingPreviewRows = summary.topPlayers.length
    ? summary.topPlayers.slice(0, 5).map((player, index) => ({
        name: player.full_name,
        points: Math.round(Number(player.current_rating)),
        trend: trendPattern[index] ?? "same"
      }))
    : [...fallbackRankingPreview];

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-slate-800 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.2),transparent_34%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] p-6 shadow-[0_28px_70px_-38px_rgba(16,185,129,0.7)] md:p-8 lg:p-10">
        <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
              Futbol amateur sin discusiones
            </p>
            <h1 className="mt-3 max-w-4xl text-4xl font-black leading-tight text-white md:text-5xl lg:text-6xl">
              Deja de discutir equipos. Arma partidos equilibrados y lleva el ranking real de tu grupo.
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-300 md:text-lg">
              Organiza partidos, genera estadisticas y conoce quien es realmente el mejor.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_-18px_rgba(16,185,129,0.95)] transition hover:brightness-110"
                href="/admin/login"
              >
                Crear mi grupo gratis
              </Link>
              <Link
                className="rounded-xl border border-slate-700 bg-slate-950/70 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
                href="#ranking-preview"
              >
                Ver como funciona el ranking
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {[
                "Equipos equilibrados",
                "Ranking automatico",
                "Historial de partidos",
                "30 dias gratis"
              ].map((item) => (
                <span
                  className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-xs font-semibold text-slate-200"
                  key={item}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div>
            <Card className="border-emerald-400/20 bg-slate-950/70 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">KPI Visual</p>
                  <CardTitle className="mt-2 text-2xl">Ranking del grupo</CardTitle>
                  <CardDescription className="mt-2">
                    {selectedOrganization
                      ? `Vista previa basada en ${selectedOrganization.name}.`
                      : "Vista previa de como se ve un ranking real dentro de la plataforma."}
                  </CardDescription>
                </div>
                <div className="rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Partidos</p>
                  <p className="mt-1 text-2xl font-black text-white">{summary.totalFinishedMatches || 24}</p>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                {rankingPreviewRows.map((player, index) => {
                  const trend = getTrendMeta(player.trend);

                  return (
                    <div
                      className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-3 py-3"
                      key={`${player.name}-${index}`}
                    >
                      <span className="text-lg font-black text-slate-400">{index + 1}</span>
                      <span className="truncate text-sm font-semibold text-slate-100">{player.name}</span>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${trend.className}`}
                        title={trend.label}
                      >
                        {trend.icon}
                      </span>
                      <span className="text-sm font-semibold text-emerald-200">{player.points} pts</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="border-rose-400/15 bg-rose-500/5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-200">Problema</p>
          <CardTitle className="mt-2">Lo que pasa en casi todos los grupos</CardTitle>
          <div className="mt-4 space-y-3">
            {problemItems.map((item) => (
              <div className="flex items-center gap-3 rounded-2xl border border-rose-400/10 bg-slate-950/60 px-4 py-3" key={item}>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-400/30 bg-rose-500/10 text-sm font-black text-rose-200">
                  !
                </span>
                <span className="text-sm font-semibold text-slate-100">{item}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="border-emerald-400/15 bg-emerald-500/5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Solucion</p>
          <CardTitle className="mt-2">Lo que resuelve Fabrica de Futbol</CardTitle>
          <div className="mt-4 space-y-3">
            {solutionItems.map((item) => (
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/10 bg-slate-950/60 px-4 py-3" key={item}>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/10 text-sm font-black text-emerald-200">
                  +
                </span>
                <span className="text-sm font-semibold text-slate-100">{item}</span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Como funciona</p>
          <h2 className="mt-2 text-3xl font-black text-white">Empieza rapido y sin friccion</h2>
          <p className="mt-3 text-sm text-slate-300">
            El flujo esta pensado para que cualquier admin pueda arrancar hoy y que el grupo entienda el sistema desde el primer partido.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {howItWorksSteps.map((step) => (
            <Card key={step.heading}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">{step.title}</p>
              <CardTitle className="mt-2">{step.heading}</CardTitle>
              <CardDescription className="mt-3">{step.description}</CardDescription>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]" id="ranking-preview">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ranking real</p>
          <CardTitle className="mt-2 text-3xl">ELO simple, entendible y automatico</CardTitle>
          <CardDescription className="mt-3 text-base">
            Despues de cada partido, los jugadores ganan o pierden puntos segun el resultado.
          </CardDescription>
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-sm font-semibold text-white">Si ganas</p>
              <p className="mt-2 flex items-center gap-2 text-sm text-emerald-200">
                <span className="text-base font-black">↑</span>
                Subes puntos y mejoras tu posicion.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-sm font-semibold text-white">Si pierdes</p>
              <p className="mt-2 flex items-center gap-2 text-sm text-rose-200">
                <span className="text-base font-black">↓</span>
                Bajas puntos y se actualiza la tabla.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-sm font-semibold text-white">Si empatas</p>
              <p className="mt-2 text-sm text-slate-300">El sistema mantiene el equilibrio y deja todo registrado en el historial.</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Vista de ranking</p>
              <CardTitle className="mt-2">Posicion, flechas y puntos</CardTitle>
            </div>
            <Link
              className="text-sm font-semibold text-emerald-300 hover:underline"
              href={withOrgQuery("/ranking", selectedOrganizationSlug)}
            >
              Ver ranking publico
            </Link>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800">
            <div className="grid grid-cols-[72px_1fr_92px_92px] bg-slate-950/80 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              <span>Puesto</span>
              <span>Jugador</span>
              <span>Mov.</span>
              <span>Puntos</span>
            </div>
            <div className="divide-y divide-slate-800">
              {rankingPreviewRows.map((player, index) => {
                const trend = getTrendMeta(player.trend);

                return (
                  <div className="grid grid-cols-[72px_1fr_92px_92px] items-center bg-slate-900/80 px-4 py-3" key={`${player.name}-row`}>
                    <span className="text-sm font-black text-slate-300">#{index + 1}</span>
                    <span className="truncate text-sm font-semibold text-white">{player.name}</span>
                    <span className="text-sm font-semibold" title={trend.label}>
                      <span className={trend.className.replace("border ", "").replace("bg-slate-800 ", "")}>{trend.icon}</span>
                    </span>
                    <span className="text-sm font-semibold text-emerald-200">{player.points}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </section>

      <AdPlaceholder slot="home-top-banner" />

      <section className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Prueba real</p>
              <CardTitle className="mt-2">Explora una organizacion publica</CardTitle>
              <CardDescription className="mt-2">
                Mira como se ve un grupo real con jugadores, ranking, historial y proximos partidos.
              </CardDescription>
            </div>
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
                  <p className="mt-2 text-2xl font-black text-white">{summary.totalPlayers}</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Partidos jugados</p>
                  <p className="mt-2 text-2xl font-black text-white">{summary.totalFinishedMatches}</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Proximos</p>
                  <p className="mt-2 text-2xl font-black text-white">{summary.upcomingMatches.length}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
                  href={withOrgQuery("/ranking", selectedOrganization.slug)}
                >
                  Ver ranking
                </Link>
                <Link
                  className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
                  href={withOrgQuery("/matches", selectedOrganization.slug)}
                >
                  Ver historial
                </Link>
                <Link
                  className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
                  href={withOrgQuery("/upcoming", selectedOrganization.slug)}
                >
                  Ver proximos partidos
                </Link>
              </div>
            </>
          ) : (
            <CardDescription className="mt-4">
              Todavia no hay organizaciones publicas cargadas. Cuando aparezcan, vas a poder explorarlas desde aqui.
            </CardDescription>
          )}
        </Card>

        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Top actual</p>
          <CardTitle className="mt-2">
            {selectedOrganization ? `Los que marcan el ritmo en ${selectedOrganization.name}` : "Ranking destacado"}
          </CardTitle>
          <div className="mt-4 space-y-2">
            {summary.topPlayers.length ? (
              summary.topPlayers.map((player, index) => (
                <div
                  className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-3"
                  key={player.id}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="text-sm font-black text-slate-500">#{index + 1}</span>
                    <PlayerAvatar name={player.full_name} playerId={player.id} size="sm" />
                    <span className="truncate text-sm font-semibold text-white">{player.full_name}</span>
                  </div>
                  <span className="text-sm font-semibold text-emerald-200">
                    {Math.round(Number(player.current_rating))} pts
                  </span>
                </div>
              ))
            ) : (
              rankingPreviewRows.map((player, index) => (
                <div
                  className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-3"
                  key={`${player.name}-fallback`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-slate-500">#{index + 1}</span>
                    <span className="text-sm font-semibold text-white">{player.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-emerald-200">{player.points} pts</span>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-sm font-semibold text-white">Lo que gana tu grupo</p>
            <p className="mt-2 text-sm text-slate-300">
              Menos discusiones, mejor organizacion y una referencia objetiva para ver quien sube y quien baja fecha a fecha.
            </p>
          </div>
        </Card>
      </section>

      {summary.upcomingMatches.length ? (
        <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Proximo partido</p>
            <CardTitle className="mt-2">Tu grupo tambien queda ordenado fecha a fecha</CardTitle>
            <CardDescription className="mt-3">
              Cada convocatoria y cada resultado quedan registrados para que no se pierda el hilo del grupo.
            </CardDescription>
          </Card>
          <Card>
            <div className="space-y-2">
              {summary.upcomingMatches.map((match) => (
                <Link
                  className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm transition hover:border-slate-600 hover:bg-slate-900"
                  href={withOrgQuery(`/matches/${match.id}`, selectedOrganizationSlug)}
                  key={match.id}
                >
                  <span>
                    {match.modality} - {formatDateTime(match.scheduled_at)}
                  </span>
                  <span className="font-semibold text-emerald-300">Ver detalle</span>
                </Link>
              ))}
            </div>
          </Card>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Testimonios</p>
          <h2 className="mt-2 text-3xl font-black text-white">Lo que pasa cuando el grupo se ordena</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <Card key={testimonial.author}>
              <p className="text-base leading-7 text-slate-200">
                &ldquo;{testimonial.quote}&rdquo;
              </p>
              <p className="mt-4 text-sm font-semibold text-emerald-300">{testimonial.author}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.02fr_0.98fr]">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Tambien para ligas</p>
          <CardTitle className="mt-2">Cuando tu grupo crece, tambien puedes lanzar torneos</CardTitle>
          <CardDescription className="mt-3">
            Equipos, fixture, resultados, figuras, goleadores y acceso para capitanes dentro de un modulo separado.
          </CardDescription>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
              href={withPublicQuery("/tournaments", {
                organizationKey: selectedOrganizationSlug,
                module: "tournaments"
              })}
            >
              Ver torneos
            </Link>
            <Link
              className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
              href={withPublicQuery("/pricing", {
                organizationKey: selectedOrganizationSlug,
                module: "tournaments"
              })}
            >
              Ver precios del modulo
            </Link>
          </div>
        </Card>

        <div className="space-y-3">
          {featuredTournaments.length ? (
            featuredTournaments.map((tournament) => (
              <Link
                className="block rounded-2xl border border-slate-800 bg-slate-900/80 p-4 transition hover:border-slate-600 hover:bg-slate-900"
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
              </Link>
            ))
          ) : (
            <Card>
              <CardDescription>
                El modulo Torneos ya esta listo para mostrar ligas y competiciones publicas cuando se publiquen.
              </CardDescription>
            </Card>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Soporte</p>
          <CardTitle className="mt-2 text-3xl">Necesitas ayuda?</CardTitle>
          <CardDescription className="mt-3">
            Te acompanamos para que pongas tu grupo en marcha sin perder tiempo ni datos.
          </CardDescription>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
              href={withPublicQuery("/feedback", {
                organizationKey: selectedOrganizationSlug
              })}
            >
              Ir a contacto
            </Link>
            <Link
              className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
              href="mailto:info@fabricadefutbol.com.ar"
            >
              Escribir por mail
            </Link>
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardTitle className="text-base">WhatsApp</CardTitle>
            <CardDescription className="mt-2">
              Canal en configuracion. Mientras tanto, respondemos rapido por mail y formulario.
            </CardDescription>
          </Card>
          <Card>
            <CardTitle className="text-base">Mail</CardTitle>
            <CardDescription className="mt-2">
              info@fabricadefutbol.com.ar
            </CardDescription>
          </Card>
          <Card>
            <CardTitle className="text-base">Confianza</CardTitle>
            <CardDescription className="mt-2">
              Soporte humano para admins, grupos y organizadores. Te ayudamos a ordenar el flujo sin romper lo que ya usas.
            </CardDescription>
          </Card>
        </div>
      </section>

      <AdPlaceholder slot="home-bottom-banner" />

      <section className="rounded-[2rem] border border-emerald-400/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.14),rgba(15,23,42,0.98))] p-6 text-center shadow-[0_24px_60px_-38px_rgba(16,185,129,0.75)] md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">CTA final</p>
        <h2 className="mt-3 text-3xl font-black text-white md:text-4xl">Empezar gratis</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-200 md:text-base">
          Crea tu grupo, arma partidos equilibrados y empieza a construir un ranking que de verdad represente lo que pasa en la cancha.
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-95"
            href="/admin/login"
          >
            Empezar gratis
          </Link>
        </div>
      </section>
    </div>
  );
}
