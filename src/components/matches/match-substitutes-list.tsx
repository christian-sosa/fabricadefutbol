import { PlayerAvatar } from "@/components/ui/player-avatar";
import type { PublicMatchSubstitute } from "@/lib/queries/public";

export function MatchSubstitutesList({
  players,
  teamLabels,
  title = "Suplentes convocados"
}: {
  players: PublicMatchSubstitute[];
  teamLabels: { teamA: string; teamB: string };
  title?: string;
}) {
  if (!players.length) return null;
  return (
    <section aria-label={title} className="mt-4 rounded-xl border border-indigo-400/20 bg-indigo-500/5 p-4">
      <h3 className="text-sm font-semibold text-indigo-200">{title} · {players.length}</h3>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {players.map((player) => (
          <li className="flex min-w-0 items-center gap-3" key={`${player.is_guest ? "guest" : "player"}:${player.id}`}>
            <PlayerAvatar hasPhoto={Boolean(player.photo_path)} name={player.full_name} photoUpdatedAt={player.photo_updated_at} playerId={player.is_guest ? undefined : player.id} size="sm" />
            <div className="min-w-0 text-sm">
              <p className="break-words font-semibold text-slate-100">{player.full_name}{player.is_guest ? <span className="ml-2 text-xs font-normal text-slate-400">Invitado</span> : null}</p>
              <p className="text-xs text-slate-400">{player.team === "A" ? teamLabels.teamA : player.team === "B" ? teamLabels.teamB : "Equipo por definir"}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
