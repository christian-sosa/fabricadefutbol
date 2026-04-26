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
  organizationKey
}: OrganizationPublicNavProps) {
  return (
    <nav aria-label="Contenido del grupo" className={cn("flex flex-wrap items-center gap-2", className)}>
      {ORGANIZATION_PUBLIC_NAV_ITEMS.map((item) => {
        const active = isActivePath(currentPath, item.href);

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              active
                ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200"
                : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:bg-slate-800",
              itemClassName
            )}
            href={withPublicQuery(item.href, {
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
