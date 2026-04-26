import Link from "next/link";

import { AdPlaceholder } from "@/components/layout/ad-placeholder";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import {
  ORGANIZATION_BILLING_CURRENCY,
  ORGANIZATION_MONTHLY_PRICE_ARS
} from "@/lib/constants";
import { formatMatchDateTime } from "@/lib/match-datetime";
import { withOrgQuery, withPublicQuery } from "@/lib/org";
import { getHomeSummary, getViewerAdminOrganizations, resolvePublicOrganization } from "@/lib/queries/public";
import { formatRendimiento } from "@/lib/utils";

const heroHighlights = [
  "Equipos parejos",
  "Rendimiento automático",
  "Historial público",
  "Jugadores sin registro"
] as const;

const groupFeatures = [
  {
    title: "Niveles simples",
    description:
      "Definí una base clara para cada jugador: Figura, Muy bueno, Intermedio, Recreativo o Principiante."
  },
  {
    title: "Equipos parejos",
    description:
      "La app combina nivel, rendimiento, invitados y arqueros para proponerte equipos más parejos."
  },
  {
    title: "Historial real",
    description:
      "Cada resultado actualiza rendimiento, ranking, estadísticas y detalle del partido para que nada dependa de la memoria."
  }
] as const;

const workflowCards = [
  {
    title: "1. Cargás jugadores",
    description: "Definís el nivel inicial de cada jugador y dejás listo el grupo."
  },
  {
    title: "2. Armás el partido",
    description:
      "Elegís fecha, modalidad, convocados, invitados y arqueros. La app propone equipos parejos."
  },
  {
    title: "3. Cargás el resultado",
    description:
      "El ranking, el rendimiento y el historial se actualizan automáticamente."
  }
] as const;

const exampleRankingPreview = [
  { name: "Juan", rendimiento: 1110, matchesPlayed: 92 },
  { name: "Manuel", rendimiento: 1050, matchesPlayed: 87 },
  { name: "Nicolás", rendimiento: 1020, matchesPlayed: 76 },
  { name: "Lucas", rendimiento: 990, matchesPlayed: 68 },
  { name: "Diego", rendimiento: 960, matchesPlayed: 54 }
] as const;

function formatAmountArs(amount: number) {
  return `$${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)} ${ORGANIZATION_BILLING_CURRENCY}`;
}

