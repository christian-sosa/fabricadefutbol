import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { buildGroupActivityValueState } from "@/lib/group-activity-value";

type GroupActivityValueCardProps = {
  finishedCount: number;
  playersCount: number;
  seasonLabel?: string;
  seasonRange?: string;
  totalMatches: number;
};

export function GroupActivityValueCard({
  finishedCount,
  playersCount,
  seasonLabel,
  seasonRange,
  totalMatches
}: GroupActivityValueCardProps) {
  const state = buildGroupActivityValueState({
    finishedCount,
    playersCount,
    totalMatches
  });
  const hasActiveSeason = Boolean(seasonLabel && seasonRange);
  const seasonTitle = hasActiveSeason ? `${seasonLabel} activa` : "Temporada pendiente";

  return (
    <Card className="border-emerald-400/20 bg-slate-900/85">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
            Panel del grupo
          </p>
          <CardTitle className="mt-2 text-2xl">{state.headline}</CardTitle>
          <CardDescription className="mt-2 max-w-3xl text-sm">
            {state.description}
          </CardDescription>
        </div>
        <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-left lg:min-w-64">
          <p className="text-sm font-semibold text-emerald-100">{seasonTitle}</p>
          <p className="mt-1 text-xs text-emerald-200/80">
            {seasonRange ?? "Se crea automaticamente al cargar un resultado."}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Jugadores</p>
          <p className="mt-1 text-3xl font-black text-white">{playersCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Partidos</p>
          <p className="mt-1 text-3xl font-black text-white">{totalMatches}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Resultados</p>
          <p className="mt-1 text-3xl font-black text-white">{finishedCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Pendientes</p>
          <p className="mt-1 text-3xl font-black text-white">{state.pendingResultsCount}</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
        <p className="text-sm font-semibold text-slate-100">Ranking de temporada</p>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          El ranking anual empieza limpio para competir de nuevo. El historico se conserva para armar equipos parejos.
        </p>
      </div>
    </Card>
  );
}
