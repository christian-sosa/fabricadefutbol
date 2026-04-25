import Link from "next/link";

import { TournamentStatusBadge } from "@/components/tournaments/tournament-badges";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getPublicLeagues } from "@/lib/queries/tournaments";

export default async function TournamentsPage() {
  const leagues = await getPublicLeagues();

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Ligas</CardTitle>
        <CardDescription>
          Explora ligas públicas, su sede general y las competencias disponibles dentro de cada una.
        </CardDescription>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        {leagues.map((league) => (
          <Card key={league.id}>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{league.name}</CardTitle>
              <TournamentStatusBadge status={league.status} />
            </div>
            <CardDescription className="mt-2">
              {league.description || "Liga pública disponible para consultar."}
            </CardDescription>
            <div className="mt-4 space-y-1 text-xs text-slate-500">
              <p>{league.venueName ? `Dónde se juega: ${league.venueName}` : "Sede general pendiente"}</p>
              <p>
                {league.teamCount} equipos · {league.competitionCount} competencias
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">/{league.slug}</p>
              <Link className="text-sm font-semibold text-emerald-300 hover:underline" href={`/tournaments/${league.slug}`}>
                Ver liga
              </Link>
            </div>
          </Card>
        ))}

        {!leagues.length ? (
          <Card>
            <CardDescription>Todavía no hay ligas públicas cargadas.</CardDescription>
          </Card>
        ) : null}
      </section>
    </div>
  );
}
