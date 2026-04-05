"use client";

import { useEffect, useState } from "react";
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

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link className="text-sm font-extrabold uppercase tracking-[0.22em] text-slate-100" href="/">
          Fabrica de Futbol
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-2">
          {PUBLIC_NAV_ITEMS.map((item) => {
            const active = mounted && (safePathname === item.href || safePathname.startsWith(`${item.href}/`));
            const href = withOrgQuery(item.href, organizationId);
            return (
              <Link
                className={cn(
                  "rounded-md border px-3 py-2 text-xs font-semibold transition md:text-sm",
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

          {isAuthenticated ? (
            <>
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
            </>
          ) : (
            <Link
              className="rounded-md border border-emerald-400/40 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/10 md:text-sm"
              href="/admin/login"
            >
              Ingresar / Registro
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
