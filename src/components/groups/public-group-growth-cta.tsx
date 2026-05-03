import { TrackedLink } from "@/components/analytics/tracked-link";
import { GROWTH_EVENTS } from "@/lib/growth";

type PublicGroupGrowthCtaProps = {
  source: string;
};

export function PublicGroupGrowthCta({ source }: PublicGroupGrowthCtaProps) {
  return (
    <section className="rounded-3xl border border-emerald-400/25 bg-emerald-500/10 p-5 shadow-[0_20px_46px_-38px_rgba(16,185,129,0.8)] md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
            Para tu proximo partido
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">
            Tu grupo tambien puede tener ranking e historial
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Crea un grupo gratis, carga jugadores y comparte el primer partido por WhatsApp.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <TrackedLink
            className="inline-flex items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
            eventName={GROWTH_EVENTS.ctaClicked}
            eventProperties={{ cta: "create_group", source }}
            href="/admin/login?next=/admin"
          >
            Crear mi grupo gratis
          </TrackedLink>
          <TrackedLink
            className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
            eventName={GROWTH_EVENTS.ctaClicked}
            eventProperties={{ cta: "guides", source }}
            href="/guides"
          >
            Ver guías
          </TrackedLink>
        </div>
      </div>
    </section>
  );
}
