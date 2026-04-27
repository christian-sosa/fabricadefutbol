"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AdminPanelError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ui] admin panel error boundary", {
      message: error.message,
      digest: error.digest
    });
  }, [error]);

  return (
    <section className="rounded-3xl border border-amber-400/30 bg-amber-500/10 p-5 shadow-[0_24px_50px_-36px_rgba(245,158,11,0.55)] md:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">
        Panel admin
      </p>
      <h1 className="mt-2 text-3xl font-black text-white">No pudimos cargar el panel</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-amber-50/85 md:text-base">
        Tu sesión y los datos del grupo siguen protegidos. Reintentá la carga o volvé al selector de grupos.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          className="rounded-md bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-95"
          onClick={reset}
          type="button"
        >
          Reintentar
        </button>
        <Link
          className="rounded-md border border-amber-200/35 bg-slate-950/60 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-slate-900"
          href="/admin"
        >
          Volver al admin
        </Link>
        <Link
          className="rounded-md border border-amber-200/35 bg-slate-950/60 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-slate-900"
          href="/feedback"
        >
          Contactar soporte
        </Link>
      </div>
    </section>
  );
}
