"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ui] global error boundary", {
      message: error.message,
      digest: error.digest
    });
  }, [error]);

  return (
    <section className="mx-auto max-w-3xl rounded-3xl border border-slate-800 bg-slate-900/80 p-6 text-center shadow-[0_24px_50px_-34px_rgba(16,185,129,0.65)] md:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
        Algo no salió bien
      </p>
      <h1 className="mt-3 text-3xl font-black text-white md:text-4xl">
        No pudimos cargar esta pantalla
      </h1>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
        Puede ser un corte momentáneo. Reintentá en unos segundos o volvé al inicio para seguir navegando.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
          onClick={reset}
          type="button"
        >
          Reintentar
        </button>
        <Link
          className="rounded-md border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
          href="/"
        >
          Volver al inicio
        </Link>
        <Link
          className="rounded-md border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
          href="/feedback"
        >
          Contactar soporte
        </Link>
      </div>
    </section>
  );
}
