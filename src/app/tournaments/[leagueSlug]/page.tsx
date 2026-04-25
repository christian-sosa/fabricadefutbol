import Link from "next/link";
import { notFound } from "next/navigation";

import { TournamentStatusBadge } from "@/components/tournaments/tournament-badges";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getPublicLeagueBySlug } from "@/lib/queries/tournaments";

export default async function LeagueDetailPage({
  params
}: {
  params: Promise<{ leagueSlug: string }>;
}) {
  const { leagueSlug } = await params;
  const data = await getPublicLeagueBySlug(leagueSlug);
  if (!data) notFound();

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{data.league.name}</CardTitle>
              <TournamentStatusBadge status={data.league.status} />
            </div>
            <CardDescription className="mt-2">
              {data.league.description || "Resumen general de la liga y de las competencias disponibles."}
            </CardDescription>
            <div className="mt-3 space-y-1 text-sm text-slate-400">
              <p>{data.league.venueName ? `Dónde se juega: ${data.league.venueName}` : "Sede general pendiente"}</p>
              {data.league.locationNotes ? <p>{data.league.locationNotes}</p> : null}
              <p>
                {data.league.teamCount} equipos cargados · {data.league.competitionCount} competencias públicas
              </p>
            </div>
          </div>
          <Link className="text-sm font-semibold text-slate-300 hover:underline" href="/tournaments">
            Volver al listado
          </Link>
        </div>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        {data.competitions.map((competition) => (
          <Card key={competition.id}>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{competition.name}</CardTitle>
              <TournamentStatusBadge status={competition.status} />
            </div>
            <CardDescription className="mt-2">
              {competition.description || "Competencia lista para consultar tabla, fixture y estadísticas."}
            </CardDescription>
            <div className="mt-3 space-y-1 text-xs text-slate-500">
              <p>Temporada {competition.seasonLabel}</p>
              <p>{competition.venueOverride ? `Sede: ${competition.venueOverride}` : data.league.venueName ? `Usa la sede general: ${data.league.venueName}` : "Sede pendiente"}</p>
              <p>{competition.teamCount} equipos inscriptos</p>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">/{data.league.slug}/{competition.slug}</p>
              <Link className="text-sm font-semibold text-emerald-300 hover:underline" href={`/tournaments/${data.league.slug}/${competition.slug}`}>
                Ver competencia
              </Link>
            </div>
          </Card>
        ))}

        {!data.competitions.length ? (
          <Card>
            <CardDescription>Todavía no hay competencias públicas dentro de esta liga.</CardDescription>
          </Card>
        ) : null}
      </section>
    </div>
  );
}
