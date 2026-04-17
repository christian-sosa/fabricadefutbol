export default function Loading() {
  return (
    <div className="space-y-3" role="status" aria-live="polite" aria-busy="true">
      <div className="h-8 w-48 animate-pulse rounded bg-slate-800" />
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-xl bg-slate-900" />
        ))}
      </div>
      <span className="sr-only">Cargando panel...</span>
    </div>
  );
}
