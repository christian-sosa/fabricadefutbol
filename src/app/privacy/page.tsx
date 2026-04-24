import Link from "next/link";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { resolvePublicModule, withPublicQuery } from "@/lib/org";

export default async function PrivacyPage({
  searchParams
}: {
  searchParams: Promise<{ org?: string; module?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const organizationKey = resolvedSearchParams.org ?? null;
  const currentModule = resolvePublicModule(resolvedSearchParams.module);

  return (
    <div className="space-y-4">
      <Card className="rounded-[2rem] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Privacidad</p>
        <CardTitle className="mt-2 text-3xl">Politica de privacidad</CardTitle>
        <CardDescription className="mt-3 text-base">
          Cuidamos la informacion de admins, jugadores y organizadores. Esta pagina resume el enfoque actual mientras dejamos publicada la version legal completa.
        </CardDescription>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Datos que usamos</CardTitle>
          <CardDescription className="mt-3">
            Cuenta de acceso, informacion del grupo o torneo y los datos necesarios para que el producto funcione y publique lo que el admin decida mostrar.
          </CardDescription>
        </Card>
        <Card>
          <CardTitle>Como lo tratamos</CardTitle>
          <CardDescription className="mt-3">
            Limitamos el acceso segun permisos del sistema y evitamos mezclar dominios para no comprometer el flujo actual de grupos y torneos.
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
        Consultar privacidad
      </Link>
    </div>
  );
}
