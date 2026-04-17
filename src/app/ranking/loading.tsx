export default function Loading() {
  return (
    <div className="space-y-3" role="status" aria-live="polite" aria-busy="true">
      <div className="h-6 w-32 animate-pulse rounded bg-slate-800" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-10 animate-pulse rounded bg-slate-900" />
        ))}
      </div>
      <span className="sr-only">Cargando ranking...</span>
    </div>
  );
}
