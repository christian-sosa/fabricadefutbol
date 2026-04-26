import Link from "next/link";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { isTournamentsEnabled } from "@/lib/features";
import { resolvePublicModule, withPublicQuery } from "@/lib/org";

export default async function AboutPage({
  searchParams
}: {
  searchParams: Promise<{ org?: string; module?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const organizationKey = resolvedSearchParams.org ?? null;
  const currentModule = resolvePublicModule(resolvedSearchParams.module);
  const tournamentsEnabled = isTournamentsEnabled();

  return (
    <div className="space-y-4">
      <Card className="rounded-[2rem] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Sobre nosotros</p>
        <CardTitle className="mt-2 text-3xl">Fabrica de Futbol</CardTitle>
        <CardDescription className="mt-3 text-base">
          {tournamentsEnabled
            ? "Construimos herramientas para que los grupos de futbol amateur y los organizadores de torneos puedan ordenar su juego, bajar discusiones y tener datos reales despues de cada partido."
            : "Construimos herramientas para que los grupos de futbol amateur puedan ordenar su juego, bajar discusiones y tener datos reales despues de cada partido."}
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
            {tournamentsEnabled
              ? "Con un modulo para grupos y otro para torneos, manteniendo la autenticacion compartida pero sin mezclar flujos ni romper lo que ya funciona."
              : "Con un flujo simple para grupos: jugadores, niveles, partidos, rendimiento, historial y proximas fechas en un mismo lugar."}
          </CardDescription>
        </Card>
      </section>

      <Link
        className="inline-flex rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
        href={withPublicQuery("/feedback", {
          organizationKey,
          module: currentModule
        })}
      >
        Hablar con nosotros
      </Link>
    </div>
  );
}
