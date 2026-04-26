"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { PRIMARY_PUBLIC_NAV_ITEMS } from "@/lib/constants";
import { isTournamentsEnabled } from "@/lib/features";
import { parsePublicModule, withPublicQuery } from "@/lib/org";
import { cn } from "@/lib/utils";

const COMPANY_LINKS = [{ href: "/about", label: "Sobre nosotros" }] as const;

const LEGAL_LINKS = [
  { href: "/terms", label: "Términos" },
  { href: "/privacy", label: "Privacidad" }
] as const;

const CONTACT_METHODS = [
  {
    title: "Mail",
    value: "info@fabricadefutbol.com.ar",
    description: "Soporte para admins, grupos y organizadores.",
    href: "mailto:info@fabricadefutbol.com.ar"
  }
] as const;

function FooterSectionTitle({
  className,
  children
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p className={cn("text-xs font-extrabold uppercase tracking-[0.22em] text-emerald-300/90", className)}>
      {children}
    </p>
  );
}

export function SiteFooter() {
  const searchParams = useSearchParams();
  const organizationId = searchParams.get("org");
  const publicModule = parsePublicModule(searchParams.get("module"));
  const year = new Date().getFullYear();
  const tournamentsEnabled = isTournamentsEnabled();

  return (
    <footer className="relative mt-10 border-t border-slate-800/90 bg-slate-950/95">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent"
      />

      <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <section className="rounded-3xl border border-slate-800 bg-slate-900/75 p-5 shadow-[0_22px_50px_-32px_rgba(16,185,129,0.55)]">
            <div className="flex items-center gap-3">
              <Image
                alt="Logo de Fábrica de Fútbol"
                className="h-14 w-14 object-contain"
                height={56}
                src="/logo.png"
                width={56}
              />
              <div>
                <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-slate-100">Fábrica de Fútbol</p>
                <p className="mt-1 text-xs text-slate-400">
                  Organizá partidos con equipos parejos, ranking real e historial sin romper la dinámica de tu grupo.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
            <FooterSectionTitle>Navegación</FooterSectionTitle>
            <nav className="mt-4 space-y-2">
              {PRIMARY_PUBLIC_NAV_ITEMS.map((item) => (
                <Link
                  className="block rounded-xl border border-transparent px-3 py-2 text-sm text-slate-300 transition hover:border-slate-700 hover:bg-slate-950/70 hover:text-slate-100"
                  href={withPublicQuery(item.href, {
                    organizationKey: organizationId,
                    module: publicModule
                  })}
                  key={item.href}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
            <FooterSectionTitle>Empresa</FooterSectionTitle>
            <div className="mt-4 space-y-2">
              {COMPANY_LINKS.map((item) => (
                <Link
                  className="block rounded-xl border border-transparent px-3 py-2 text-sm text-slate-300 transition hover:border-slate-700 hover:bg-slate-950/70 hover:text-slate-100"
                  href={withPublicQuery(item.href, {
                    organizationKey: organizationId,
                    module: publicModule
                  })}
                  key={item.href}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Legal</p>
              <div className="mt-2 space-y-2">
                {LEGAL_LINKS.map((item) => (
                  <Link
                    className="block rounded-xl border border-transparent px-3 py-2 text-sm text-slate-300 transition hover:border-slate-700 hover:bg-slate-900 hover:text-slate-100"
                    href={withPublicQuery(item.href, {
                      organizationKey: organizationId,
                      module: publicModule
                    })}
                    key={item.href}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
            <FooterSectionTitle>Contacto</FooterSectionTitle>
            <div className="mt-4 space-y-3">
              {CONTACT_METHODS.map((item) => (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-3" key={item.title}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{item.title}</p>
                  {item.href ? (
                    <a
                      className="mt-1 block text-sm font-medium text-emerald-300 transition hover:underline"
                      href={item.href}
                    >
                      {item.value}
                    </a>
                  ) : (
                    <p className="mt-1 text-sm font-medium text-slate-200">{item.value}</p>
                  )}
                  <p className="mt-2 text-sm text-slate-400">{item.description}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
              <p className="text-sm text-slate-300">
                Soporte pensado para admins, grupos y organizadores que no quieren perder lo que ya tienen cargado.
              </p>
            </div>
          </section>
        </div>

        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/55 px-4 py-4 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
          <p>Copyright {year} Fábrica de Fútbol. Todos los derechos reservados.</p>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            {tournamentsEnabled ? "Ranking real para grupos y torneos" : "Ranking real para grupos"}
          </p>
        </div>
      </div>
    </footer>
  );
}
