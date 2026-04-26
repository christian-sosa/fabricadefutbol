import { ORGANIZATION_MONTHLY_PRICE_ARS } from "@/lib/constants";

function formatAmountArs(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

export function BetaNotice() {
  return (
    <section className="border-b border-amber-500/35 bg-amber-500/10">
      <div className="mx-auto max-w-6xl px-4 py-2 text-xs text-amber-100 md:text-sm">
        <p>
          Probá 1 mes gratis por organización. Después, ${formatAmountArs(ORGANIZATION_MONTHLY_PRICE_ARS)}/mes
          para seguir creando partidos.
        </p>
      </div>
    </section>
  );
}
