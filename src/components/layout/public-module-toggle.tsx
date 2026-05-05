import Link from "next/link";

import { type PublicModuleContext, withPublicQuery } from "@/lib/org";
import { cn } from "@/lib/utils";

const MODULE_OPTIONS = [
  {
    value: "organizations",
    label: "Grupos",
    description: "Partidos, ranking y planteles"
  },
  {
    value: "tournaments",
    label: "Torneos",
    description: "Equipos, fixture y estadisticas"
  }
] as const satisfies ReadonlyArray<{
  value: PublicModuleContext;
  label: string;
  description: string;
}>;

type PublicModuleToggleProps = {
  basePath: string;
  currentModule: PublicModuleContext;
  organizationKey?: string | null;
  className?: string;
};

export function PublicModuleToggle({
  basePath,
  currentModule,
  organizationKey,
  className
}: PublicModuleToggleProps) {
  return (
    <div
      className={cn(
        "inline-flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-2",
        className
      )}
    >
      {MODULE_OPTIONS.map((option) => {
        const active = option.value === currentModule;

        return (
          <Link
            className={cn(
              "min-w-[190px] rounded-xl border px-4 py-3 transition",
              active
                ? "border-emerald-400/55 bg-emerald-500/12 text-white shadow-[0_12px_28px_-20px_rgba(16,185,129,0.95)]"
                : "border-slate-800 bg-slate-900/80 text-slate-200 hover:border-slate-600 hover:bg-slate-900"
            )}
            href={withPublicQuery(basePath, {
              organizationKey,
              module: option.value
            })}
            key={option.value}
          >
            <span className="block text-sm font-semibold">{option.label}</span>
            <span className={cn("mt-1 block text-[11px]", active ? "text-emerald-100/85" : "text-slate-400")}>
              {option.description}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
