"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { withOrgQuery } from "@/lib/org";

type AdminSubnavItem = {
  href: string;
  label: string;
  active: boolean;
};

function buildOrganizationItems(pathname: string, organizationKey: string | null): AdminSubnavItem[] {
  const isMatchArea = pathname === "/admin/matches" || pathname.startsWith("/admin/matches/");
  const isAdminsArea = pathname === "/admin/admins";

  return [
    {
      href: withOrgQuery("/admin", organizationKey),
      label: "Resumen",
      active: pathname === "/admin"
    },
    {
      href: withOrgQuery("/admin/players", organizationKey),
      label: "Jugadores",
      active: pathname === "/admin/players"
    },
    {
      href: withOrgQuery("/admin/matches", organizationKey),
      label: "Partidos",
      active: isMatchArea
    },
    {
      href: withOrgQuery("/admin/scorers", organizationKey),
      label: "Goleadores",
      active: pathname === "/admin/scorers"
    },
    {
      href: withOrgQuery("/admin/admins", organizationKey),
      label: "Admins",
      active: isAdminsArea
    }
  ];
}

export function AdminSubnav() {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const organizationKey = searchParams.get("org");


  if (
    !pathname.startsWith("/admin") ||
    pathname.startsWith("/admin/super") ||
    pathname === "/admin/new" ||
    (pathname === "/admin" && !organizationKey)
  ) {
    return null;
  }

  const items = buildOrganizationItems(pathname, organizationKey);

  if (!items.length) return null;

  return (
    <section className="border-t border-slate-800 bg-slate-950/50 p-2 sm:px-4 sm:py-3">
      <div className="space-y-3">
        <nav aria-label="Administración del grupo" className="flex gap-1 overflow-x-auto sm:gap-2">
          {items.map((item) => (
            <Link
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 shrink-0 flex-1 items-center justify-center rounded-xl border px-3 py-2 text-xs font-semibold transition md:text-sm",
                item.active
                  ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-200"
                  : "border-transparent text-slate-400 hover:bg-slate-800 hover:text-white"
              )}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
