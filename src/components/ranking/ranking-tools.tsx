"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function RankingTools({ groupName, period, children }: { groupName: string; period: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <div>
    <button aria-controls={id} aria-expanded={open} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-left md:hidden" onClick={() => setOpen((value) => !value)} type="button">
      <span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-100">{groupName}</span><span className="text-xs text-slate-400">{period}</span></span>
      <span className="shrink-0 text-xs text-slate-300">{open ? "Cerrar" : "Opciones"}</span>
    </button>
    <div className={cn("space-y-3 md:space-y-4", open ? "mt-3 block" : "hidden md:block")} id={id}>{children}</div>
  </div>;
}
