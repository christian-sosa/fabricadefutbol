import type { Metadata } from "next";
import Link from "next/link";

import { LeagueLogo } from "@/components/tournaments/league-logo";
import { buildClubSitePublicHref } from "@/lib/domain/club-sites";
import { getPublicClubSites } from "@/lib/queries/clubs";
import { getClubLogoUrl } from "@/lib/team-logos";

export const metadata: Metadata = {
  title: "Clubes",
  description: "Clubes con sitio publico en Fabrica de Futbol."
};

function resolveLogoSrc(clubId: string, logoPath: string | null) {
  return logoPath?.startsWith("/") ? logoPath : getClubLogoUrl(clubId);
}

export default async function PublicClubsPage() {
  const sites = await getPublicClubSites();

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Clubes</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="max-w-3xl text-4xl font-black text-white md:text-5xl">
              Sitios oficiales de clubes en Fabrica de Futbol
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
              Cada club puede tener identidad propia, catalogo consultivo y datos deportivos publicados desde el admin.
            </p>
          </div>
          <Link
            className="w-fit rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
            href="/feedback"
          >
            ¿Querés traer tu club a Fábrica de Fútbol?
          </Link>
        </div>
      </section>

      {sites.length ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sites.map(({ club, productCount, publicHref, settings }) => (
            <article
              className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-[0_18px_40px_-28px_rgba(16,185,129,0.65)]"
              key={club.id}
            >
              <div className="flex items-start gap-3">
                <LeagueLogo alt={`Escudo de ${club.name}`} size={58} src={resolveLogoSrc(club.id, club.logo_path)} />
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-bold text-white">{club.name}</h2>
                  {club.home_venue ? <p className="mt-1 text-sm text-slate-400">{club.home_venue}</p> : null}
                </div>
              </div>
              {club.description ? <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-300">{club.description}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full border border-slate-700 px-3 py-1 text-slate-300">
                  {productCount} productos
                </span>
                {settings.domain ? (
                  <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-emerald-200">
                    Dominio propio
                  </span>
                ) : null}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <a
                  className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                  href={publicHref}
                >
                  Ver sitio
                </a>
                {settings.sectionVisibility.catalog ? (
                  <a
                    className="rounded-md border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-400/60 hover:text-emerald-300"
                    href={buildClubSitePublicHref(club, settings, "/catalogo")}
                  >
                    Catalogo
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/70 p-6">
          <h2 className="text-xl font-bold text-white">Todavia no hay clubes publicados.</h2>
          <p className="mt-2 text-sm text-slate-400">
            Cuando un admin habilite y publique el sitio de un club, va a aparecer aca.
          </p>
        </section>
      )}
    </div>
  );
}
