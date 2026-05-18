import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Barlow_Condensed, Manrope } from "next/font/google";

import { LeagueLogo } from "@/components/tournaments/league-logo";
import { getClubProductImageUrl, getClubSiteHeroUrl } from "@/lib/club-site-media";
import {
  buildClubProductContactHref,
  buildClubSitePublicHref,
  formatClubSiteFontFamily,
  type ClubProductRecord
} from "@/lib/domain/club-sites";
import type {
  ClubPublicActivity,
  ClubPublicMatch,
  ClubPublicPlayerStat,
  ClubPublicTeam
} from "@/lib/domain/clubs";
import type { PublicClubSiteDetails } from "@/lib/queries/clubs";
import { getPublicAppUrl } from "@/lib/public-url";
import { getClubLogoUrl } from "@/lib/team-logos";

type ClubSitePageKey = "home" | "catalogo" | "equipo";

const clubBodyFont = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-club-body"
});

const clubDisplayFont = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  variable: "--font-club-display"
});

const PLATFORM_URL = getPublicAppUrl();

function resolveClubLogoSrc(data: PublicClubSiteDetails) {
  return data.club.logo_path?.startsWith("/") ? data.club.logo_path : getClubLogoUrl(data.club.id);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    timeZone: "America/Buenos_Aires"
  }).format(new Date(value));
}

function formatRecordValue(label: string, row: ClubPublicPlayerStat) {
  if (label.includes("goleador")) return row.goals;
  if (label.includes("asistidor")) return row.assists;
  if (label.includes("figuras")) return row.mvps;
  if (label.includes("presencias")) return row.attendances ?? row.matchesPlayed;
  return row.matchesPlayed;
}

function StatTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-sm border border-[var(--club-line)] bg-white p-4 text-black shadow-[0_18px_44px_rgba(85,47,9,0.08)]">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-black/45">{label}</p>
      <p className="mt-2 text-4xl font-black leading-none [font-family:var(--font-club-display)]">{value}</p>
    </div>
  );
}

function getClubHeroHeadline(data: PublicClubSiteDetails) {
  if (data.club.slug === "la-quinta") {
    return "Esta locura de amarte me impide ser normal";
  }

  return data.club.name;
}

