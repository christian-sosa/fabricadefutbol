"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { PUBLIC_NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  const safePathname = pathname ?? "";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link className="text-sm font-extrabold uppercase tracking-[0.22em] text-slate-100" href="/">
          Fabrica de Futbol
        </Link>
        <nav className="flex items-center gap-2">
          {PUBLIC_NAV_ITEMS.map((item) => {
            const active = mounted && (safePathname === item.href || safePathname.startsWith(`${item.href}/`));
            return (
              <Link
                className={cn(
                  "rounded-md border px-3 py-2 text-xs font-semibold transition md:text-sm",
                  active
                    ? "border-emerald-400/50 bg-accent text-white shadow-[0_10px_20px_-14px_rgba(16,185,129,1)]"
                    : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-900"
                )}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
