import Link from "next/link";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getPastPendingResultMatch } from "@/lib/admin-pending-match";
import { formatMatchModality } from "@/lib/constants";
import { formatMatchDateTime } from "@/lib/match-datetime";
import { withOrgQuery } from "@/lib/org";
import type { MatchModality, MatchStatus } from "@/types/domain";

type OverviewMatch = {
  id: string;
  scheduled_at: string;
  modality: MatchModality;
  status: MatchStatus;
};

const statusLabels: Record<MatchStatus, string> = {
  draft: "Borrador",
  confirmed: "Equipos confirmados",
  finished: "Finalizado",
  cancelled: "Cancelado"
};

export function AdminMatchOverview({
  canWrite,
  matches,
  organizationSlug
}: {
  canWrite: boolean;
  matches: OverviewMatch[];
  organizationSlug: string;
}) {
  const pendingResult = getPastPendingResultMatch(matches);

  return (
    <Card className="rounded-2xl p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">En la cancha</p>
          <CardTitle className="mt-2 text-2xl">Organizá el próximo encuentro</CardTitle>
          <CardDescription className="mt-2">Armá equipos o retomá un partido desde donde lo dejaste.</CardDescription>
        </div>
        {canWrite ? (
          <Link className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-accent px-5 py-3 text-sm font-bold text-accent-foreground transition hover:brightness-110" href={withOrgQuery("/admin/matches/new", organizationSlug)}>
            + Nuevo partido
          </Link>
        ) : <span className="w-fit rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">Solo lectura</span>}
      </div>

      {pendingResult && canWrite ? (
        <Link className="mt-5 flex flex-col gap-3 rounded-xl border border-amber-400/25 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between" href={withOrgQuery(`/admin/matches/${pendingResult.id}/result`, organizationSlug)}>
          <span><span className="block text-sm font-semibold text-amber-100">Hay un resultado por cargar</span><span className="mt-1 block text-xs text-amber-100/75">{formatMatchDateTime(pendingResult.scheduled_at)} · {formatMatchModality(pendingResult.modality)}</span></span>
          <span className="shrink-0 text-sm font-semibold text-amber-200">Cargar resultado →</span>
        </Link>
      ) : null}

      <div className="mt-6 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-200">Partidos recientes</h3>
        <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-300 hover:underline" href={withOrgQuery("/admin/matches", organizationSlug)}>Ver todos →</Link>
      </div>
      {matches.length ? (
        <ul className="mt-2 divide-y divide-slate-800">
          {matches.slice(0, 4).map((match) => (
            <li key={match.id}>
              <Link className="flex flex-wrap items-center justify-between gap-3 rounded-lg px-2 py-4 transition hover:bg-slate-800/60" href={withOrgQuery(`/admin/matches/${match.id}`, organizationSlug)}>
                <span><span className="block text-sm font-semibold text-slate-100">{formatMatchDateTime(match.scheduled_at)}</span><span className="mt-1 block text-xs text-slate-400">{formatMatchModality(match.modality)}</span></span>
                <span className="flex items-center gap-3"><span className={`rounded-full px-2.5 py-1 text-xs ${match.status === "confirmed" ? "bg-emerald-500/10 text-emerald-200" : "bg-slate-800 text-slate-300"}`}>{statusLabels[match.status]}</span><span aria-hidden="true" className="text-slate-500">→</span></span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 rounded-xl border border-dashed border-slate-700 p-5 text-sm text-slate-400">Todavía no hay partidos. Tu primer encuentro aparecerá acá.</p>
      )}
      <div className="mt-4 flex flex-wrap gap-x-6 border-t border-slate-800 pt-3">
        <Link className="inline-flex min-h-11 items-center text-sm text-slate-300 hover:text-white" href={withOrgQuery("/admin/players", organizationSlug)}>Administrar jugadores →</Link>
        <Link className="inline-flex min-h-11 items-center text-sm text-slate-300 hover:text-white" href={withOrgQuery("/admin/scorers", organizationSlug)}>Historial de goleadores →</Link>
      </div>
    </Card>
  );
}
