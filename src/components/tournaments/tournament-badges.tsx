import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { TournamentMatchStatus, TournamentStatus } from "@/types/domain";

export const TOURNAMENT_STATUS_OPTIONS: TournamentStatus[] = ["draft", "active", "finished", "archived"];

export const TOURNAMENT_STATUS_LABELS: Record<TournamentStatus, string> = {
  draft: "En preparacion",
  active: "Activo",
  finished: "Finalizado",
  archived: "Archivado"
};

const tournamentStatusStyles: Record<TournamentStatus, string> = {
  draft: "border-slate-600 bg-slate-800 text-slate-200",
  active: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  finished: "border-sky-500/40 bg-sky-500/10 text-sky-200",
  archived: "border-amber-500/40 bg-amber-500/10 text-amber-200"
};

export const TOURNAMENT_MATCH_STATUS_OPTIONS: TournamentMatchStatus[] = [
  "draft",
  "scheduled",
  "played",
  "cancelled"
];

export const TOURNAMENT_MATCH_STATUS_LABELS: Record<TournamentMatchStatus, string> = {
  draft: "Sin programar",
  scheduled: "Programado",
  played: "Jugado",
  cancelled: "Cancelado"
};

const matchStatusStyles: Record<TournamentMatchStatus, string> = {
  draft: "border-slate-600 bg-slate-800 text-slate-200",
  scheduled: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  played: "border-sky-500/40 bg-sky-500/10 text-sky-200",
  cancelled: "border-rose-500/40 bg-rose-500/10 text-rose-200"
};

function BadgeFrame({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
        className
      )}
    >
      {children}
    </span>
  );
}

export function TournamentStatusBadge({ status }: { status: TournamentStatus }) {
  return <BadgeFrame className={tournamentStatusStyles[status]}>{TOURNAMENT_STATUS_LABELS[status]}</BadgeFrame>;
}

export function TournamentMatchStatusBadge({ status }: { status: TournamentMatchStatus }) {
  return <BadgeFrame className={matchStatusStyles[status]}>{TOURNAMENT_MATCH_STATUS_LABELS[status]}</BadgeFrame>;
}
