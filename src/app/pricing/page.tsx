import Link from "next/link";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ORGANIZATION_BILLING_CURRENCY, ORGANIZATION_MONTHLY_PRICE_ARS } from "@/lib/constants";
import { resolvePublicModule, withPublicQuery } from "@/lib/org";

function formatArs(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

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
      title: "Pack Organizaciones",
      price: `${ORGANIZATION_BILLING_CURRENCY} ${formatArs(ORGANIZATION_MONTHLY_PRICE_ARS)} / mes`,
      badge: "30 dias gratis",
      description:
        "Ideal para grupos que quieren dejar de discutir equipos y empezar a llevar ranking, historial y estadisticas reales.",
      items: [
        "Hasta 30 jugadores por organizacion",
        "Armado de partidos y equipos equilibrados",
        "Ranking automatico despues de cada resultado",
        "Historial completo y proximos partidos"
      ]
    },
    {
      title: "Pack Torneos",
      price: "ARS XXX / temporada",
      badge: "Valor a definir",
      description:
        "Pensado para ligas y organizadores que necesitan equipos, planteles propios, fixture, actas y estadisticas publicas.",
      items: [
        "Equipos, jugadores y fotos por torneo",
        "Invitaciones para capitanes",
        "Fixture, resultados, goleadores y figuras",
        "Tabla de posiciones y vallas menos vencidas"
      ]
    }
  ] as const;

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-800 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_32%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] p-6 shadow-[0_28px_60px_-34px_rgba(16,185,129,0.7)] md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Precios</p>
        <h1 className="mt-2 text-3xl font-black text-white md:text-5xl">Packs claros en pesos para cada necesidad</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-300 md:text-base">
          Un mismo admin puede gestionar Organizaciones y Torneos, pero cada modulo tiene su propia logica y su propia facturacion.
          Aqui ves rapido que incluye cada pack y como se cobra.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
            href="/admin/login"
          >
            Crear mi grupo gratis
          </Link>
          <Link
            className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
            href={contactPath}
          >
            Consultar precios
          </Link>
          <Link
            className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
            href={helpPath}
          >
            Ver ayuda
          </Link>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {plans.map((plan) => (
          <Card className="p-5" key={plan.title}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">{plan.badge}</p>
                <CardTitle className="mt-2 text-2xl">{plan.title}</CardTitle>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-right">
                <p className="text-sm font-black text-white">{plan.price}</p>
              </div>
            </div>
            <CardDescription className="mt-4">{plan.description}</CardDescription>
            <div className="mt-5 space-y-3">
              {plan.items.map((item) => (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-200" key={item}>
                  {item}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Que incluye el modulo Organizaciones</CardTitle>
          <CardDescription className="mt-3">
            El plan cubre la gestion diaria del grupo: jugadores, partidos, equilibrio de equipos, ranking automatico, historial y proximos encuentros.
          </CardDescription>
        </Card>
        <Card>
          <CardTitle>Que incluye el modulo Torneos</CardTitle>
          <CardDescription className="mt-3">
            El plan cubre la operacion de una competicion: equipos, capitanes, planteles, fixture, carga de resultados y estadisticas publicas.
          </CardDescription>
        </Card>
      </section>
    </div>
  );
}
