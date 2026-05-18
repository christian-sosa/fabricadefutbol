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

const CLUB_FEEDBACK_HREF = "/feedback?intent=club";

function resolveLogoSrc(clubId: string, logoPath: string | null) {
  return logoPath?.startsWith("/") ? logoPath : getClubLogoUrl(clubId);
}

export default async function PublicClubsPage() {
  const sites = await getPublicClubSites();

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Clubes</p>
        <div className="mt-3">
          <h1 className="max-w-3xl text-4xl font-black text-white md:text-5xl">
            Sitios oficiales de clubes en Fabrica de Futbol
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
            Cada club puede tener identidad propia, catalogo consultivo y datos deportivos publicados desde el admin.
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-orange-300/30 bg-[linear-gradient(135deg,#ff9900_0%,#ff8500_58%,#0a0908_58%,#0a0908_100%)] p-[1px]">
        <div className="grid gap-5 rounded-2xl bg-slate-950/92 p-5 md:grid-cols-[1fr_auto] md:items-center md:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-300">Clubes y equipos</p>
            <h2 className="mt-2 text-2xl font-black text-white md:text-3xl">¿Querés traer tu club o equipo?</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
              Armamos una URL propia para tu club, con identidad visual, catalogo consultivo y datos deportivos
              administrados desde Fabrica de Futbol.
            </p>
          </div>
          <Link
            className="inline-flex min-h-11 w-fit items-center justify-center rounded-md bg-orange-400 px-5 text-sm font-black text-black transition hover:bg-orange-300"
            href={CLUB_FEEDBACK_HREF}
          >
            Quiero traer mi club
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
