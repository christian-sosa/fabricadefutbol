import { TrackedLink } from "@/components/analytics/tracked-link";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { GROWTH_EVENTS } from "@/lib/growth";
import { buildGroupPaymentValueState } from "@/lib/group-payment-value";
import { withOrgQuery } from "@/lib/org";

type GroupPaymentValueCardProps = {
  accessValidUntil: string | null;
  canWrite: boolean;
  finishedCount: number;
  organizationSlug: string;
  playersCount: number;
  subscriptionActive: boolean;
  totalMatches: number;
  variant: "dashboard" | "billing";
};

const toneClassNames = {
  locked: "border-amber-500/40 bg-amber-500/10 text-amber-100",
  paid: "border-emerald-500/35 bg-emerald-500/10 text-emerald-100",
  trial: "border-slate-700 bg-slate-950/70 text-slate-200",
  trial_ending: "border-amber-500/40 bg-amber-500/10 text-amber-100"
} as const;

export function GroupPaymentValueCard({
  accessValidUntil,
  canWrite,
  finishedCount,
  organizationSlug,
  playersCount,
  subscriptionActive,
  totalMatches,
  variant
}: GroupPaymentValueCardProps) {
  const state = buildGroupPaymentValueState({
    accessValidUntil,
    canWrite,
    finishedCount,
    playersCount,
    subscriptionActive,
    totalMatches
  });
  const shouldShowBillingCta = !subscriptionActive;
  const billingHref = withOrgQuery("/admin/billing", organizationSlug);

  return (
    <Card className="border-emerald-400/20 bg-slate-900/85">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
            {variant === "billing" ? "Valor del plan" : "Valor acumulado"}
          </p>
          <CardTitle className="mt-2 text-2xl">{state.headline}</CardTitle>
          <CardDescription className="mt-2 max-w-3xl text-sm">
            {state.description}
          </CardDescription>
        </div>
        <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${toneClassNames[state.accessTone]}`}>
          {state.accessDescription}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Jugadores</p>
          <p className="mt-1 text-3xl font-black text-white">{playersCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Partidos creados</p>
          <p className="mt-1 text-3xl font-black text-white">{totalMatches}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Resultados</p>
          <p className="mt-1 text-3xl font-black text-white">{finishedCount}</p>
        </div>
      </div>

      {shouldShowBillingCta ? (
        <div className="mt-5 flex flex-wrap gap-2">
          <TrackedLink
            className="inline-flex items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
            eventName={GROWTH_EVENTS.ctaClicked}
            eventProperties={{ cta: "activate_plan", source: `group_value_${variant}` }}
            href={billingHref}
          >
            Activar plan mensual
          </TrackedLink>
          <TrackedLink
            className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
            eventName={GROWTH_EVENTS.ctaClicked}
            eventProperties={{ cta: "create_match", source: `group_value_${variant}` }}
            href={withOrgQuery("/admin/matches/new", organizationSlug)}
          >
            Crear proximo partido
          </TrackedLink>
        </div>
      ) : null}
    </Card>
  );
}
