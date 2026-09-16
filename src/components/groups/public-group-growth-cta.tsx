import { TrackedLink } from "@/components/analytics/tracked-link";
import { GROWTH_EVENTS } from "@/lib/growth";

type PublicGroupGrowthCtaProps = {
  source: string;
};

export function PublicGroupGrowthCta({ source }: PublicGroupGrowthCtaProps) {
  return (
    <section className="border-t border-slate-800 py-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-100">
            El próximo partido, con tu grupo
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Equipos, ranking e historial. Gratis, con jugadores sin registro.
          </p>
        </div>
        <TrackedLink
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:brightness-110"
          eventName={GROWTH_EVENTS.ctaClicked}
          eventProperties={{ cta: "create_group", source }}
          href="/admin/login?mode=register&next=/admin"
        >
          Crear mi grupo gratis
        </TrackedLink>
      </div>
    </section>
  );
}
