import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";
import type { MatchStatus } from "@/types/domain";

const matchStatusStyles: Record<MatchStatus, string> = {
  draft: "border border-slate-600 bg-slate-800/80 text-slate-200",
  confirmed: "border border-cyan-500/40 bg-cyan-500/15 text-cyan-200",
  finished: "border border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
  cancelled: "border border-red-500/40 bg-red-500/15 text-red-200"
};

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", className)} {...props} />;
}

export function MatchStatusBadge({ status }: { status: MatchStatus }) {
  const labels: Record<MatchStatus, string> = {
    draft: "Borrador",
    confirmed: "Confirmado",
    finished: "Finalizado",
    cancelled: "Cancelado"
  };
  return <Badge className={matchStatusStyles[status]}>{labels[status]}</Badge>;
}
