"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { ADMIN_NAV_ITEMS } from "@/lib/constants";
import { withOrgQuery } from "@/lib/org";
import { cn } from "@/lib/utils";

export function AdminNav({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const pathname = usePathname();
  const safePathname = pathname ?? "";
  const searchParams = useSearchParams();
  const organizationId = searchParams.get("org");
  const [mounted, setMounted] = useState(false);
  const navItems = isSuperAdmin
    ? [...ADMIN_NAV_ITEMS, { href: "/admin/super", label: "Super Admin" }]
    : ADMIN_NAV_ITEMS;

  useEffect(() => {
    setMounted(true);
  }, []);

  function isItemActive(itemHref: string) {
    if (!mounted) return false;

    if (itemHref === "/admin") {
      return safePathname.startsWith("/admin") && !safePathname.startsWith("/admin/tournaments") && !safePathname.startsWith("/admin/super");
    }

    return safePathname === itemHref || safePathname.startsWith(`${itemHref}/`);
  }

  return (
    <nav className="flex flex-wrap items-center gap-2">
      {navItems.map((item) => {
        const active = isItemActive(item.href);
        const href = withOrgQuery(item.href, organizationId);
        return (
          <Link
            className={cn(
              "rounded-md border px-3 py-2 text-xs font-semibold transition md:text-sm",
              active
                ? "border-emerald-400/50 bg-accent text-white shadow-[0_10px_20px_-14px_rgba(16,185,129,1)]"
                : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:bg-slate-800"
            )}
            href={href}
            key={item.href}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