function ClubSiteNav({ active, data }: { active: ClubSitePageKey; data: PublicClubSiteDetails }) {
  const { club, settings } = data;
  const links = [
    { key: "home", href: buildClubSitePublicHref(club, settings), label: "Inicio", visible: true },
    {
      key: "equipo",
      href: buildClubSitePublicHref(club, settings, "/equipo"),
      label: "Informacion",
      visible: settings.sectionVisibility.teamData
    },
    {
      key: "catalogo",
      href: buildClubSitePublicHref(club, settings, "/catalogo"),
      label: "Catalogo",
      visible: settings.sectionVisibility.catalog
    }
  ] as const;

  return (
    <nav className="flex flex-wrap items-center justify-center gap-2">
      {links.filter((link) => link.visible).map((link) => (
        <Link
          className={
            active === link.key
              ? "rounded-sm bg-[var(--club-primary)] px-4 py-2 text-sm font-extrabold text-white"
              : "rounded-sm border border-[var(--club-line)] bg-white px-4 py-2 text-sm font-extrabold text-[var(--club-primary)] transition hover:border-[var(--club-primary)] hover:bg-[var(--club-soft)]"
          }
          href={link.href}
          key={link.key}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

function PlatformBackLink() {
  return (
    <a
      className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-xl border border-emerald-400/35 bg-slate-950 px-3 py-2 text-xs font-extrabold uppercase tracking-[0.12em] text-emerald-100 shadow-[0_16px_34px_-24px_rgba(16,185,129,0.9)] transition hover:border-emerald-300 hover:bg-slate-900 md:justify-self-end"
      href={PLATFORM_URL}
    >
      <Image
        alt="Logo de Fabrica de Futbol"
        className="h-7 w-7 object-contain"
        height={28}
        src="/logo.png"
        width={28}
      />
      <span>Volver a Fabrica de Futbol</span>
    </a>
  );
}

function ClubSiteHeader({ active, data }: { active: ClubSitePageKey; data: PublicClubSiteDetails }) {
  const { club, settings } = data;
  const homeVenue = club.home_venue?.trim();
  const shouldShowHomeVenue = Boolean(homeVenue && homeVenue.toLowerCase() !== club.name.toLowerCase());
  return (
    <header className="border-b border-[var(--club-line)] bg-white/95">
      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 md:grid-cols-[1fr_auto_1fr] md:items-center md:px-6">
        <Link className="flex w-fit items-center gap-3 md:justify-self-start" href={buildClubSitePublicHref(club, settings)}>
          <LeagueLogo
            alt={`Escudo de ${club.name}`}
            className="rounded-sm border-[var(--club-line)] bg-white"
            size={62}
            src={resolveClubLogoSrc(data)}
          />
          <div>
            <p className="text-2xl font-black leading-none text-[var(--club-primary)] [font-family:var(--font-club-display)]">
              {club.name}
            </p>
            {shouldShowHomeVenue ? <p className="mt-1 text-sm font-semibold text-black/50">{homeVenue}</p> : null}
          </div>
        </Link>
        <ClubSiteNav active={active} data={data} />
        <PlatformBackLink />
      </div>
    </header>
  );
}

function ClubSiteStatsStrip({ data }: { data: PublicClubSiteDetails }) {
  const { snapshot } = data;

  return (
    <div className="bg-[var(--club-primary)] text-white">
      <div className="mx-auto grid max-w-5xl grid-cols-3 gap-3 px-4 py-6 text-center md:px-6">
        <div>
          <p className="text-4xl font-black leading-none [font-family:var(--font-club-display)]">
            {snapshot.summary.teamCount}
          </p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white/78">Equipos</p>
        </div>
        <div>
          <p className="text-4xl font-black leading-none [font-family:var(--font-club-display)]">
            {snapshot.summary.playerCount}
          </p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white/78">Jugadores</p>
        </div>
        <div>
          <p className="text-4xl font-black leading-none [font-family:var(--font-club-display)]">
            {snapshot.summary.totalMatches}
          </p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white/78">Partidos</p>
        </div>
      </div>
    </div>
  );
}

function ClubSiteHomeHero({ active, data }: { active: ClubSitePageKey; data: PublicClubSiteDetails }) {
  const { club, settings } = data;
  const heroUrl = getClubSiteHeroUrl(club.id, settings);
  const heroHeadline = getClubHeroHeadline(data);

  return (
    <section className="bg-white text-[var(--club-ink)]">
      <ClubSiteHeader active={active} data={data} />
      <div className="mx-auto max-w-5xl px-4 py-9 text-center md:px-6 md:py-12">
        <h1 className="mx-auto max-w-3xl text-5xl font-black uppercase leading-[0.94] text-[var(--club-primary)] [font-family:var(--font-club-display)] md:text-7xl">
          {heroHeadline}
        </h1>
      </div>

      <div className="relative min-h-[300px] overflow-hidden bg-[var(--club-primary)] md:min-h-[460px]">
        <Image
          alt={`${club.name} Futbol Club`}
          className="object-cover"
          fill
          priority
          sizes="100vw"
          src={heroUrl}
          unoptimized
        />
      </div>

      <ClubSiteStatsStrip data={data} />
    </section>
  );
}

function ClubSiteFooter({ data }: { data: PublicClubSiteDetails }) {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-7 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex items-center gap-3">
          <Image
            alt="Logo de Fabrica de Futbol"
            className="h-12 w-12 object-contain"
            height={48}
            src="/logo.png"
            width={48}
          />
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-emerald-200">Fabrica de Futbol</p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-300">
              Este sitio pertenece a Fabrica de Futbol. {data.club.name} administra su contenido publico desde la
              plataforma.
            </p>
          </div>
        </div>
        <a
          className="w-fit rounded-xl border border-emerald-400/35 px-4 py-2 text-sm font-extrabold text-emerald-100 transition hover:bg-emerald-500/10"
          href={PLATFORM_URL}
        >
          Conocer Fabrica de Futbol
        </a>
      </div>
    </footer>
  );
}

export function ClubSiteShell({
  active,
  children,
  data
}: {
  active: ClubSitePageKey;
  children: ReactNode;
  data: PublicClubSiteDetails;
}) {
  const { settings } = data;
  const style = {
    "--club-primary": settings.primaryColor,
    "--club-secondary": settings.secondaryColor,
    "--club-accent": settings.accentColor,
    "--club-page": "#ffffff",
    "--club-soft": "#fff8ef",
    "--club-line": "#f2e1cd",
    "--club-ink": "#151515",
    fontFamily: formatClubSiteFontFamily(settings.fontFamily)
  } as CSSProperties;

  return (
    <div
      className={`${clubBodyFont.variable} ${clubDisplayFont.variable} flex min-h-screen w-full flex-col overflow-hidden bg-[var(--club-page)] text-[var(--club-ink)]`}
      style={style}
    >
      {active === "home" ? <ClubSiteHomeHero active={active} data={data} /> : <ClubSiteHeader active={active} data={data} />}
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 md:px-6 md:py-14">{children}</div>
      <ClubSiteFooter data={data} />
    </div>
  );
}

function ProductCard({ data, product }: { data: PublicClubSiteDetails; product: ClubProductRecord }) {
  const imageUrl = getClubProductImageUrl(product);
  const contactHref = buildClubProductContactHref({
    clubName: data.club.name,
    product,
    settings: data.settings
  });
  const statusLabel = product.status === "preorder"
    ? "Preventa"
    : product.status === "sold_out"
      ? "Consultar disponibilidad"
      : "Disponible";

  return (
    <article className="group overflow-hidden rounded-md border border-black/10 bg-white shadow-[0_18px_44px_-34px_rgba(0,0,0,0.55)]">
      <div className="relative aspect-[4/5] overflow-hidden bg-[#151515]">
        {imageUrl ? (
          <Image
            alt={product.name}
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            src={imageUrl}
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#111_0%,#272727_52%,var(--club-primary)_53%,var(--club-primary)_100%)] p-8 text-center text-4xl font-black uppercase leading-none text-white [font-family:var(--font-club-display)]">
            {product.name}
          </div>
        )}
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            {product.category ? (
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-black/45">{product.category}</p>
            ) : null}
            <h2 className="mt-1 text-3xl font-black leading-none [font-family:var(--font-club-display)]">{product.name}</h2>
          </div>
          <span className="shrink-0 rounded-sm bg-black px-2 py-1 text-xs font-black text-white">{statusLabel}</span>
        </div>
        {product.description ? <p className="text-sm leading-6 text-black/62">{product.description}</p> : null}
        <div className="flex items-center justify-between gap-3 border-t border-black/10 pt-3">
          <p className="text-sm font-black text-black">{product.price_label ?? "Consultar precio"}</p>
          {contactHref ? (
            <a
              className="rounded-md bg-[var(--club-accent)] px-4 py-2 text-sm font-black text-black transition hover:brightness-95"
              href={contactHref}
              rel="noreferrer"
              target="_blank"
            >
              Consultar
            </a>
          ) : (
            <span className="px-4 py-2 text-sm font-black text-black/50">Sin contacto</span>
          )}
        </div>
      </div>
    </article>
  );
}

function LatestMatch({ match }: { match: ClubPublicMatch }) {
  return (
    <div className="rounded-md border border-black/10 bg-white p-4">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-black/45">{formatDate(match.playedAt)}</p>
      <p className="mt-2 text-lg font-extrabold">
        {match.teamName} vs {match.opponentName}
      </p>
      <p className="mt-2 text-5xl font-black leading-none text-[var(--club-primary)] [font-family:var(--font-club-display)]">
        {match.goalsFor} - {match.goalsAgainst}
      </p>
    </div>
  );
}

function ActivityItem({ item }: { item: ClubPublicActivity }) {
  return (
    <li className="border-b border-black/10 py-4 last:border-0">
      <p className="text-sm font-extrabold">{item.title}</p>
      {item.description ? <p className="mt-1 text-sm text-black/60">{item.description}</p> : null}
    </li>
  );
}

export function ClubSiteHome({ data }: { data: PublicClubSiteDetails }) {
  const { products, settings, snapshot } = data;
  const featuredProducts = products.slice(0, 3);

  return (
    <ClubSiteShell active="home" data={data}>
      {settings.sectionVisibility.catalog && featuredProducts.length ? (
        <section>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--club-primary)]">Catalogo</p>
              <h2 className="mt-2 text-5xl font-black uppercase leading-none [font-family:var(--font-club-display)]">Productos destacados</h2>
            </div>
            <Link className="w-fit rounded-md bg-black px-4 py-2 text-sm font-black text-white transition hover:bg-[var(--club-primary)] hover:text-black" href={buildClubSitePublicHref(data.club, settings, "/catalogo")}>
              Ver catalogo
            </Link>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {featuredProducts.map((product) => (
              <ProductCard data={data} key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}

      {settings.sectionVisibility.matches && snapshot.recentMatches.length ? (
        <section className="mt-14">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--club-primary)]">Equipo</p>
          <h2 className="mt-2 text-5xl font-black uppercase leading-none [font-family:var(--font-club-display)]">Ultimos partidos</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {snapshot.recentMatches.slice(0, 3).map((match) => (
              <LatestMatch key={match.id} match={match} />
            ))}
          </div>
        </section>
      ) : null}

      {settings.sectionVisibility.activity && snapshot.activity.length ? (
        <section className="mt-14 rounded-md border border-black/10 bg-white p-5">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--club-primary)]">Actividad</p>
          <h2 className="mt-2 text-5xl font-black uppercase leading-none [font-family:var(--font-club-display)]">Novedades recientes</h2>
          <ul className="mt-4">
            {snapshot.activity.slice(0, 5).map((item) => (
              <ActivityItem item={item} key={`${item.type}-${item.createdAt}-${item.title}`} />
            ))}
          </ul>
        </section>
      ) : null}

      {settings.instagramUrl || settings.whatsappUrlOrPhone ? (
        <section className="mt-14 rounded-md border border-black/10 bg-[#101312] p-5 text-white shadow-[0_18px_44px_-34px_rgba(0,0,0,0.65)]">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--club-primary)]">Contacto</p>
          <h2 className="mt-2 text-4xl font-black uppercase leading-none [font-family:var(--font-club-display)]">Canales oficiales</h2>
          <div className="mt-5 flex flex-wrap gap-2">
            {settings.instagramUrl ? (
              <a className="rounded-md border border-white/20 px-4 py-2 text-sm font-black transition hover:bg-white/10" href={settings.instagramUrl} rel="noreferrer" target="_blank">
                Instagram
              </a>
            ) : null}
            {settings.whatsappUrlOrPhone ? (
              <a
                className="rounded-md bg-[var(--club-accent)] px-4 py-2 text-sm font-black text-black transition hover:brightness-95"
                href={buildClubProductContactHref({
                  clubName: data.club.name,
                  product: {
                    contact_channel: "whatsapp",
                    contact_message: `Hola ${data.club.name}, quiero hacer una consulta.`,
                    contact_url: null,
                    name: data.club.name
                  },
                  settings
                })}
                rel="noreferrer"
                target="_blank"
              >
                WhatsApp
              </a>
            ) : null}
          </div>
        </section>
      ) : null}
    </ClubSiteShell>
  );
}

