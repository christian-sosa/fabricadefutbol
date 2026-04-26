import Link from "next/link";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import {
  ORGANIZATION_BILLING_CURRENCY,
  ORGANIZATION_MONTHLY_PRICE_ARS,
  TOURNAMENT_MONTHLY_REFERENCE_PRICE_ARS
} from "@/lib/constants";

function formatArs(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

const pricingNotes = [
  "Grupos y Torneos se facturan por separado porque resuelven necesidades distintas.",
  "La informacion publica sigue visible para jugadores y visitantes.",
  "Cuando un periodo vence, el espacio queda protegido en modo lectura hasta reactivar el plan."
] as const;

export default function PricingPage() {
  const plans = [
    {
      title: "Grupos",
      eyebrow: "Para partidos recurrentes",
      price: `${ORGANIZATION_BILLING_CURRENCY} ${formatArs(ORGANIZATION_MONTHLY_PRICE_ARS)} / mes`,
      badge: "30 dias gratis para empezar",
      description:
        "Para amigos, equipos y grupos que juegan seguido y quieren ordenar convocatorias, equipos, rendimiento e historial.",
      cta: "Crear mi grupo",
      href: "/admin/login",
      items: [
        "Jugadores con nivel de habilidad simple",
        "Armado automatico de equipos parejos",
        "Invitados y arqueros contemplados en el balance",
        "Rendimiento competitivo actualizado por resultados",
        "Ranking, historial y proximos partidos publicos",
        "Hasta 4 administradores por grupo"
      ]
    },
    {
      title: "Torneos",
      eyebrow: "Para ligas y competencias",
      price: `${ORGANIZATION_BILLING_CURRENCY} ${formatArs(TOURNAMENT_MONTHLY_REFERENCE_PRICE_ARS)} / mes`,
      badge: "Por liga activa",
      description:
        "Para organizadores que necesitan publicar ligas con equipos, competencias, fixture, tablas y estadisticas.",
      cta: "Crear liga",
      href: "/admin/tournaments",
      items: [
        "Una liga con multiples competencias",
        "Equipos maestros reutilizables",
        "Competencias publicas para visitantes",
        "Fixture automatico o manual",
        "Capitanes opcionales por equipo",
        "Tabla, resultados, goleadores y figuras"
      ]
    }
  ] as const;

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-800 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_32%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] p-6 shadow-[0_28px_60px_-34px_rgba(16,185,129,0.7)] md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Precios</p>
        <h1 className="mt-2 text-3xl font-black text-white md:text-5xl">
          Elige el pack segun como organizas tu futbol.
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-300 md:text-base">
          Puedes empezar con un grupo, sumar una liga cuando el proyecto crezca o usar ambos modulos sin mezclar datos ni flujos.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
            href="/admin/login"
          >
            Empezar ahora
          </Link>
          <Link
            className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
            href="/help"
          >
            Ver como funciona
          </Link>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {plans.map((plan) => (
          <Card className="p-5" key={plan.title}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">{plan.eyebrow}</p>
                <CardTitle className="mt-2 text-3xl">{plan.title}</CardTitle>
                <p className="mt-2 inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                  {plan.badge}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-left sm:text-right">
                <p className="text-sm font-semibold text-slate-400">Desde</p>
                <p className="mt-1 text-xl font-black text-white">{plan.price}</p>
              </div>
            </div>

            <CardDescription className="mt-4 text-base">{plan.description}</CardDescription>

            <div className="mt-5 space-y-3">
              {plan.items.map((item) => (
                <div
                  className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-200"
                  key={item}
                >
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-5">
              <Link
                className="inline-flex rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                href={plan.href}
              >
                {plan.cta}
              </Link>
            </div>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {pricingNotes.map((note) => (
          <Card key={note}>
            <CardDescription>{note}</CardDescription>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardTitle>Que pasa cuando vence un periodo?</CardTitle>
          <CardDescription className="mt-3">
            El espacio no desaparece. La idea es conservar la informacion y pausar la edicion hasta reactivar el plan. En Grupos, las fotos de jugadores tienen una ventana de retencion para evitar costos innecesarios sin borrar el historial deportivo.
          </CardDescription>
        </Card>
        <Card>
          <CardTitle>Necesitas algo mas grande?</CardTitle>
          <CardDescription className="mt-3">
            Si organizas varias ligas, muchos grupos o necesitas una configuracion especial, escribenos y lo revisamos contigo antes de que la operacion crezca sin control.
          </CardDescription>
          <div className="mt-4">
            <Link
              className="inline-flex rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
              href="/feedback"
            >
              Contactar
            </Link>
          </div>
        </Card>
      </section>
    </div>
  );
}
