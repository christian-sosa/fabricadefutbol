import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Barlow_Condensed, Manrope } from "next/font/google";

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
type ClubSocialLink = {
  href: string;
  label: "Instagram" | "TikTok" | "YouTube" | "WhatsApp";
};
type ClubIconName = ClubSocialLink["label"] | "Shop";

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
const LA_QUINTA_EXTRA_SOCIAL_LINKS: ClubSocialLink[] = [
  { href: "https://www.tiktok.com/@laquintajrs", label: "TikTok" },
  { href: "https://youtube.com/@laquintafutbolclub-w2y?si=0BIryUsQI44l4f7G", label: "YouTube" }
];

function resolveClubLogoSrc(data: PublicClubSiteDetails) {
  return data.club.logo_path?.startsWith("/") ? data.club.logo_path : getClubLogoUrl(data.club.id);
}

function ClubSocialIcon({ label }: { label: ClubIconName }) {
  if (label === "Instagram") {
    return (
      <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
        <rect height="16" rx="5" stroke="currentColor" strokeWidth="2" width="16" x="4" y="4" />
        <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="2" />
        <circle cx="17" cy="7" fill="currentColor" r="1.2" />
      </svg>
    );
  }

  if (label === "WhatsApp") {
    return (
      <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
        <path d="M5.4 19.1 6.5 15a7.4 7.4 0 1 1 3 2.8l-4.1 1.3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
        <path d="M9.2 8.7c.2-.4.4-.5.7-.5h.6c.2 0 .4.1.5.4l.7 1.6c.1.2.1.4-.1.6l-.4.5c-.1.1-.2.3 0 .5.4.8 1.1 1.5 2 2 .2.1.4.1.5 0l.6-.6c.2-.2.4-.2.7-.1l1.5.7c.3.1.4.3.4.6 0 .5-.1.9-.4 1.2-.3.4-.8.6-1.4.6-2.7-.1-6.3-3.3-6.6-6.2-.1-.5 0-.9.2-1.3Z" fill="currentColor" />
      </svg>
    );
  }

  if (label === "YouTube") {
    return (
      <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
        <rect height="12" rx="3.5" stroke="currentColor" strokeWidth="2" width="18" x="3" y="6" />
        <path d="m11 10 4 2-4 2v-4Z" fill="currentColor" />
      </svg>
    );
  }

  if (label === "TikTok") {
    return (
      <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
        <path d="M14 4v8.9a4 4 0 1 1-3.8-4V12a1.8 1.8 0 1 0 1.8 1.8V4h2Z" fill="currentColor" />
        <path d="M14 4c.5 2.6 2 4.1 4.4 4.5v2.2A7.7 7.7 0 0 1 14 8.9V4Z" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path d="M7 9h10l-.8 10H7.8L7 9Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
      <path d="M9 9a3 3 0 0 1 6 0" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function ClubSiteLogoMark({
  data,
  size = 70
}: {
  data: PublicClubSiteDetails;
  size?: number;
}) {
  return (
    <span
      className="relative block overflow-visible"
      style={{ height: size, width: size }}
    >
      <Image
        alt={`Escudo de ${data.club.name}`}
        className="object-contain mix-blend-multiply"
        fill
        sizes={`${size}px`}
        src={resolveClubLogoSrc(data)}
        unoptimized
      />
    </span>
  );
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

function getCatalogCategories(data: PublicClubSiteDetails) {
  return Array.from(
    new Set(data.products.map((product) => product.category).filter((value): value is string => Boolean(value)))
  ).sort((left, right) => left.localeCompare(right, "es"));
}

function buildClubContactHref(data: PublicClubSiteDetails) {
  return buildClubProductContactHref({
    clubName: data.club.name,
    product: {
      contact_channel: "whatsapp",
      contact_message: `Hola ${data.club.name}, quiero hacer una consulta.`,
      contact_url: null,
      name: data.club.name
    },
    settings: data.settings
  });
}

function resolveClubSocialLinks(data: PublicClubSiteDetails): ClubSocialLink[] {
  const links: ClubSocialLink[] = [];

  if (data.settings.instagramUrl) links.push({ href: data.settings.instagramUrl, label: "Instagram" });
  if (data.settings.whatsappUrlOrPhone) links.push({ href: buildClubContactHref(data), label: "WhatsApp" });
  if (data.club.slug === "la-quinta") links.push(...LA_QUINTA_EXTRA_SOCIAL_LINKS);

  const seen = new Set<string>();
  return links.filter((link) => {
    const key = `${link.label}:${link.href}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return Boolean(link.href);
  });
}

function ClubSiteNav({ active, data }: { active: ClubSitePageKey; data: PublicClubSiteDetails }) {
  const { club, settings } = data;
  const links = [
    { key: "home", href: buildClubSitePublicHref(club, settings), label: "Inicio", visible: true },
    {
      key: "catalogo",
      href: buildClubSitePublicHref(club, settings, "/catalogo"),
      label: "Productos",
      visible: settings.sectionVisibility.catalog
    },
    {
      key: "equipo",
      href: buildClubSitePublicHref(club, settings, "/equipo"),
      label: "Informacion",
      visible: settings.sectionVisibility.teamData
    },
    {
      key: "contacto",
      href: "#contacto",
      label: "Contacto",
      visible: true
    }
  ] as const;

  return (
    <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
      {links.filter((link) => link.visible).map((link) => (
        <Link
          className={
            active === link.key
              ? "border-b-2 border-[var(--club-primary)] pb-1 text-sm font-black uppercase tracking-[0.16em] text-[var(--club-primary)]"
              : "pb-1 text-sm font-black uppercase tracking-[0.16em] text-black/62 transition hover:text-[var(--club-primary)]"
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
      className="inline-flex min-h-9 w-fit items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-black shadow-[0_12px_24px_-22px_rgba(0,0,0,0.55)] transition hover:border-[var(--club-primary)] hover:text-[var(--club-primary)]"
      href={PLATFORM_URL}
    >
      <Image
        alt="Logo de Fabrica de Futbol"
        className="h-6 w-6 object-contain"
        height={24}
        src="/logo.png"
        width={24}
      />
      <span>Fabrica de Futbol</span>
    </a>
  );
}

function ClubSiteHeader({ active, data }: { active: ClubSitePageKey; data: PublicClubSiteDetails }) {
  const { club, settings } = data;
  const homeVenue = club.home_venue?.trim();
  const shouldShowHomeVenue = Boolean(homeVenue && homeVenue.toLowerCase() !== club.name.toLowerCase());
  return (
    <header className="border-b border-[var(--club-line)] bg-white">
      <div className="mx-auto grid max-w-7xl gap-3 px-4 py-3 md:grid-cols-[1fr_auto_1fr] md:items-center md:px-6">
        <p className="hidden items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-black/45 md:flex">
          <ClubSocialIcon label="Shop" />
          <span>Catalogo online</span>
        </p>
        <Link className="flex flex-col items-center gap-2 text-center" href={buildClubSitePublicHref(club, settings)}>
          <ClubSiteLogoMark data={data} />
          <div>
            <p className="text-4xl font-black uppercase leading-none text-[var(--club-primary)] [font-family:var(--font-club-display)] md:text-5xl">
              {club.name}
            </p>
            {shouldShowHomeVenue ? <p className="mt-1 text-sm font-semibold text-black/50">{homeVenue}</p> : null}
          </div>
        </Link>
        <div className="justify-self-center md:justify-self-end">
          <PlatformBackLink />
        </div>
      </div>
      <div className="border-t border-[var(--club-line)] px-4 py-3">
        <ClubSiteNav active={active} data={data} />
      </div>
      {settings.sectionVisibility.catalog ? <ClubSiteCategoryRail data={data} selectedCategory={null} /> : null}
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
  const contactHref = buildClubContactHref(data);

  return (
    <section className="bg-white text-[var(--club-ink)]">
      <ClubSiteHeader active={active} data={data} />
      <div className="mx-auto max-w-5xl px-4 py-8 text-center md:px-6 md:py-11">
        <p className="inline-flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-black/45">
          <ClubSocialIcon label="Shop" />
          <span>Tienda oficial</span>
        </p>
        <h1 className="mx-auto mt-3 max-w-3xl text-5xl font-black uppercase leading-[0.94] text-[var(--club-primary)] [font-family:var(--font-club-display)] md:text-7xl">
          {heroHeadline}
        </h1>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {contactHref ? (
            <a
              className="rounded-full bg-black px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-white transition hover:bg-[var(--club-primary)]"
              href={contactHref}
              rel="noreferrer"
              target="_blank"
            >
              Contactanos
            </a>
          ) : null}
          <Link
            className="inline-flex items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-black transition hover:border-[var(--club-primary)] hover:text-[var(--club-primary)]"
            href={buildClubSitePublicHref(club, settings, "/catalogo")}
          >
            <ClubSocialIcon label="Shop" />
            <span>Ir al shop</span>
          </Link>
        </div>
      </div>

      <div className="bg-white px-4 pb-8 md:px-6 md:pb-10">
        <div className="relative mx-auto aspect-[4/3] max-w-6xl overflow-hidden bg-white md:aspect-[3/2]">
          <Image
            alt={`${club.name} Futbol Club`}
            className="object-contain"
            fill
            priority
            sizes="(min-width: 1280px) 1152px, 100vw"
            src={heroUrl}
            unoptimized
          />
        </div>
      </div>

      <ClubSiteStatsStrip data={data} />
    </section>
  );
}

function ClubSiteFooter({ data }: { data: PublicClubSiteDetails }) {
  const socialLinks = resolveClubSocialLinks(data);

  return (
    <footer id="contacto" className="border-t border-[var(--club-line)] bg-white text-black">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-5 px-4 py-9 text-center md:px-6">
        <div className="flex flex-col items-center gap-3">
          <ClubSiteLogoMark data={data} size={58} />
          <div>
            <p className="text-4xl font-black uppercase leading-none text-[var(--club-primary)] [font-family:var(--font-club-display)]">
              {data.club.name}
            </p>
            <p className="mt-2 text-sm font-semibold text-black/55">Catalogo, redes y contacto oficial del club.</p>
          </div>
        </div>

        {socialLinks.length ? (
          <div className="flex flex-wrap justify-center gap-3">
            {socialLinks.map((link) => (
              <a
                aria-label={link.label}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-black shadow-[0_18px_40px_-30px_rgba(0,0,0,0.7)] transition hover:border-[var(--club-primary)] hover:bg-[var(--club-primary)] hover:text-white"
                href={link.href}
                key={`${link.label}-${link.href}`}
                rel="noreferrer"
                target="_blank"
                title={link.label}
              >
                <ClubSocialIcon label={link.label} />
              </a>
            ))}
          </div>
        ) : null}

        <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-black uppercase tracking-[0.14em] text-black/58">
          <Link className="transition hover:text-[var(--club-primary)]" href={buildClubSitePublicHref(data.club, data.settings)}>
            Inicio
          </Link>
          <Link className="transition hover:text-[var(--club-primary)]" href={buildClubSitePublicHref(data.club, data.settings, "/catalogo")}>
            Productos
          </Link>
          <Link className="transition hover:text-[var(--club-primary)]" href={buildClubSitePublicHref(data.club, data.settings, "/equipo")}>
            Informacion
          </Link>
        </nav>

        <div className="flex flex-col items-center gap-2 border-t border-[var(--club-line)] pt-5">
          <Image
            alt="Logo de Fabrica de Futbol"
            className="h-10 w-10 object-contain"
            height={40}
            src="/logo.png"
            width={40}
          />
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-black/45">Fabrica de Futbol</p>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-black/55">
              Este catalogo pertenece a Fabrica de Futbol. {data.club.name} administra su contenido publico desde la plataforma.
            </p>
          </div>
        </div>
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
  const contactLabel = product.contact_channel === "instagram"
    ? "Consultar por Instagram"
    : product.contact_channel === "custom"
      ? "Consultar"
      : "Consultar por WhatsApp";
  const statusLabel = product.status === "preorder"
    ? "Preventa"
    : product.status === "sold_out"
      ? "Consultar disponibilidad"
      : "Disponible";

  return (
    <article className="group overflow-hidden rounded-sm border border-black/10 bg-white shadow-[0_26px_62px_-48px_rgba(0,0,0,0.7)] transition hover:-translate-y-0.5 hover:shadow-[0_34px_78px_-50px_rgba(0,0,0,0.78)]">
      <div className="relative aspect-[4/5] overflow-hidden bg-white">
        {imageUrl ? (
          <Image
            alt={product.name}
            className="object-contain p-6 drop-shadow-[0_24px_22px_rgba(0,0,0,0.22)] transition duration-300 group-hover:scale-[1.035]"
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            src={imageUrl}
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-sm border border-black/10 bg-white p-8 text-center shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-black/35">Producto oficial</p>
              <p className="mt-3 text-4xl font-black uppercase leading-none text-[var(--club-primary)] [font-family:var(--font-club-display)]">
                {product.name}
              </p>
            </div>
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/92 px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-black shadow-[0_12px_24px_-20px_rgba(0,0,0,0.7)]">
          {statusLabel}
        </span>
      </div>
      <div className="space-y-3 p-4">
        <div>
          {product.category ? (
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-black/45">{product.category}</p>
          ) : null}
          <h2 className="mt-1 text-3xl font-black leading-none [font-family:var(--font-club-display)]">{product.name}</h2>
        </div>
        {product.description ? <p className="text-sm leading-6 text-black/62">{product.description}</p> : null}
        <div className="flex flex-col gap-3 border-t border-black/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-black/35">Precio</p>
            <p className="text-sm font-black text-black">{product.price_label ?? "Consultar precio"}</p>
          </div>
          {contactHref ? (
            <a
              className="rounded-full bg-[var(--club-accent)] px-4 py-2 text-center text-sm font-black text-black transition hover:brightness-95"
              href={contactHref}
              rel="noreferrer"
              target="_blank"
            >
              {contactLabel}
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
  const featuredProducts = products.slice(0, 4);
  const socialLinks = resolveClubSocialLinks(data);

  return (
    <ClubSiteShell active="home" data={data}>
      {settings.sectionVisibility.catalog && featuredProducts.length ? (
        <section>
          <div className="overflow-hidden rounded-md border border-[var(--club-line)]">
            <ClubSiteCategoryRail data={data} selectedCategory={null} />
          </div>
          <div className="mt-8 flex flex-col gap-3 text-center sm:items-center">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--club-primary)]">Shop</p>
              <h2 className="mt-2 text-5xl font-black uppercase leading-none [font-family:var(--font-club-display)]">Destacados</h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm font-medium leading-6 text-black/58">
                Catalogo visual del club. Cada consulta abre el canal que defina el equipo.
              </p>
            </div>
            <Link className="w-fit rounded-full bg-black px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-[var(--club-primary)]" href={buildClubSitePublicHref(data.club, settings, "/catalogo")}>
              Tienda completa
            </Link>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
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

      {socialLinks.length ? (
        <section className="mt-14 rounded-md border border-black/10 bg-[#101312] p-5 text-white shadow-[0_18px_44px_-34px_rgba(0,0,0,0.65)]">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--club-primary)]">Contacto</p>
          <h2 className="mt-2 text-4xl font-black uppercase leading-none [font-family:var(--font-club-display)]">Canales oficiales</h2>
          <div className="mt-5 flex flex-wrap gap-3">
            {socialLinks.map((link) => (
              <a
                aria-label={link.label}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white text-black transition hover:border-[var(--club-primary)] hover:bg-[var(--club-primary)] hover:text-white"
                href={link.href}
                key={`${link.label}-${link.href}-home`}
                rel="noreferrer"
                target="_blank"
                title={link.label}
              >
                <ClubSocialIcon label={link.label} />
              </a>
            ))}
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

function ClubSiteCategoryRail({
  data,
  selectedCategory
}: {
  data: PublicClubSiteDetails;
  selectedCategory: string | null;
}) {
  const categories = getCatalogCategories(data);
  if (!categories.length) return null;

  return (
    <nav className="border-t border-[var(--club-line)] bg-[var(--club-soft)]">
      <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3 md:justify-center md:px-6">
        <Link
          className={!selectedCategory ? "shrink-0 rounded-full bg-black px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white" : "shrink-0 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-black transition hover:border-[var(--club-primary)] hover:text-[var(--club-primary)]"}
          href={buildCategoryHref(data, null)}
        >
          Todo
        </Link>
        {categories.map((item) => (
          <Link
            className={selectedCategory === item ? "shrink-0 rounded-full bg-black px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white" : "shrink-0 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-black transition hover:border-[var(--club-primary)] hover:text-[var(--club-primary)]"}
            href={buildCategoryHref(data, item)}
            key={item}
          >
            {item}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function ClubSiteCatalog({
  category,
  data
}: {
  category?: string | null;
  data: PublicClubSiteDetails;
}) {
  const categories = getCatalogCategories(data);
  const selectedCategory = category && categories.includes(category) ? category : null;
  const products = selectedCategory
    ? data.products.filter((product) => product.category === selectedCategory)
    : data.products;

  return (
    <ClubSiteShell active="catalogo" data={data}>
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--club-primary)]">Shop</p>
          <h1 className="mt-2 text-6xl font-black uppercase leading-[0.9] [font-family:var(--font-club-display)] md:text-7xl">Productos</h1>
          <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-black/62">
            Elegis el producto y consultas por WhatsApp, Instagram o el canal que defina el club.
          </p>
        </div>
      </section>

      <div className="mt-7 overflow-hidden rounded-md border border-[var(--club-line)]">
        <ClubSiteCategoryRail data={data} selectedCategory={selectedCategory} />
      </div>

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
