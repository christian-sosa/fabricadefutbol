import Link from "next/link";

import { TournamentStatusBadge } from "@/components/tournaments/tournament-badges";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getPublicTournaments } from "@/lib/queries/tournaments";

export default async function TournamentsPage() {
  const tournaments = await getPublicTournaments();

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Torneos</CardTitle>
        <CardDescription>
          Explora ligas y torneos independientes del modulo de organizaciones.
        </CardDescription>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        {tournaments.map((tournament) => (
          <Card key={tournament.id}>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{tournament.name}</CardTitle>
              <TournamentStatusBadge status={tournament.status} />
            </div>
            <CardDescription className="mt-2">
              {tournament.seasonLabel} - {tournament.description || "Sin descripcion"}
            </CardDescription>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">/{tournament.slug}</p>
              <Link className="text-sm font-semibold text-emerald-300 hover:underline" href={`/tournaments/${tournament.slug}`}>
                Ver torneo
              </Link>
            </div>
          </Card>
        ))}

        {!tournaments.length ? (
          <Card>
            <CardDescription>Todavia no hay torneos publicos cargados.</CardDescription>
          </Card>
        ) : null}
      </section>
    </div>
  );
}
