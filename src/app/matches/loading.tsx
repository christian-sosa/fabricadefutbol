export default function Loading() {
  return (
    <div className="space-y-3" role="status" aria-live="polite" aria-busy="true">
      <div className="h-6 w-44 animate-pulse rounded bg-slate-800" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-xl bg-slate-900" />
        ))}
      </div>
      <span className="sr-only">Cargando partidos...</span>
    </div>
  );
}
