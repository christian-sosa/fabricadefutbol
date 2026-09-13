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
    <section className="rounded-2xl border border-slate-800 bg-slate-950/75 px-4 py-3">
      <div className="space-y-3">
        <nav className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
          {items.map((item) => (
            <Link
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition md:text-sm",
                item.active
                  ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200"
                  : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:bg-slate-800"
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
