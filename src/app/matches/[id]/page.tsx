import Link from "next/link";
import { notFound } from "next/navigation";

import { MatchStatusBadge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { withOrgQuery } from "@/lib/org";
import { getMatchDetails } from "@/lib/queries/public";
import { formatDateTime } from "@/lib/utils";

export default async function MatchDetailPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { org?: string };
}) {
  const details = await getMatchDetails(params.id, searchParams.org);
  if (!details) notFound();

  return (
    <div className="space-y-4">
      <Link className="text-sm font-semibold text-emerald-300 hover:underline" href={withOrgQuery("/matches", searchParams.org)}>
        Volver al historial
      </Link>
      <Card>
        <CardTitle>Partido {formatDateTime(details.match.scheduled_at)}</CardTitle>
        <CardDescription className="mt-1">
          {details.match.modality} | <MatchStatusBadge status={details.match.status} />
        </CardDescription>
      </Card>

      <Card>
        <CardTitle>Equipos confirmados</CardTitle>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Equipo A</p>
            <ul className="space-y-2 text-sm">
              {details.teamAPlayers.map((player) => (
                <li className="flex items-center justify-between gap-3" key={player.id}>
                  <span className="flex items-center gap-2">
                    <PlayerAvatar name={player.full_name} playerId={player.is_guest ? undefined : player.id} size="sm" />
                    {player.full_name}
                    {player.is_guest ? (
                      <span className="rounded-full border border-cyan-400/50 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-200">
                        Invitado
                      </span>
                    ) : null}
                  </span>
                  {!player.is_guest ? <span className="font-semibold text-emerald-300">{Number(player.current_rating).toFixed(2)}</span> : null}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Equipo B</p>
            <ul className="space-y-2 text-sm">
              {details.teamBPlayers.map((player) => (
                <li className="flex items-center justify-between gap-3" key={player.id}>
                  <span className="flex items-center gap-2">
                    <PlayerAvatar name={player.full_name} playerId={player.is_guest ? undefined : player.id} size="sm" />
                    {player.full_name}
                    {player.is_guest ? (
                      <span className="rounded-full border border-cyan-400/50 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-200">
                        Invitado
                      </span>
                    ) : null}
                  </span>
                  {!player.is_guest ? <span className="font-semibold text-emerald-300">{Number(player.current_rating).toFixed(2)}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Resultado</CardTitle>
        <div className="mt-3 text-sm">
          {details.result ? (
            <>
              <p className="text-3xl font-black text-slate-100">
                {details.result.score_a} - {details.result.score_b}
              </p>
              <p className="text-slate-300">
                Ganador: {details.result.winner_team === "DRAW" ? "Empate" : `Equipo ${details.result.winner_team}`}
              </p>
              {details.result.notes ? <p className="mt-1 text-slate-400">{details.result.notes}</p> : null}
            </>
          ) : (
            <p className="text-slate-400">Resultado pendiente.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
