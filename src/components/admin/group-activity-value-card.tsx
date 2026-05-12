import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { buildGroupActivityValueState } from "@/lib/group-activity-value";

type GroupActivityValueCardProps = {
  finishedCount: number;
  playersCount: number;
  totalMatches: number;
};

export function GroupActivityValueCard({
  finishedCount,
  playersCount,
  totalMatches
}: GroupActivityValueCardProps) {
  const state = buildGroupActivityValueState({
    finishedCount,
    playersCount,
    totalMatches
  });

  return (
    <Card className="border-emerald-400/20 bg-slate-900/85">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
            Actividad del grupo
          </p>
          <CardTitle className="mt-2 text-2xl">{state.headline}</CardTitle>
          <CardDescription className="mt-2 max-w-3xl text-sm">
            {state.description}
          </CardDescription>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Jugadores</p>
          <p className="mt-1 text-3xl font-black text-white">{playersCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Partidos creados</p>
          <p className="mt-1 text-3xl font-black text-white">{totalMatches}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Resultados</p>
          <p className="mt-1 text-3xl font-black text-white">{finishedCount}</p>
        </div>
      </div>
    </Card>
  );
}