const monthlyGroupPrice = formatAmountArs(ORGANIZATION_MONTHLY_PRICE_ARS);

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
              Fútbol amateur, ordenado de verdad
            </p>
            <h1 className="mt-3 max-w-4xl text-4xl font-black leading-tight text-white md:text-5xl lg:text-6xl">
              Armá equipos parejos sin discusiones y llevá el historial de tu grupo
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-300 md:text-lg">
              Con Fábrica de Fútbol cargás jugadores, organizás partidos, medís rendimiento y publicás ranking, historial y próximas fechas para todos.
            </p>
            <p className="mt-4 max-w-2xl rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100">
              Probá 1 mes gratis. Después, {monthlyGroupPrice}/mes por organización para seguir creando partidos y cargando resultados.
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
                  Cargás resultados y el ranking se actualiza solo. El nivel sirve como base; el rendimiento muestra quién viene jugando mejor.
                </CardDescription>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-right">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Partidos</p>
                <p className="mt-1 text-2xl font-black text-white">
                  112
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
          <CardTitle className="mt-2 text-3xl">Para grupos que juegan todas las semanas</CardTitle>
          <CardDescription className="mt-3 text-base">
            Dejá de armar equipos a ojo. Cargá jugadores, definí niveles, armá partidos parejos y guardá cada resultado en un historial real.
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

      <section className="rounded-[2rem] border border-emerald-400/20 bg-emerald-500/10 p-5 md:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Menos discusiones, más fútbol</p>
        <h2 className="mt-2 text-3xl font-black text-white">Todo el grupo, ordenado en un solo lugar</h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300 md:text-base">
          Si siempre terminan discutiendo si los equipos quedaron desparejos, perdiendo resultados o armando todo en planillas eternas, Fábrica de Fútbol te ayuda a ordenar el grupo sin cambiar la dinámica de siempre.
        </p>
      </section>

      <section className="space-y-4">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Cómo funciona</p>
          <h2 className="mt-2 text-3xl font-black text-white">Tres pasos y el partido queda listo</h2>
          <p className="mt-3 text-sm text-slate-300">
            El admin carga lo necesario, la app propone equipos parejos y después el resultado alimenta ranking, rendimiento e historial.
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

        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ranking y rendimiento</p>
          <CardTitle className="mt-2 text-2xl">Ranking que se actualiza solo</CardTitle>
          <CardDescription className="mt-3 max-w-3xl text-base">
            Cargás el resultado del partido y la app actualiza el rendimiento de cada jugador. El nivel lo define el admin; el rendimiento muestra quién viene jugando mejor en la cancha.
          </CardDescription>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-sm font-semibold text-white">Nivel</p>
              <p className="mt-2 text-sm text-slate-300">Es la base definida por el admin para armar partidos con criterio desde el primer día.</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-sm font-semibold text-white">Rendimiento</p>
              <p className="mt-2 text-sm text-slate-300">Se mueve según los resultados y ayuda a detectar quién viene jugando mejor.</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-sm font-semibold text-white">Ranking</p>
              <p className="mt-2 text-sm text-slate-300">Muestra la tabla del grupo para que todos puedan seguir la evolución sin pedirle nada al admin.</p>
            </div>
          </div>
        </Card>
      </section>

      <AdPlaceholder slot="home-top-banner" />

      <section className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Sin fricción para jugar</p>
          <CardTitle className="mt-2 text-2xl">Tus jugadores no necesitan registrarse</CardTitle>
          <CardDescription className="mt-3 text-base">
            El admin gestiona el grupo. Los jugadores solo entran al link público para ver ranking, historial y próximos partidos.
          </CardDescription>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Pensado para grupos reales</p>
          <CardTitle className="mt-2">Amigos, equipos recurrentes y canchas de todos los días</CardTitle>
          <CardDescription className="mt-3">
            La app ordena lo que ya hacen cada semana: convocar, separar equipos, jugar, cargar resultado y dejar todo publicado para consultar.
          </CardDescription>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Grupos públicos</p>
              <CardTitle className="mt-2">Mirá cómo se ve un grupo real</CardTitle>
              <CardDescription className="mt-2">
                Explorá ranking, historial y próximos partidos de grupos públicos para entender cómo funciona la app.
              </CardDescription>
            </div>
          </div>

          <div className="mt-4">
            <OrganizationSwitcher
              basePath="/"
              currentOrganizationSlug={selectedOrganization?.slug}
              label="Grupos públicos"
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
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Próximos</p>
                  <p className="mt-2 text-2xl font-black text-white">{summary.upcomingMatches.length}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
                  href={withOrgQuery("/ranking", selectedOrganization.slug)}
                >
                  Ver ranking de ejemplo
                </Link>
                <Link
                  className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
                  href={withOrgQuery("/matches", selectedOrganization.slug)}
                >
                  Ver historial de ejemplo
                </Link>
                <Link
                  className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
                  href={withOrgQuery("/upcoming", selectedOrganization.slug)}
                >
                  Ver próximos partidos
                </Link>
              </div>
            </>
          ) : (
            <CardDescription className="mt-4">
              Todavía no hay grupos públicos cargados. Cuando aparezcan, vas a poder explorarlos desde acá.
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
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Próxima fecha</p>
            <CardTitle className="mt-2">La convocatoria también queda ordenada</CardTitle>
            <CardDescription className="mt-3">
              Cada partido puede compartirse con horario, modalidad, equipos y detalle público.
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
        <h2 className="text-3xl font-black text-white md:text-4xl">Tu grupo puede estar ordenado desde el próximo partido</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-200 md:text-base">
          Probá Fábrica de Fútbol gratis durante 1 mes. Armá equipos parejos, cargá resultados y dejá ranking e historial disponibles para todos.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-95"
            href="/admin/login"
          >
            Crear mi grupo gratis
          </Link>
          <Link
            className="rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
            href={withPublicQuery("/pricing", { organizationKey: selectedOrganizationSlug })}
          >
            Ver precios
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
