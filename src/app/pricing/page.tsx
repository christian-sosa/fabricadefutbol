import Link from "next/link";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import {
  ORGANIZATION_BILLING_CURRENCY,
  ORGANIZATION_MONTHLY_PRICE_ARS
} from "@/lib/constants";

function formatArs(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

export default function PricingPage() {
  const plans = [
    {
      title: "Pack Grupos",
      price: `${ORGANIZATION_BILLING_CURRENCY} ${formatArs(ORGANIZATION_MONTHLY_PRICE_ARS)} / mes`,
      badge: "1 mes gratis",
      description:
        `1 mes de prueba gratis por organización. Después, $${formatArs(ORGANIZATION_MONTHLY_PRICE_ARS)}/mes para seguir creando.`,
      items: [
        "Hasta 30 jugadores por grupo",
        "Creá partidos con equipos parejos",
        "Comparte el proximo partido y los equipos con tus companeros apenas lo generas",
        "Ranking automatico despues de cada resultado",
        "Historial completo"
      ]
    },
    {
      title: "Pack Torneos",
      price: "Gratis por ahora",
      badge: "Acceso temporal",
      description:
        "Pensado para ligas y organizadores que necesitan crear y administrar varios torneos o subtorneos. Por ahora el acceso esta liberado sin cobro.",
      items: [
        "Varios torneos o subtorneos por organizador",
        "Fixture automatico o armado manual fecha por fecha",
        "Capitanes opcionales segun cada admin",
        "Hasta 4 administradores por torneo",
        "Tabla, fixture y estadisticas publicas para compartir"
      ]
    }
  ] as const;

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-800 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_32%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] p-6 shadow-[0_28px_60px_-34px_rgba(16,185,129,0.7)] md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Precios</p>
        <h1 className="mt-2 text-3xl font-black text-white md:text-5xl">Packs claros en pesos para cada necesidad</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-300 md:text-base">
          Un mismo admin puede gestionar Grupos y Torneos. Hoy Grupos tiene facturacion activa y Torneos esta
          liberado gratis de forma temporal mientras terminamos de definir ese esquema.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
            href="/admin/login"
          >
            Crear mi grupo gratis
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
          <CardTitle>Que incluye el pack Grupos</CardTitle>
          <CardDescription className="mt-3">
            El pack cubre la gestion diaria del grupo: jugadores, partidos, equipos parejos, ranking automatico,
            historial completo y la posibilidad de compartir el proximo partido ya armado.
          </CardDescription>
        </Card>
        <Card>
          <CardTitle>Que incluye el pack Torneos</CardTitle>
          <CardDescription className="mt-3">
            El acceso actual cubre la operacion de una competicion: varios subtorneos, fixture automatico o manual,
            capitanes opcionales, hasta 4 admins y estadisticas publicas.
          </CardDescription>
        </Card>
      </section>
    </div>
  );
}
