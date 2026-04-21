import Link from "next/link";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { resolvePublicModule, withPublicQuery } from "@/lib/org";

export default async function PricingPage({
  searchParams
}: {
  searchParams: Promise<{ org?: string; module?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const organizationKey = resolvedSearchParams.org ?? null;
  const currentModule = resolvePublicModule(resolvedSearchParams.module);
  const helpPath = withPublicQuery("/help", {
    organizationKey,
    module: currentModule
  });
  const contactPath = withPublicQuery("/feedback", {
    organizationKey,
    module: currentModule
  });
  const plans = [
    {
      title: "Organizaciones",
      cadence: "Por organizacion / mes",
      description:
        "Pensado para grupos que gestionan jugadores, convocatorias, partidos balanceados, historial y ranking competitivo.",
      items: [
        "Gestion de jugadores y admins",
        "Armado de partidos y equipos balanceados",
        "Ranking, historial y proximos encuentros",
        "Facturacion independiente del modulo torneos"
      ]
    },
    {
      title: "Torneos",
      cadence: "Por torneo / temporada",
      description:
        "Orientado a ligas simples con equipos, capitanes, planteles propios, fixture, actas, tabla y estadisticas.",
      items: [
        "Equipos, jugadores y fotos del torneo",
        "Invitaciones a capitanes para completar planteles",
        "Fixture, resultados, figuras y goleadores",
        "Billing separado para cada competicion"
      ]
    }
  ] as const;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-800 bg-slate-900/75 p-5 shadow-[0_24px_40px_-30px_rgba(16,185,129,0.7)] md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">Precios</p>
        <h1 className="mt-2 text-3xl font-black text-slate-100 md:text-5xl">Planes listos para ambos modulos</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-300 md:text-base">
          La misma cuenta admin puede manejar Organizaciones y Torneos, pero cada modulo tendra su propia logica de
          facturacion. Por ahora dejamos el esquema armado con precio placeholder hasta definir el valor final.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_-14px_rgba(16,185,129,1)]"
            href={withPublicQuery("/admin/login", {
              organizationKey
            })}
          >
            Ingresar al panel
          </Link>
          <Link
            className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
            href={helpPath}
          >
            Ver ayuda
          </Link>
          <Link
            className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
            href={contactPath}
          >
            Consultar precios
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {plans.map((plan) => (
          <Card key={plan.title}>
            <CardDescription>{plan.cadence}</CardDescription>
            <div className="mt-2 flex items-end justify-between gap-3">
              <CardTitle className="text-2xl">{plan.title}</CardTitle>
              <div className="text-right">
                <p className="text-3xl font-black text-slate-100">XXX</p>
                <p className="text-xs uppercase tracking-[0.18em] text-amber-300">Precio a definir</p>
              </div>
            </div>
            <CardDescription className="mt-3">{plan.description}</CardDescription>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              {plan.items.map((item) => (
                <p key={item}>- {item}</p>
              ))}
            </div>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Como queda pensado el billing</CardTitle>
          <CardDescription className="mt-2">
            Un mismo admin podra contratar solo Organizaciones, solo Torneos o ambos modulos. La autenticacion se
            comparte, pero la facturacion se resolvera por modulo para evitar mezclar necesidades distintas.
          </CardDescription>
        </Card>
        <Card>
          <CardTitle>Que pasa si un modulo vence</CardTitle>
          <CardDescription className="mt-2">
            La idea es mantener la informacion publica visible y dejar el modulo correspondiente en modo lectura hasta
            reactivar la suscripcion. El detalle final de esa politica tambien queda sujeto al esquema comercial.
          </CardDescription>
        </Card>
      </section>
    </div>
  );
}
