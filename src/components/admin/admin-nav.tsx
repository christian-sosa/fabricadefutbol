"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ADMIN_NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function AdminNav() {
  const pathname = usePathname();
  const safePathname = pathname ?? "";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <nav className="flex flex-wrap items-center gap-2">
      {ADMIN_NAV_ITEMS.map((item) => {
        const active = mounted && (safePathname === item.href || safePathname.startsWith(`${item.href}/`));
        return (
          <Link
            className={cn(
              "rounded-md border px-3 py-2 text-xs font-semibold transition md:text-sm",
              active
                ? "border-emerald-400/50 bg-accent text-white shadow-[0_10px_20px_-14px_rgba(16,185,129,1)]"
                : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:bg-slate-800"
            )}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
