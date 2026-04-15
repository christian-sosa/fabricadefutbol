import { cn } from "@/lib/utils";
import { shouldRenderAds } from "@/lib/env";

export function AdPlaceholder({
  slot,
  className
}: {
  slot: string;
  className?: string;
}) {
  if (!shouldRenderAds()) {
    return null;
  }

  return (
    <aside
      className={cn(
        "rounded-2xl border border-dashed border-slate-700 bg-slate-900/70 p-4 text-sm",
        className
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Google Ads Placeholder</p>
      <p className="mt-2 font-semibold text-slate-200">Slot: {slot}</p>
      <p className="mt-1 text-slate-400">
        Espacio reservado para insertar script/unidad de Google Ads en una proxima etapa.
      </p>
    </aside>
  );
}
