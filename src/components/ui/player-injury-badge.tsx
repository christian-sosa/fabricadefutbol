import { cn } from "@/lib/utils";

export function PlayerInjuryBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-md border border-red-400/40 bg-red-500/10 px-1.5 py-0.5 text-xs font-medium text-red-200", className)}
      title="Lesionado: no se considera inactivo"
    >
      <svg aria-hidden="true" className="h-4 w-4 shrink-0" focusable="false" viewBox="0 0 20 20">
        <rect fill="#dc2626" height="20" rx="2" width="20" />
        <path d="M8 4h4v4h4v4h-4v4H8v-4H4V8h4V4Z" fill="#fff" />
      </svg>
      Lesionado
    </span>
  );
}