function buildCategoryHref(data: PublicClubSiteDetails, category: string | null) {
  const baseHref = buildClubSitePublicHref(data.club, data.settings, "/catalogo");
  if (!category) return baseHref;
  const separator = baseHref.includes("?") ? "&" : "?";
  return `${baseHref}${separator}categoria=${encodeURIComponent(category)}`;
}

export function ClubSiteCatalog({
  category,
  data
}: {
  category?: string | null;
  data: PublicClubSiteDetails;
}) {
  const categories = Array.from(
    new Set(data.products.map((product) => product.category).filter((value): value is string => Boolean(value)))
  ).sort((left, right) => left.localeCompare(right, "es"));
  const selectedCategory = category && categories.includes(category) ? category : null;
  const products = selectedCategory
    ? data.products.filter((product) => product.category === selectedCategory)
    : data.products;

  return (
    <ClubSiteShell active="catalogo" data={data}>
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--club-primary)]">Catalogo</p>
          <h1 className="mt-2 text-6xl font-black uppercase leading-[0.9] [font-family:var(--font-club-display)] md:text-7xl">Productos del club</h1>
          <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-black/62">
            Elegis el producto y coordinas la compra por WhatsApp, Instagram o el canal que defina el club.
          </p>
        </div>
      </section>

      {categories.length ? (
        <nav className="mt-7 flex gap-2 overflow-x-auto pb-2">
          <Link
            className={!selectedCategory ? "shrink-0 rounded-md bg-black px-4 py-2 text-sm font-black text-white" : "shrink-0 rounded-md border border-black/15 bg-white px-4 py-2 text-sm font-black text-black transition hover:border-black/35"}
            href={buildCategoryHref(data, null)}
          >
            Todo
          </Link>
          {categories.map((item) => (
            <Link
              className={selectedCategory === item ? "shrink-0 rounded-md bg-black px-4 py-2 text-sm font-black text-white" : "shrink-0 rounded-md border border-black/15 bg-white px-4 py-2 text-sm font-black text-black transition hover:border-black/35"}
              href={buildCategoryHref(data, item)}
              key={item}
            >
              {item}
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard data={data} key={product.id} product={product} />
        ))}
      </div>

      {!products.length ? (
        <div className="mt-6 rounded-md border border-black/10 bg-white p-6">
          <p className="text-lg font-extrabold">Todavia no hay productos visibles.</p>
          <p className="mt-2 text-sm text-black/60">Cuando el admin publique productos, aparecen automaticamente aca.</p>
        </div>
      ) : null}
    </ClubSiteShell>
  );
}

