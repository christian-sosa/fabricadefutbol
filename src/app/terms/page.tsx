import Link from "next/link";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { isTournamentsEnabled } from "@/lib/features";
import { resolvePublicModule, withPublicQuery } from "@/lib/org";

export default async function TermsPage({
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
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">Terminos</p>
        <CardTitle className="mt-2 text-3xl">Terminos y condiciones</CardTitle>
        <CardDescription className="mt-3 text-base">
          Esta pagina queda como placeholder legal mientras terminamos la version definitiva de terminos y condiciones del servicio.
        </CardDescription>
      </Card>

      <Card>
        <CardTitle>Estado actual</CardTitle>
        <CardDescription className="mt-3">
          {tournamentsEnabled
            ? "Estamos preparando el documento final con condiciones de uso, suscripciones, facturacion y responsabilidades de administradores, capitanes y usuarios."
            : "Estamos preparando el documento final con condiciones de uso, suscripciones, facturacion y responsabilidades de administradores y usuarios."}
        </CardDescription>
      </Card>

      <Link
        className="inline-flex rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
        href={withPublicQuery("/feedback", {
          organizationKey,
          module: currentModule
        })}
      >
        Consultar por terminos
      </Link>
    </div>
  );
}
