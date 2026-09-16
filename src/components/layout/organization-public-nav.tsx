import Link from "next/link";

import { ORGANIZATION_PUBLIC_NAV_ITEMS } from "@/lib/constants";
import type { PublicModuleContext } from "@/lib/org";
import { withPublicQuery } from "@/lib/org";
import { cn } from "@/lib/utils";

type OrganizationPublicNavProps = {
  className?: string;
  currentPath?: string;
  itemClassName?: string;
  module?: PublicModuleContext | null;
  organizationKey?: string | null;
  season?: string | null;
};

function isActivePath(currentPath: string | undefined, href: string) {
  if (!currentPath) return false;
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function OrganizationPublicNav({
  className,
  currentPath,
  itemClassName,
  module,
  organizationKey,
  season
}: OrganizationPublicNavProps) {
  return (
    <nav aria-label="Contenido del grupo" className={cn("grid grid-cols-4 gap-1 rounded-xl border border-border bg-card p-1", className)}>
      {ORGANIZATION_PUBLIC_NAV_ITEMS.map((item) => {
        const active = isActivePath(currentPath, item.href);

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 min-w-0 items-center justify-center whitespace-nowrap rounded-lg px-1 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm",
              active
                ? "bg-accent text-accent-foreground"
                : "text-slate-300 hover:bg-slate-800 hover:text-foreground",
              itemClassName
            )}
            href={withPublicQuery(season && season !== "current" ? `${item.href}?season=${encodeURIComponent(season)}` : item.href, {
              organizationKey,
              module
            })}
            key={item.href}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
