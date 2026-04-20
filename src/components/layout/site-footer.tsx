"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { PUBLIC_NAV_ITEMS } from "@/lib/constants";
import { withOrgQuery } from "@/lib/org";
import { cn } from "@/lib/utils";

const PRODUCT_LINKS = [
  { href: "/pricing", label: "Planes y suscripciones" },
  { href: "/feedback", label: "Sugerencias y contacto" },
  { href: "/help", label: "Centro de ayuda" },
  { href: "/admin", label: "Panel de organizaciones" }
] as const;

const CONTACT_PLACEHOLDERS = [
  {
    title: "Email",
    value: "info@fabricadefutbol.com.ar",
    href: "mailto:info@fabricadefutbol.com.ar",
    isPlaceholder: false
  },
  {
    title: "WhatsApp",
    value: "Completar con numero oficial",
    href: null,
    isPlaceholder: true
  },
  {
    title: "Instagram",
    value: "Completar con @usuario",
    href: null,
    isPlaceholder: true
  },
  {
    title: "Sede / Cancha",
    value: "Completar con direccion o referencia",
    href: null,
    isPlaceholder: true
  }
] as const;

const LEGAL_PLACEHOLDERS = [
  "Terminos y condiciones",
  "Politica de privacidad",
  "Base comercial / razon social"
] as const;

function FooterSectionTitle({
  className,
  children
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "text-xs font-extrabold uppercase tracking-[0.22em] text-emerald-300/90",
        className
      )}
    >
      {children}
    </p>
  );
}

export function SiteFooter() {
  const searchParams = useSearchParams();
  const organizationId = searchParams.get("org");
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-10 border-t border-slate-800/90 bg-slate-950/80">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.1),transparent_24%)]"
      />

      <div className="relative mx-auto max-w-6xl px-4 py-8 md:py-10">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/75 p-5 shadow-[0_22px_50px_-32px_rgba(16,185,129,0.55)] backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <Image
                alt="Logo de Fabrica de Futbol"
                className="h-12 w-12 rounded-full border border-slate-700 bg-white object-cover"
                height={48}
                src="/logo.png"
                width={48}
              />
              <div>
                <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-slate-100">
                  Fabrica de Futbol
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Plataforma para ordenar partidos, convocatorias, ranking y seguimiento de tu grupo.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-emerald-400/15 bg-[linear-gradient(135deg,rgba(15,23,42,0.95),rgba(8,47,73,0.92))] p-4">
              <FooterSectionTitle>Espacio Comercial</FooterSectionTitle>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Deja aqui tu propuesta de valor corta, links destacados, sponsors, promos o una invitacion a crear una
                organizacion.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-700/80 bg-slate-950/70 px-3 py-1 text-xs font-semibold text-slate-300">
                  Placeholder CTA
                </span>
                <span className="rounded-full border border-slate-700/80 bg-slate-950/70 px-3 py-1 text-xs font-semibold text-slate-300">
                  Sponsors / alianzas
                </span>
                <span className="rounded-full border border-slate-700/80 bg-slate-950/70 px-3 py-1 text-xs font-semibold text-slate-300">
                  Proximos torneos
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
            <FooterSectionTitle>Navegacion</FooterSectionTitle>
            <nav className="mt-4 space-y-2">
              {PUBLIC_NAV_ITEMS.map((item) => (
                <Link
                  className="block rounded-xl border border-transparent px-3 py-2 text-sm text-slate-300 transition hover:border-slate-700 hover:bg-slate-950/70 hover:text-slate-100"
                  href={withOrgQuery(item.href, organizationId)}
                  key={item.href}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
            <FooterSectionTitle>Producto</FooterSectionTitle>
            <div className="mt-4 space-y-2">
              {PRODUCT_LINKS.map((item) => (
                <Link
                  className="block rounded-xl border border-transparent px-3 py-2 text-sm text-slate-300 transition hover:border-slate-700 hover:bg-slate-950/70 hover:text-slate-100"
                  href={withOrgQuery(item.href, organizationId)}
                  key={item.href}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Preparado para sumar</p>
              <p className="mt-2 text-sm text-slate-400">
                FAQ corto, video demo, changelog, app de admins o cualquier enlace comercial que quieras destacar.
              </p>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
            <FooterSectionTitle>Contacto y Legal</FooterSectionTitle>

            <div className="mt-4 space-y-3">
              {CONTACT_PLACEHOLDERS.map((item) => (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-3" key={item.title}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{item.title}</p>
                  {item.href ? (
                    <a
                      className="mt-1 block text-sm font-medium text-slate-200 transition hover:text-emerald-300"
                      href={item.href}
                    >
                      {item.value}
                    </a>
                  ) : (
                    <p className="mt-1 text-sm text-slate-300">{item.value}</p>
                  )}
                  {item.isPlaceholder ? (
                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-300/90">
                      Placeholder editable
                    </p>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Legal</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {LEGAL_PLACEHOLDERS.map((item) => (
                  <span
                    className="rounded-full border border-slate-700/80 px-3 py-1 text-xs font-semibold text-slate-300"
                    key={item}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/55 px-4 py-4 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
          <p>
            © {year} Fabrica de Futbol. Footer preparado para completar con tus datos finales, links oficiales y
            legales.
          </p>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Hecho para grupos, canchas, torneos y organizaciones
          </p>
        </div>
      </div>
    </footer>
  );
}
