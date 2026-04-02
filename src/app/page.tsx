import Link from "next/link";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { getHomeSummary } from "@/lib/queries/public";
import { formatDateTime } from "@/lib/utils";

export default async function HomePage() {
  const summary = await getHomeSummary();

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-800 bg-slate-900/75 p-5 shadow-[0_24px_40px_-30px_rgba(16,185,129,0.7)] md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">Partidos entre amigos</p>
        <h1 className="mt-2 text-3xl font-black text-slate-100 md:text-5xl">Organizacion simple, estadisticas reales</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-300 md:text-base">
          Crea partidos, balancea equipos con rating y manten un ranking dinamico en una experiencia visual de estilo
          deportivo.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_-14px_rgba(16,185,129,1)]"
            href="/upcoming"
          >
            Ver proximos partidos
          </Link>
          <Link
            className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
            href="/ranking"
          >
            Ver ranking
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardDescription>Jugadores activos</CardDescription>
          <CardTitle className="mt-1 text-3xl">{summary.totalPlayers}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Partidos finalizados</CardDescription>
          <CardTitle className="mt-1 text-3xl">{summary.totalFinishedMatches}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Proximos confirmados</CardDescription>
          <CardTitle className="mt-1 text-3xl">{summary.upcomingMatches.length}</CardTitle>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Top 5 Ranking</CardTitle>
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
                  href={`/matches/${match.id}`}
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
    </div>
  );
}
