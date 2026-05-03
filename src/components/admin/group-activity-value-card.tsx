import { TrackedLink } from "@/components/analytics/tracked-link";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { buildGroupActivityValueState } from "@/lib/group-activity-value";
import { GROWTH_EVENTS } from "@/lib/growth";
import { withOrgQuery } from "@/lib/org";

type GroupActivityValueCardProps = {
  finishedCount: number;
  organizationSlug: string;
  playersCount: number;
  totalMatches: number;
};

export function GroupActivityValueCard({
  finishedCount,
  organizationSlug,
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
        <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100">
          Grupos gratis
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

      <div className="mt-5 flex flex-wrap gap-2">
        <TrackedLink
          className="inline-flex items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
          eventName={GROWTH_EVENTS.ctaClicked}
          eventProperties={{ cta: "create_match", source: "group_activity_value" }}
          href={withOrgQuery("/admin/matches/new", organizationSlug)}
        >
          Crear proximo partido
        </TrackedLink>
        <TrackedLink
          className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
          eventName={GROWTH_EVENTS.ctaClicked}
          eventProperties={{ cta: "players", source: "group_activity_value" }}
          href={withOrgQuery("/admin/players", organizationSlug)}
        >
          Ir a jugadores
        </TrackedLink>
      </div>
    </Card>
  );
}
