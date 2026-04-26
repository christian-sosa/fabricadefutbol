import Link from "next/link";

import { AdPlaceholder } from "@/components/layout/ad-placeholder";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { LeagueLogo } from "@/components/tournaments/league-logo";
import { TournamentStatusBadge } from "@/components/tournaments/tournament-badges";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { formatMatchDateTime } from "@/lib/match-datetime";
import { withOrgQuery, withPublicQuery } from "@/lib/org";
import { getHomeSummary, getViewerAdminOrganizations, resolvePublicOrganization } from "@/lib/queries/public";
import { getPublicLeagues } from "@/lib/queries/tournaments";
import { formatRendimiento } from "@/lib/utils";

const heroHighlights = [
  "Equipos parejos",
  "Rendimiento automatico",
  "Historial publico",
  "Torneos y competencias"
] as const;

const groupFeatures = [
  {
    title: "Niveles simples",
    description:
      "El admin define un nivel base del 1 al 5. No hace falta mantener formulas raras ni rankings manuales."
  },
  {
    title: "Equipos equilibrados",
    description:
      "La app combina nivel, rendimiento actual, invitados y arqueros para proponer equipos mas justos."
  },
  {
    title: "Historial vivo",
    description:
      "Cada resultado actualiza rendimiento, ranking, estadisticas y detalle del partido para que nada dependa de la memoria."
  }
] as const;

const tournamentFeatures = [
  {
    title: "Liga como base",
    description:
      "La liga guarda equipos maestros, admins, sede, logo y foto publica. Desde ahi nacen las competencias."
  },
  {
    title: "Competencias publicas",
    description:
      "Cada competencia queda visible para visitantes cuando esta activa o finalizada, con tabla, fixture y resultados."
  },
  {
    title: "Operacion flexible",
    description:
      "Puedes usar fixture automatico o manual, capitanes opcionales y carga completa o simplificada de actas."
  }
] as const;

const workflowCards = [
  {
    title: "1. Cargas la base",
    description:
      "En Grupos cargas jugadores y niveles. En Torneos cargas liga, equipos maestros y competencias."
  },
  {
    title: "2. Organizas la fecha",
    description:
      "Armas partido, fixture o cruce. La app ordena la informacion y deja links claros para compartir."
  },
  {
    title: "3. Publicas resultados",
    description:
      "Cargas marcador y datos del partido. El ranking, tablas, historial y estadisticas se actualizan solos."
  }
] as const;

const exampleRankingPreview = [
  { name: "Jugador 1", rendimiento: 1030 },
  { name: "Jugador 2", rendimiento: 1030 },
  { name: "Jugador 3", rendimiento: 1030 },
  { name: "Jugador 4", rendimiento: 1030 },
  { name: "Jugador 5", rendimiento: 1030 }
] as const;

