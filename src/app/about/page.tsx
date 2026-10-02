import Link from "next/link";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { withPublicQuery } from "@/lib/org";
import { buildPublicMetadata } from "@/lib/seo";

export const metadata = buildPublicMetadata({
  title: "Sobre nosotros",
  description:
    "Conocé Fábrica de Fútbol: una herramienta gratuita para organizar fútbol entre amigos, armar equipos parejos y guardar el ranking y el historial del grupo.",
  path: "/about"
});

export default async function AboutPage({
  searchParams
}: {
  searchParams: Promise<{ org?: string; module?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const organizationKey = resolvedSearchParams.org ?? null;

  return (
    <div className="space-y-4">
      <Card className="rounded-[2rem] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Sobre nosotros</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-100">Fábrica de Fútbol</h1>
        <CardDescription className="mt-3 text-base">
          Construimos herramientas para que los grupos de futbol amateur puedan ordenar su juego, bajar discusiones y tener datos reales despues de cada partido.
        </CardDescription>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Que buscamos resolver</CardTitle>
          <CardDescription className="mt-3">
            Equipos desbalanceados, discusiones repetidas, falta de historial y poca claridad sobre quien realmente rinde mejor con el paso del tiempo.
          </CardDescription>
        </Card>
        <Card>
          <CardTitle>Como lo hacemos</CardTitle>
          <CardDescription className="mt-3">
            Con un flujo simple para grupos: jugadores, niveles, partidos, rendimiento, historial y proximas fechas en un mismo lugar.
          </CardDescription>
        </Card>
      </section>

      <Link
        className="inline-flex rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
        href={withPublicQuery("/feedback", {
          organizationKey
        })}
      >
        Hablar con nosotros
      </Link>
    </div>
  );
}
