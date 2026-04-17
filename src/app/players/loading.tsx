export default function Loading() {
  return (
    <div className="space-y-3" role="status" aria-live="polite" aria-busy="true">
      <div className="h-6 w-40 animate-pulse rounded bg-slate-800" />
      <div className="grid gap-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-12 animate-pulse rounded bg-slate-900" />
        ))}
      </div>
      <span className="sr-only">Cargando jugadores...</span>
    </div>
  );
}
