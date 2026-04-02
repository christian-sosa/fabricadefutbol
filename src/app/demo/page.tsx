import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { demoPlayers, demoUpcomingMatch } from "@/lib/mock/demo-data";

export default function DemoPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black text-slate-100">Demo rapida (mock)</h1>
      <p className="text-sm text-slate-400">Esta pagina usa datos mock para validar UI y flujo sin base conectada.</p>

      <Card>
        <CardTitle>Top ranking mock</CardTitle>
        <div className="mt-3 space-y-2">
          {demoPlayers.map((player, index) => (
            <div
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
              key={player.id}
            >
              <div className="flex items-center gap-3">
                <PlayerAvatar name={player.fullName} size="sm" />
                <span>
                  #{index + 1} {player.fullName}
                </span>
              </div>
              <span className="font-semibold text-emerald-300">{player.currentRating.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>Ejemplo partido confirmado</CardTitle>
        <CardDescription>
          {demoUpcomingMatch.modality} - {new Date(demoUpcomingMatch.date).toLocaleString("es-AR")}
        </CardDescription>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Equipo A ({demoUpcomingMatch.ratingSumA})
            </p>
            <ul className="space-y-1 text-sm">
              {demoUpcomingMatch.teamA.map((player) => (
                <li key={player}>{player}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Equipo B ({demoUpcomingMatch.ratingSumB})
            </p>
            <ul className="space-y-1 text-sm">
              {demoUpcomingMatch.teamB.map((player) => (
                <li key={player}>{player}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-300">
          Diferencia estimada de rating: <span className="font-semibold text-emerald-300">{demoUpcomingMatch.diff}</span>
        </p>
      </Card>
    </div>
  );
}
