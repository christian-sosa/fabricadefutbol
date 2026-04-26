import Link from "next/link";

import { AdPlaceholder } from "@/components/layout/ad-placeholder";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { formatMatchDateTime } from "@/lib/match-datetime";
import { withOrgQuery, withPublicQuery } from "@/lib/org";
import { getHomeSummary, getViewerAdminOrganizations, resolvePublicOrganization } from "@/lib/queries/public";
import { formatRendimiento } from "@/lib/utils";

const heroHighlights = [
  "Equipos parejos",
  "Rendimiento automatico",
  "Historial publico",
  "Convocatorias claras"
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

const workflowCards = [
  {
    title: "1. Cargas la base",
    description:
      "Cargas jugadores, niveles y una foto del grupo para que el espacio quede listo para compartir."
  },
  {
    title: "2. Organizas la fecha",
    description:
      "Eliges fecha, modalidad, convocados, invitados y arqueros. La app propone equipos balanceados."
  },
  {
    title: "3. Publicas resultados",
    description:
      "Cargas marcador y datos del partido. El ranking, historial y estadisticas se actualizan solos."
  }
] as const;

const exampleRankingPreview = [
  { name: "Juan", rendimiento: 1110, matchesPlayed: 92 },
  { name: "Manuel", rendimiento: 1050, matchesPlayed: 87 },
  { name: "Nicolas", rendimiento: 1020, matchesPlayed: 76 },
  { name: "Lucas", rendimiento: 990, matchesPlayed: 68 },
  { name: "Diego", rendimiento: 960, matchesPlayed: 54 }
] as const;

export default async function HomePage({
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
  const selectedOrganizationSlug = selectedOrganization?.slug ?? null;

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-slate-800 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.2),transparent_34%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] p-6 shadow-[0_28px_70px_-38px_rgba(16,185,129,0.7)] md:p-8 lg:p-10">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
              Futbol amateur, ordenado de verdad
            </p>
            <h1 className="mt-3 max-w-4xl text-4xl font-black leading-tight text-white md:text-5xl lg:text-6xl">
              Organiza tu grupo y arma partidos parejos sin planillas eternas.
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-300 md:text-lg">
              Fabrica de Futbol arma equipos parejos, mide rendimiento, guarda historial y publica la informacion que tus jugadores necesitan consultar.
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
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-100">{player.name}</span>
                    <span className="text-xs text-slate-500">{player.matchesPlayed} partidos</span>
                  </span>
                  <span className="text-sm font-semibold text-emerald-200">{formatRendimiento(player.rendimiento)} pts</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      <section>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Grupos</p>
          <CardTitle className="mt-2 text-3xl">Para los partidos de cada semana</CardTitle>
          <CardDescription className="mt-3 text-base">
            Ideal para amigos, equipos recurrentes y grupos que quieren dejar de discutir equipos y empezar a tener historial real.
          </CardDescription>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {groupFeatures.map((feature) => (
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
            <div className="grid grid-cols-[auto_1fr_auto_auto] gap-3 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <span>#</span>
              <span>Jugador</span>
              <span className="text-right">PJ</span>
              <span className="text-right">Pts</span>
            </div>
            {exampleRankingPreview.map((player, index) => (
              <div
                className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-3"
                key={`${player.name}-public-${index}`}
              >
                <span className="text-sm font-black text-slate-500">#{index + 1}</span>
                <span className="truncate text-sm font-semibold text-white">{player.name}</span>
                <span className="text-right text-sm text-slate-300">{player.matchesPlayed}</span>
                <span className="text-right text-sm font-semibold text-emerald-200">{formatRendimiento(player.rendimiento)}</span>
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

      <section className="rounded-[2rem] border border-emerald-400/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.14),rgba(15,23,42,0.98))] p-6 text-center shadow-[0_24px_60px_-38px_rgba(16,185,129,0.75)] md:p-8">
        <h2 className="text-3xl font-black text-white md:text-4xl">Tu grupo, mas facil de sostener semana a semana</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-200 md:text-base">
          Crea tu grupo, arma partidos parejos y deja ranking, historial y proximas fechas claros para todos.
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