function TeamCard({ team }: { team: ClubPublicTeam }) {
  return (
    <article className="rounded-md border border-black/10 bg-white p-4">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-black/45">{team.modality}</p>
      <h2 className="mt-1 text-4xl font-black leading-none [font-family:var(--font-club-display)]">{team.name}</h2>
      {team.players.length ? (
        <p className="mt-3 text-sm leading-6 text-black/62">{team.players.slice(0, 8).map((player) => player.name).join(" / ")}</p>
      ) : null}
    </article>
  );
}

export function ClubSiteTeamData({ data }: { data: PublicClubSiteDetails }) {
  const { settings, snapshot } = data;
  const records = [
    snapshot.records.topScorerAllTime
      ? { label: "Maximo goleador", row: snapshot.records.topScorerAllTime }
      : null,
    snapshot.records.topAssistsAllTime
      ? { label: "Maximo asistidor", row: snapshot.records.topAssistsAllTime }
      : null,
    snapshot.records.mostMvps ? { label: "Mas figuras", row: snapshot.records.mostMvps } : null,
    snapshot.records.mostAttendances ? { label: "Mas presencias", row: snapshot.records.mostAttendances } : null
  ].filter(Boolean) as Array<{ label: string; row: ClubPublicPlayerStat }>;

  return (
    <ClubSiteShell active="equipo" data={data}>
      <section>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--club-primary)]">Informacion</p>
        <h1 className="mt-2 text-6xl font-black uppercase leading-[0.9] [font-family:var(--font-club-display)] md:text-7xl">Rendimiento publico</h1>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatTile label="Equipos" value={snapshot.summary.teamCount} />
          <StatTile label="Jugadores" value={snapshot.summary.playerCount} />
          <StatTile label="Partidos" value={snapshot.summary.playedMatches} />
          <StatTile label="Goles favor" value={snapshot.summary.goalsFor} />
          <StatTile label="Goles contra" value={snapshot.summary.goalsAgainst} />
        </div>
      </section>

      {settings.sectionVisibility.teams && snapshot.teams.length ? (
        <section className="mt-14">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--club-primary)]">Planteles</p>
          <h2 className="mt-2 text-5xl font-black uppercase leading-none [font-family:var(--font-club-display)]">Equipos activos</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {snapshot.teams.map((team) => (
              <TeamCard key={team.id} team={team} />
            ))}
          </div>
        </section>
      ) : null}

      {settings.sectionVisibility.records && records.length ? (
        <section className="mt-14">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--club-primary)]">Records</p>
          <h2 className="mt-2 text-5xl font-black uppercase leading-none [font-family:var(--font-club-display)]">Referentes historicos</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            {records.map((record) => (
              <div className="rounded-md border border-black/10 bg-white p-4" key={record.label}>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-black/45">{record.label}</p>
                <p className="mt-2 text-xl font-extrabold">{record.row.name}</p>
                <p className="mt-2 text-5xl font-black leading-none text-[var(--club-primary)] [font-family:var(--font-club-display)]">
                  {formatRecordValue(record.label, record.row)}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {settings.sectionVisibility.playerStats && snapshot.playerStats.length ? (
        <section className="mt-14 overflow-hidden rounded-md border border-black/10 bg-white">
          <div className="p-5">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--club-primary)]">Jugadores</p>
            <h2 className="mt-2 text-5xl font-black uppercase leading-none [font-family:var(--font-club-display)]">Tabla destacada</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="bg-black text-white">
                <tr>
                  <th className="px-4 py-3">Jugador</th>
                  <th className="px-4 py-3">PJ</th>
                  <th className="px-4 py-3">Goles</th>
                  <th className="px-4 py-3">Asistencias</th>
                  <th className="px-4 py-3">Figuras</th>
                  <th className="px-4 py-3">Ultimo</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.playerStats.slice(0, 12).map((row) => (
                  <tr className="border-b border-black/10 last:border-0" key={row.playerId}>
                    <td className="px-4 py-3 font-black">{row.name}</td>
                    <td className="px-4 py-3">{row.matchesPlayed}</td>
                    <td className="px-4 py-3">{row.goals}</td>
                    <td className="px-4 py-3">{row.assists}</td>
                    <td className="px-4 py-3">{row.mvps}</td>
                    <td className="px-4 py-3">{row.lastMatchDate ? formatDate(row.lastMatchDate) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </ClubSiteShell>
  );
}
