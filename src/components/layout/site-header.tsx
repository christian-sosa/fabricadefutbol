"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { OrganizationPublicNav } from "@/components/layout/organization-public-nav";
import { PRIMARY_PUBLIC_NAV_ITEMS } from "@/lib/constants";
import { parsePublicModule, withPublicQuery } from "@/lib/org";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type SiteHeaderProps = {
  initialIsAuthenticated?: boolean;
};

const ORGANIZATION_SECTION_PATHS = ["/groups", "/organizations", "/ranking", "/matches", "/upcoming"] as const;

function isActivePath(currentPath: string, href: string) {
  if (href === "/") {
    return currentPath === "/";
  }

  return currentPath === href || currentPath.startsWith(`${href}/`);
}

function isOrganizationSectionPath(currentPath: string) {
  return ORGANIZATION_SECTION_PATHS.some((href) => isActivePath(currentPath, href));
}

function humanizeOrganizationKey(value: string | null) {
  if (!value) return null;

  const normalized = value.trim();
  if (!normalized) return null;

  return normalized
    .split("-")
    .map((segment, index) => {
      if (!segment) return segment;
      if (index === 0) return segment.charAt(0).toUpperCase() + segment.slice(1);
      return segment;
    })
    .join(" ");
}

function MenuToggleIcon({ open }: { open: boolean }) {
  return (
    <span aria-hidden="true" className="relative flex h-5 w-5 items-center justify-center">
      <span
        className={cn(
          "absolute h-0.5 w-4 rounded-full bg-current transition-transform duration-200",
          open ? "rotate-45" : "-translate-y-1.5"
        )}
      />
      <span
        className={cn(
          "absolute h-0.5 w-4 rounded-full bg-current transition-opacity duration-200",
          open ? "opacity-0" : "opacity-100"
        )}
      />
      <span
        className={cn(
          "absolute h-0.5 w-4 rounded-full bg-current transition-transform duration-200",
          open ? "-rotate-45" : "translate-y-1.5"
        )}
      />
    </span>
  );
}

