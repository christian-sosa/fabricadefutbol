import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { GUIDES } from "@/lib/guides";

export const metadata: Metadata = {
  title: "Guías para fútbol amateur",
  description:
    "Ideas prácticas para organizar grupos de fútbol amateur: equipos parejos, ranking, historial y administración semanal."
};

export default function GuidesPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-800 bg-slate-900/80 p-6 shadow-[0_18px_40px_-28px_rgba(16,185,129,0.65)]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
          Guías
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-black text-white md:text-5xl">
          Ideas prácticas para grupos de fútbol amateur
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
          Contenido original para admins que quieren organizar mejor sus partidos:
          equipos parejos, ranking entendible, historial útil y una rutina semanal
          que no dependa de cientos de mensajes.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {GUIDES.map((guide) => (
          <Card className="flex h-full flex-col p-5" key={guide.slug}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
              {guide.readingTime}
            </p>
            <CardTitle className="mt-3 text-2xl">{guide.title}</CardTitle>
            <CardDescription className="mt-3 leading-6">{guide.description}</CardDescription>
            <div className="mt-5">
              <Link
                className="inline-flex items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                href={`/guides/${guide.slug}`}
              >
                Leer guía
              </Link>
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}
