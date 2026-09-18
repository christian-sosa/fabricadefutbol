import { cn } from "@/lib/utils";

export function PlayerInjuryBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-md border border-sky-400/30 bg-sky-400/10 px-1.5 py-0.5 text-xs font-medium text-sky-200", className)}
      title="Lesionado: no se considera ausente"
    >
      <svg aria-hidden="true" className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 20 20">
        <path d="M7 3h6v4h4v6h-4v4H7v-4H3V7h4V3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
      Lesionado
    </span>
  );
}
