"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { PUBLIC_NAV_ITEMS } from "@/lib/constants";
import { withOrgQuery } from "@/lib/org";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type SiteHeaderProps = {
  initialIsAuthenticated?: boolean;
};

export function SiteHeader({ initialIsAuthenticated = false }: SiteHeaderProps) {
  const pathname = usePathname();
  const safePathname = pathname ?? "";
  const router = useRouter();
  const searchParams = useSearchParams();
  const organizationId = searchParams.get("org");
  const [mounted, setMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(initialIsAuthenticated);

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

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    router.refresh();
  };

  const renderAuthControls = (compact = false) =>
    isAuthenticated ? (
      <div className={cn("flex items-center gap-2", compact ? "shrink-0" : "")}>
        <Link
          className="rounded-md border border-emerald-400/40 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/10 md:text-sm"
          href={withOrgQuery("/admin", organizationId)}
        >
          Panel
        </Link>
        <button
          className="rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:bg-slate-900 md:text-sm"
          onClick={handleSignOut}
          type="button"
        >
          Salir
        </button>
      </div>
    ) : (
      <Link
        className={cn(
          "rounded-md border border-emerald-400/40 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/10 md:text-sm",
          compact ? "shrink-0" : ""
        )}
        href="/admin/login"
      >
        Ingresar / Registro
      </Link>
    );

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/85 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center justify-between gap-3">
            <Link className="flex min-w-0 items-center gap-3" href="/">
              <Image
                alt="Logo de Fabrica de Futbol"
                className="h-10 w-10 rounded-full border border-slate-700 bg-white object-cover"
                height={40}
                src="/logo.png"
                width={40}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold uppercase tracking-[0.18em] text-slate-100">
                  Fabrica de Futbol
                </p>
              </div>
            </Link>
            <div className="md:hidden">{renderAuthControls(true)}</div>
          </div>

          <div className="flex flex-col gap-3 md:flex-1 md:flex-row md:items-center md:justify-end">
            <nav className="scrollbar-none flex w-full items-center gap-2 overflow-x-auto pb-1 md:w-auto md:flex-wrap md:justify-end md:overflow-visible md:pb-0">
              {PUBLIC_NAV_ITEMS.map((item) => {
                const active = mounted && (safePathname === item.href || safePathname.startsWith(`${item.href}/`));
                const href = withOrgQuery(item.href, organizationId);
                return (
                  <Link
                    className={cn(
                      "whitespace-nowrap rounded-md border px-3 py-2 text-xs font-semibold transition md:text-sm",
                      active
                        ? "border-emerald-400/50 bg-accent text-white shadow-[0_10px_20px_-14px_rgba(16,185,129,1)]"
                        : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-900"
                    )}
                    href={href}
                    key={item.href}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="hidden md:flex md:items-center">{renderAuthControls()}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