export function SiteHeader({ initialIsAuthenticated = false }: SiteHeaderProps) {
  const pathname = usePathname();
  const safePathname = pathname ?? "";
  const router = useRouter();
  const searchParams = useSearchParams();
  const organizationKey = searchParams.get("org");
  const publicModule = parsePublicModule(searchParams.get("module"));
  const searchKey = searchParams.toString();
  const [mounted, setMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(initialIsAuthenticated);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentOrganizationName, setCurrentOrganizationName] = useState<string | null>(null);

  const isOrganizationSection = isOrganizationSectionPath(safePathname);
  const shouldShowOrganizationSubnav = mounted && isOrganizationSection;
  const shouldShowMobileOrganizationSubnav = shouldShowOrganizationSubnav && !isActivePath(safePathname, "/groups");
  const organizationHubHref = withPublicQuery("/groups", {
    organizationKey,
    module: publicModule
  });
  const currentOrganizationLabel = currentOrganizationName ?? humanizeOrganizationKey(organizationKey);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setIsAuthenticated(initialIsAuthenticated);
  }, [initialIsAuthenticated]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setIsAuthenticated(Boolean(data.session?.user));
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session?.user));
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [safePathname, searchKey]);

  useEffect(() => {
    let cancelled = false;

    async function resolveOrganizationName() {
      if (!organizationKey?.trim()) {
        setCurrentOrganizationName(null);
        return;
      }

      setCurrentOrganizationName(null);
      const supabase = createSupabaseBrowserClient();
      const normalizedKey = organizationKey.trim();

      const { data: bySlug } = await supabase
        .from("organizations")
        .select("name")
        .eq("slug", normalizedKey)
        .maybeSingle();

      if (cancelled) return;

      if (bySlug?.name) {
        setCurrentOrganizationName(String(bySlug.name));
        return;
      }

      const { data: byId } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", normalizedKey)
        .maybeSingle();

      if (cancelled) return;
      setCurrentOrganizationName(byId?.name ? String(byId.name) : humanizeOrganizationKey(normalizedKey));
    }

    resolveOrganizationName();

    return () => {
      cancelled = true;
    };
  }, [organizationKey]);

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    router.refresh();
  };

  const renderAuthControls = (compact = false) =>
    isAuthenticated ? (
      <div className={cn("flex flex-wrap items-center gap-2", compact ? "w-full" : "")}>
        <Link
          className={cn(
            "rounded-xl border border-emerald-400/40 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/10 md:text-sm",
            compact ? "flex-1 text-center" : ""
          )}
          href={withPublicQuery("/admin", {
            organizationKey
          })}
        >
          Panel
        </Link>
        <button
          className={cn(
            "rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:bg-slate-900 md:text-sm",
            compact ? "flex-1" : ""
          )}
          onClick={handleSignOut}
          type="button"
        >
          Salir
        </button>
      </div>
    ) : (
      <Link
        className={cn(
          "rounded-xl border border-emerald-400/40 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/10 md:text-sm",
          compact ? "block w-full text-center" : ""
        )}
        href={withPublicQuery("/admin/login", {
          organizationKey
        })}
      >
        Ingresar / Registro
      </Link>
    );

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <Link className="flex min-w-0 items-center gap-3" href="/">
            <Image
              alt="Logo de Fabrica de Futbol"
              className="h-11 w-11 shrink-0 object-contain drop-shadow-[0_10px_18px_rgba(15,23,42,0.35)] md:h-12 md:w-12"
              height={56}
              src="/logo.png"
              width={56}
            />
            <div className="min-w-0">
              <p className="truncate text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-100 sm:text-xs lg:text-sm">
                Fabrica de Futbol
              </p>
            </div>
          </Link>

          <div className="hidden min-w-0 flex-1 items-center justify-center px-4 lg:flex">
            <nav className="flex min-w-0 items-center gap-1 xl:gap-2">
              {PRIMARY_PUBLIC_NAV_ITEMS.map((item) => {
                const active =
                  mounted &&
                  (item.href === "/groups"
                    ? isOrganizationSection
                    : isActivePath(safePathname, item.href));
                const href =
                  item.href === "/groups"
                    ? organizationHubHref
                    : withPublicQuery(item.href, {
                        organizationKey,
                        module: publicModule
                      });

                return (
                  <Link
                    className={cn(
                      "whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-semibold transition",
                      active
                        ? "border-emerald-400/50 bg-accent text-white shadow-[0_10px_20px_-14px_rgba(16,185,129,1)]"
                        : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-900"
                    )}
                    href={href}
                    key={item.label}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="hidden items-center lg:flex">{renderAuthControls()}</div>

          <button
            aria-controls="site-mobile-menu"
            aria-expanded={isMobileMenuOpen}
            aria-label={isMobileMenuOpen ? "Cerrar menu" : "Abrir menu"}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 text-slate-200 transition hover:border-slate-500 hover:bg-slate-900 lg:hidden"
            onClick={() => setIsMobileMenuOpen((current) => !current)}
            type="button"
          >
            <MenuToggleIcon open={isMobileMenuOpen} />
          </button>
        </div>

        {shouldShowOrganizationSubnav ? (
          <div className="mt-3 hidden border-t border-slate-800/90 pt-3 lg:block">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                  Grupos
                </span>
                {currentOrganizationLabel ? (
                  <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-300">
                    {currentOrganizationLabel}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">Explora un grupo para ver ranking, historial y proximos partidos.</span>
                )}
              </div>

              <OrganizationPublicNav currentPath={safePathname} module={publicModule} organizationKey={organizationKey} />
            </div>
          </div>
        ) : null}

        {isMobileMenuOpen ? (
          <div
            className="mt-3 space-y-4 rounded-2xl border border-slate-800 bg-slate-950/95 p-4 shadow-[0_24px_50px_-30px_rgba(15,23,42,0.9)] lg:hidden"
            id="site-mobile-menu"
          >
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Navegacion</p>
              <nav className="grid gap-2">
                {PRIMARY_PUBLIC_NAV_ITEMS.map((item) => {
                  const active =
                    mounted &&
                    (item.href === "/groups"
                      ? isOrganizationSection
                      : isActivePath(safePathname, item.href));
                  const href =
                    item.href === "/groups"
                      ? organizationHubHref
                      : withPublicQuery(item.href, {
                          organizationKey,
                          module: publicModule
                        });

                  return (
                    <Link
                      className={cn(
                        "rounded-xl border px-3 py-3 text-sm font-semibold transition",
                        active
                          ? "border-emerald-400/50 bg-accent text-white"
                          : "border-slate-800 bg-slate-900/80 text-slate-200 hover:border-slate-600"
                      )}
                      href={href}
                      key={item.label}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {shouldShowMobileOrganizationSubnav ? (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Submenu de Grupos
                </p>
                {currentOrganizationLabel ? (
                  <p className="text-sm font-semibold text-slate-200">{currentOrganizationLabel}</p>
                ) : (
                  <p className="text-sm text-slate-400">Explora un grupo para ver el contenido publico.</p>
                )}
                <OrganizationPublicNav
                  currentPath={safePathname}
                  itemClassName="px-3 py-2"
                  module={publicModule}
                  organizationKey={organizationKey}
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Cuenta</p>
              {renderAuthControls(true)}
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
