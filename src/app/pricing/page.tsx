import Link from "next/link";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ORGANIZATION_BILLING_CURRENCY, ORGANIZATION_MONTHLY_PRICE_ARS } from "@/lib/constants";
import { withOrgQuery } from "@/lib/org";

function formatCurrencyArs(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: ORGANIZATION_BILLING_CURRENCY,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

export default async function PricingPage({
  searchParams
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const organizationKey = resolvedSearchParams.org ?? null;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-800 bg-slate-900/75 p-5 shadow-[0_24px_40px_-30px_rgba(16,185,129,0.7)] md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">Precios</p>
        <h1 className="mt-2 text-3xl font-black text-slate-100 md:text-5xl">Plan claro y simple</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-300 md:text-base">
          Empiezas con 1 mes gratis por organizacion. Luego, si quieres seguir con escritura habilitada, el costo es{" "}
          <span className="font-semibold text-emerald-300">{formatCurrencyArs(ORGANIZATION_MONTHLY_PRICE_ARS)}</span>{" "}
          por mes por organizacion.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_-14px_rgba(16,185,129,1)]"
            href={withOrgQuery("/admin/login", organizationKey)}
          >
            Ingresar al panel
          </Link>
          <Link
            className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
            href={withOrgQuery("/help", organizationKey)}
          >
            Ver FAQ
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Incluye 30 dias gratis</CardTitle>
          <CardDescription className="mt-2">
            Cada organizacion nueva empieza con prueba gratuita de 30 dias. Durante ese periodo puedes cargar jugadores,
            crear partidos y gestionar admins sin costo.
          </CardDescription>
        </Card>
        <Card>
          <CardTitle>Luego {formatCurrencyArs(ORGANIZATION_MONTHLY_PRICE_ARS)} / mes</CardTitle>
          <CardDescription className="mt-2">
            El precio aplica por organizacion y por ciclo mensual de 30 dias. El pago se gestiona con Mercado Pago desde
            la seccion de facturacion.
          </CardDescription>
        </Card>
      </section>

      <Card>
        <CardTitle>Que pasa si no pago al terminar el mes gratis?</CardTitle>
        <CardDescription className="mt-2">
          La organizacion queda en modo solo lectura: la informacion publica sigue visible, pero se bloquea la edicion
          hasta activar un nuevo mes.
        </CardDescription>
      </Card>
    </div>
  );
}
