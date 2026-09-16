import Link from "next/link";

import { TrackedLink } from "@/components/analytics/tracked-link";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { GROWTH_EVENTS } from "@/lib/growth";
import { formatMatchDateTime } from "@/lib/match-datetime";
import { withOrgQuery, withPublicQuery } from "@/lib/org";
import { getHomeSummary, getViewerAdminOrganizations, resolvePublicOrganization } from "@/lib/queries/public";
import { formatRendimiento } from "@/lib/utils";

const workflowCards = [
  {
    title: "Cargás jugadores",
    description: "Creás tu grupo y definís el nivel inicial de cada jugador. Ellos no necesitan registrarse."
  },
  {
    title: "Armás y compartís",
    description: "Elegís los convocados y arqueros. La app propone equipos parejos para compartir por WhatsApp."
  },
  {
    title: "Guardás el resultado",
    description: "El ranking y el historial se actualizan. La próxima semana, repetís el partido."
  }
] as const;

const exampleRankingPreview = [
  { name: "Juan", rendimiento: 1110, matchesPlayed: 92 },
  { name: "Manuel", rendimiento: 1050, matchesPlayed: 87 },
  { name: "Nicolás", rendimiento: 1020, matchesPlayed: 76 },
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
  const nextMatch = summary.upcomingMatches[0];

  return (
    <div className="space-y-10 md:space-y-14">
      <section className="grid gap-8 py-3 md:py-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-12">
        <div>
          <p className="text-sm font-semibold text-accent">Grupos gratis</p>
          <h1 className="mt-3 max-w-xl text-4xl font-black leading-tight tracking-tight text-white md:text-5xl">
            Armá el partido.<br />Disfrutá el fútbol.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-300 md:text-lg">
            Equipos parejos, convocatoria por WhatsApp y un historial que se actualiza con cada resultado.
          </p>
          <div className="mt-6 grid gap-3 sm:flex">
            <TrackedLink
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-accent px-5 py-3 text-center text-sm font-semibold text-accent-foreground transition hover:brightness-110"
              eventName={GROWTH_EVENTS.ctaClicked}
              eventProperties={{ cta: "create_group", source: "home_hero" }}
              href="/admin/login?mode=register"
            >
              Crear mi grupo gratis
            </TrackedLink>
            <TrackedLink
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-700 px-5 py-3 text-center text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
              eventName={GROWTH_EVENTS.ctaClicked}
              eventProperties={{ cta: "demo", source: "home_hero" }}
              href="/demo"
            >
              Probar demo
            </TrackedLink>
          </div>
          <p className="mt-3 text-sm text-slate-400">Los jugadores no necesitan registrarse.</p>
          <Link className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-accent underline underline-offset-4" href="#mi-grupo">
            Entrar a mi grupo →
          </Link>
        </div>

        <Card className="p-5 md:p-6">
          <p className="text-xs font-semibold text-slate-400">Ejemplo ficticio · datos ilustrativos</p>
          <CardTitle className="mt-2 text-2xl">El partido termina. El ranking sigue.</CardTitle>
          <CardDescription className="mt-2">Todos pueden ver cómo viene el grupo desde un mismo link.</CardDescription>
          <table className="mt-5 w-full text-left text-sm">
            <caption className="sr-only">Ejemplo del ranking de rendimiento de un grupo</caption>
            <thead className="text-xs text-slate-400">
              <tr>
                <th className="pb-3 font-medium" scope="col">Jugador</th>
                <th className="pb-3 text-right font-medium" scope="col"><abbr className="no-underline" title="Partidos jugados">PJ</abbr></th>
                <th className="pb-3 text-right font-medium" scope="col">Puntos</th>
              </tr>
            </thead>
            <tbody>
              {exampleRankingPreview.map((player, index) => (
                <tr className="border-t border-slate-800" key={player.name}>
                  <th className="py-3 font-semibold text-slate-100" scope="row">
                    <span className="mr-3 inline-block w-4 font-normal text-slate-400">{index + 1}</span>{player.name}
                  </th>
                  <td className="py-3 text-right tabular-nums text-slate-400">{player.matchesPlayed}</td>
                  <td className="py-3 text-right font-semibold tabular-nums text-slate-100">{formatRendimiento(player.rendimiento)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section aria-labelledby="how-it-works-title">
        <h2 className="text-2xl font-black text-white md:text-3xl" id="how-it-works-title">De la convocatoria al próximo partido</h2>
        <ol className="mt-5 grid gap-5 md:grid-cols-3 md:gap-8">
          {workflowCards.map((card, index) => (
            <li className="flex gap-4 border-t border-slate-800 pt-5" key={card.title}>
              <span className="text-xl font-black tabular-nums text-accent" aria-hidden="true">0{index + 1}</span>
              <div>
                <h3 className="text-base font-bold text-slate-100">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{card.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="my-group-title" className="scroll-mt-24" id="mi-grupo">
        <Card className="p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-white" id="my-group-title">¿Ya tenés grupo?</h2>
              <p className="mt-2 text-sm text-slate-300">Buscalo para ver el ranking, los resultados y la próxima fecha.</p>
            </div>
            <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-accent underline underline-offset-4" href="/admin/login">
              Soy admin: ingresar
            </Link>
          </div>
          <div className="mt-5">
            <OrganizationSwitcher
              basePath="/groups"
              currentOrganizationSlug={selectedOrganization?.slug}
              label="Grupos públicos"
              organizations={organizations}
              quickOrganizations={viewerAdminOrganizations}
            />
          </div>
          {selectedOrganization ? (
            <div className="mt-5 flex flex-col gap-4 border-t border-slate-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-slate-300">{summary.totalPlayers} jugadores · {summary.totalFinishedMatches} partidos jugados</p>
                {nextMatch ? (
                  <Link className="mt-2 inline-flex min-h-11 items-center text-sm text-slate-200 underline underline-offset-4" href={withOrgQuery(`/matches/${nextMatch.id}`, selectedOrganizationSlug)}>
                    Próximo: {formatMatchDateTime(nextMatch.scheduled_at)} · {nextMatch.modality}
                  </Link>
                ) : null}
              </div>
              <Link
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-900"
                href={withOrgQuery("/groups", selectedOrganization.slug)}
              >
                Ver grupo →
              </Link>
            </div>
          ) : null}
        </Card>
      </section>

      <section className="border-t border-slate-800 py-8 text-center md:py-10">
        <h2 className="text-2xl font-black text-white md:text-3xl">Tu próximo partido, más simple.</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-slate-300 md:text-base">Creá el grupo, cargá los jugadores y empezá a jugar.</p>
        <TrackedLink
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition hover:brightness-110 sm:w-auto"
          eventName={GROWTH_EVENTS.ctaClicked}
          eventProperties={{ cta: "create_group", source: "home_bottom" }}
          href="/admin/login?mode=register"
        >
          Crear mi grupo gratis
        </TrackedLink>
        <div className="mt-3 flex flex-wrap justify-center gap-x-5 text-sm">
          <TrackedLink
            className="inline-flex min-h-11 items-center text-slate-300 underline underline-offset-4 hover:text-white"
            eventName={GROWTH_EVENTS.ctaClicked}
            eventProperties={{ cta: "guides", source: "home_bottom" }}
            href={withPublicQuery("/guides", { organizationKey: selectedOrganizationSlug })}
          >
            Ver guías
          </TrackedLink>
          <Link className="inline-flex min-h-11 items-center text-slate-300 underline underline-offset-4 hover:text-white" href={withPublicQuery("/help", { organizationKey: selectedOrganizationSlug })}>
            Leer ayuda
          </Link>
        </div>
      </section>
    </div>
  );
}
