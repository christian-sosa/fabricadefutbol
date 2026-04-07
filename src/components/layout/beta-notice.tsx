import Link from "next/link";

import { ORGANIZATION_BILLING_CURRENCY, ORGANIZATION_MONTHLY_PRICE_ARS } from "@/lib/constants";

function formatCurrencyArs(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: ORGANIZATION_BILLING_CURRENCY,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

export function BetaNotice() {
  return (
    <section className="border-b border-amber-500/35 bg-amber-500/10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs text-amber-100 md:text-sm">
        <p>
          Proba 1 mes gratis por organizacion. Luego, {formatCurrencyArs(ORGANIZATION_MONTHLY_PRICE_ARS)} por mes para
          seguir con escritura habilitada.
        </p>
        <Link className="font-semibold underline underline-offset-2 hover:text-amber-50" href="/pricing">
          Ver precios
        </Link>
      </div>
    </section>
  );
}
