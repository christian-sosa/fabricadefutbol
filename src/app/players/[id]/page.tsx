import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { withOrgQuery } from "@/lib/org";
import { getPlayerDetails } from "@/lib/queries/public";
import { formatDateTime, formatPercent, formatRendimiento, formatRendimientoDelta } from "@/lib/utils";

export async function generateMetadata({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ org?: string }>;
}): Promise<Metadata> {
  try {
    const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
    const details = await getPlayerDetails(id, resolvedSearchParams.org);
    if (!details) return { title: "Jugador no encontrado" };
    const title = details.player.full_name;
    const description = `Estadisticas y partidos de ${details.player.full_name} en Fabrica de Futbol.`;
    return {
      title,
      description,
      openGraph: { title, description },
      twitter: { title, description }
    };
  } catch {
    return { title: "Jugador" };
  }
}

export default async function PlayerDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ org?: string }>;
}) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const details = await getPlayerDetails(id, resolvedSearchParams.org);
  if (!details) notFound();

  return (
    <div className="space-y-4">
      <Link className="text-sm font-semibold text-emerald-300 hover:underline" href={withOrgQuery("/players", resolvedSearchParams.org)}>
        Volver a jugadores
      </Link>

      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <PlayerAvatar className="h-16 w-16" name={details.player.full_name} playerId={details.player.id} size="lg" />
          <div>
            <CardTitle>{details.player.full_name}</CardTitle>
            <CardDescription>Rendimiento actual {formatRendimiento(details.player.current_rating)}</CardDescription>
          </div>
        </div>
      </Card>

      {details.playerStats ? (
        <Card>
          <CardTitle>Estadisticas</CardTitle>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
            <p>PJ: {details.playerStats.matchesPlayed}</p>
            <p>PG: {details.playerStats.wins}</p>
            <p>PE: {details.playerStats.draws}</p>
            <p>PP: {details.playerStats.losses}</p>
            <p>Win rate: {formatPercent(details.playerStats.winRate)}</p>
            <p>Racha: {details.playerStats.streak}</p>
            <p>Goles: {details.playerStats.goals}</p>
            <p>Asistencias: {details.playerStats.assists}</p>
          </div>
        </Card>
      ) : null}

      <Card>
        <CardTitle>Historial de rendimiento</CardTitle>
        <div className="mt-3 space-y-2">
          {details.ratingHistory.length ? (
            details.ratingHistory.map((item) => (
              <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm" key={item.id}>
                <p className="text-slate-300">{formatDateTime(item.created_at)}</p>
                <p className="font-medium text-slate-100">
                  {formatRendimiento(item.rating_before)} -&gt; {formatRendimiento(item.rating_after)} (
                  {formatRendimientoDelta(item.delta)})
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400">Sin historial todavia.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
