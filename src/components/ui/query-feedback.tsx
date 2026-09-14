"use client";

import { Button } from "@/components/ui/button";

export function QueryFeedback({ error, fetching, hasData, onRetry }: {
  error: boolean;
  fetching: boolean;
  hasData: boolean;
  onRetry: () => unknown;
}) {
  if (error) return <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100" role="alert">
    <p>{hasData ? "No pudimos actualizar. Estás viendo los últimos datos disponibles." : "No pudimos cargar los datos. Revisá tu conexión e intentá de nuevo."}</p>
    <Button disabled={fetching} onClick={() => { onRetry(); }} variant="secondary">{fetching ? "Reintentando…" : "Reintentar"}</Button>
  </div>;
  if (fetching) return <p className="p-3 text-xs text-slate-400" role="status">{hasData ? "Actualizando datos…" : "Cargando datos…"}</p>;
  return null;
}