export default async function HomePage({
  searchParams
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const [{ organizations, selectedOrganization }, viewerAdminOrganizations, leagues] = await Promise.all([
    resolvePublicOrganization(resolvedSearchParams.org, { defaultContext: "home" }),
    getViewerAdminOrganizations(),
    getPublicLeagues()
  ]);

  const summary = await getHomeSummary(selectedOrganization?.id ?? null);
  const selectedOrganizationSlug = selectedOrganization?.slug ?? null;
  const featuredLeagues = leagues.slice(0, 3);

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-slate-800 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.2),transparent_34%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] p-6 shadow-[0_28px_70px_-38px_rgba(16,185,129,0.7)] md:p-8 lg:p-10">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
              Futbol amateur, ordenado de verdad
            </p>
            <h1 className="mt-3 max-w-4xl text-4xl font-black leading-tight text-white md:text-5xl lg:text-6xl">
              Organiza grupos, partidos y torneos sin planillas eternas.
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-300 md:text-lg">
              Fabrica de Futbol arma equipos parejos, mide rendimiento, guarda historial y publica la informacion que jugadores, capitanes y visitantes necesitan consultar.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_-18px_rgba(16,185,129,0.95)] transition hover:brightness-110"
                href="/admin/login"
              >
                Crear mi espacio
              </Link>
              <Link
                className="rounded-xl border border-slate-700 bg-slate-950/70 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
                href={withPublicQuery("/pricing", { organizationKey: selectedOrganizationSlug })}
              >
                Ver planes
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {heroHighlights.map((item) => (
                <span
                  className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-xs font-semibold text-slate-200"
                  key={item}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <Card className="border-emerald-400/20 bg-slate-950/70 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-2xl">Rendimiento del grupo</CardTitle>
                <CardDescription className="mt-2">
                  El ranking se actualiza cuando cargas resultados. El nivel sirve como base; el rendimiento muestra lo que pasa en la cancha.
                </CardDescription>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-right">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Partidos</p>
                <p className="mt-1 text-2xl font-black text-white">
                  150
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              {exampleRankingPreview.map((player, index) => (
                <div
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-3 py-3"
                  key={`${player.name}-${index}`}
                >
                  <span className="text-lg font-black text-slate-400">#{index + 1}</span>
                  <span className="truncate text-sm font-semibold text-slate-100">{player.name}</span>
                  <span className="text-sm font-semibold text-emerald-200">
                    {formatRendimiento(player.rendimiento)} pts
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Grupos</p>
          <CardTitle className="mt-2 text-3xl">Para los partidos de cada semana</CardTitle>
          <CardDescription className="mt-3 text-base">
            Ideal para amigos, equipos recurrentes y grupos que quieren dejar de discutir equipos y empezar a tener historial real.
          </CardDescription>
          <div className="mt-5 grid gap-3">
            {groupFeatures.map((feature) => (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4" key={feature.title}>
                <p className="text-sm font-semibold text-white">{feature.title}</p>
                <p className="mt-2 text-sm text-slate-300">{feature.description}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">Torneos</p>
          <CardTitle className="mt-2 text-3xl">Para ligas con varias competencias</CardTitle>
          <CardDescription className="mt-3 text-base">
            Pensado para organizadores que necesitan tabla, fixture, equipos inscriptos, capitanes y estadisticas publicas.
          </CardDescription>
          <div className="mt-5 grid gap-3">
            {tournamentFeatures.map((feature) => (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4" key={feature.title}>
                <p className="text-sm font-semibold text-white">{feature.title}</p>
                <p className="mt-2 text-sm text-slate-300">{feature.description}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Como funciona</p>
          <h2 className="mt-2 text-3xl font-black text-white">Simple para cargar, claro para consultar</h2>
          <p className="mt-3 text-sm text-slate-300">
            La app separa lo que el admin decide manualmente de lo que los resultados van demostrando. Asi el sistema se siente justo sin volverse dificil de usar.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {workflowCards.map((card) => (
            <Card key={card.title}>
              <CardTitle>{card.title}</CardTitle>
              <CardDescription className="mt-2">{card.description}</CardDescription>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Nivel</p>
            <CardTitle className="mt-2">La mirada del admin</CardTitle>
            <CardDescription className="mt-3">
              El nivel de habilidad es estable y facil de entender. Sirve para arrancar y solo cambia cuando el admin lo edita.
            </CardDescription>
          </Card>
          <Card>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Rendimiento</p>
            <CardTitle className="mt-2">Lo que aprende la cancha</CardTitle>
            <CardDescription className="mt-3">
              El rendimiento sube o baja con los resultados y ordena el ranking publico de forma automatica.
            </CardDescription>
          </Card>
          <Card>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Balance</p>
            <CardTitle className="mt-2">Equipos con mas contexto</CardTitle>
            <CardDescription className="mt-3">
              Para armar equipos, la app mira nivel, rendimiento, invitados y arqueros. Menos opinion, mas criterio.
            </CardDescription>
          </Card>
        </div>
      </section>

      <AdPlaceholder slot="home-top-banner" />

      <section className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Grupos publicos</p>
              <CardTitle className="mt-2">Explora ranking, historial y proximos partidos</CardTitle>
              <CardDescription className="mt-2">
                Los visitantes pueden consultar la informacion sin iniciar sesion. La gestion queda reservada para admins.
              </CardDescription>
            </div>
          </div>

          <div className="mt-4">
            <OrganizationSwitcher
              basePath="/"
              currentOrganizationSlug={selectedOrganization?.slug}
              label="Grupos publicos"
              organizations={organizations}
              quickOrganizations={viewerAdminOrganizations}
            />
          </div>

          {selectedOrganization ? (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Jugadores</p>
                  <p className="mt-2 text-2xl font-black text-white">{summary.totalPlayers}</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Partidos</p>
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
                  Ver proximos
                </Link>
              </div>
            </>
          ) : (
            <CardDescription className="mt-4">
              Todavia no hay grupos publicos cargados. Cuando aparezcan, vas a poder explorarlos desde aqui.
            </CardDescription>
          )}
        </Card>

        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ejemplo</p>
          <CardTitle className="mt-2">Tabla de rendimiento</CardTitle>
          <div className="mt-4 space-y-2">
            {exampleRankingPreview.map((player, index) => (
              <div
                className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-3"
                key={`${player.name}-public-${index}`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="text-sm font-black text-slate-500">#{index + 1}</span>
                  <span className="truncate text-sm font-semibold text-white">{player.name}</span>
                </div>
                <span className="text-sm font-semibold text-emerald-200">
                  {formatRendimiento(player.rendimiento)} pts
                </span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {summary.upcomingMatches.length ? (
        <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Proxima fecha</p>
            <CardTitle className="mt-2">La convocatoria tambien queda ordenada</CardTitle>
            <CardDescription className="mt-3">
              Cada partido puede compartirse con horario, modalidad, equipos y detalle publico.
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
                    {match.modality} - {formatMatchDateTime(match.scheduled_at)}
                  </span>
                  <span className="font-semibold text-emerald-300">Ver detalle</span>
                </Link>
              ))}
            </div>
          </Card>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1.02fr_0.98fr]">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Torneos publicos</p>
          <CardTitle className="mt-2">Ligas y competencias listas para compartir</CardTitle>
          <CardDescription className="mt-3">
            Los visitantes pueden entrar a la liga, elegir una competencia y ver tabla, fixture, resultados y estadisticas.
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
              Ver precios
            </Link>
          </div>
        </Card>

        <div className="space-y-3">
          {featuredLeagues.length ? (
            featuredLeagues.map((league) => (
              <Link
                className="block rounded-2xl border border-slate-800 bg-slate-900/80 p-4 transition hover:border-slate-600 hover:bg-slate-900"
                href={`/tournaments/${league.slug}`}
                key={league.id}
              >
                <div className="flex items-start gap-3">
                  <LeagueLogo alt={`Logo de ${league.name}`} size={52} src={league.logoUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base">{league.name}</CardTitle>
                      <TournamentStatusBadge status={league.status} />
                    </div>
                    <CardDescription className="mt-2">
                      {league.description || league.venueName || "Liga publica disponible para consultar sus competencias."}
                    </CardDescription>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <Card>
              <CardDescription>
                El modulo Torneos ya esta listo para mostrar ligas publicas y las competencias activas dentro de cada una.
              </CardDescription>
            </Card>
          )}
        </div>
      </section>

      <section className="rounded-[2rem] border border-emerald-400/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.14),rgba(15,23,42,0.98))] p-6 text-center shadow-[0_24px_60px_-38px_rgba(16,185,129,0.75)] md:p-8">
        <h2 className="text-3xl font-black text-white md:text-4xl">Arranca con un grupo y escala cuando lo necesites</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-200 md:text-base">
          Crea tu grupo, arma partidos parejos y, si el proyecto crece, suma ligas y competencias sin mezclar los flujos.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-95"
            href="/admin/login"
          >
            Empezar
          </Link>
          <Link
            className="rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
            href={withPublicQuery("/help", { organizationKey: selectedOrganizationSlug })}
          >
            Leer ayuda
          </Link>
        </div>
      </section>

      <AdPlaceholder slot="home-bottom-banner" />
    </div>
  );
}
