"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { PRIMARY_PUBLIC_NAV_ITEMS } from "@/lib/constants";
import { withPublicQuery } from "@/lib/org";

const SUPPORT_LINKS = [
  { href: "/help", label: "Ayuda" },
  { href: "/feedback", label: "Contacto" },
  { href: "/terms", label: "Términos" },
  { href: "/privacy", label: "Privacidad" }
] as const;

export function SiteFooter() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const organizationKey = searchParams.get("org");
  const compact = pathname !== "/" && pathname !== "/about";
  const links = compact
    ? SUPPORT_LINKS
    : [...PRIMARY_PUBLIC_NAV_ITEMS.filter((item) => item.href !== "/help" && item.href !== "/feedback"),
       { href: "/about", label: "Sobre nosotros" }, ...SUPPORT_LINKS];

  return (
    <footer className="mt-8 border-t border-border bg-background">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        {!compact ? (
          <div className="flex items-center gap-3">
            <Image alt="Logo de Fábrica de Fútbol" className="h-10 w-10 object-contain" height={40} src="/logo.png" width={40} />
            <div>
              <p className="text-sm font-bold text-foreground">Fábrica de Fútbol</p>
              <p className="text-sm text-muted">Tu grupo, gratis. Tus jugadores, sin registro.</p>
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <nav aria-label="Enlaces del pie de página" className="flex flex-wrap gap-x-5">
            {links.map((item) => (
              <Link
                className="inline-flex min-h-11 items-center text-sm text-slate-300 underline-offset-4 hover:text-foreground hover:underline"
                href={withPublicQuery(item.href, { organizationKey, module: "organizations" })}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <a className="inline-flex min-h-11 items-center text-sm text-muted hover:text-foreground" href="mailto:info@fabricadefutbol.com.ar">
            info@fabricadefutbol.com.ar
          </a>
        </div>
        <div className="flex flex-wrap justify-between gap-2 text-xs text-muted">
          <p>© {new Date().getFullYear()} Fábrica de Fútbol.</p>
          <p>Ranking real para grupos</p>
        </div>
      </div>
    </footer>
  );
}
