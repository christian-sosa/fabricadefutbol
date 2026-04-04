"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { withOrgQuery } from "@/lib/org";
import { cn } from "@/lib/utils";

type OrganizationOption = {
  id: string;
  name: string;
  slug: string;
};

function filterOrganizations(organizations: OrganizationOption[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return organizations;

  return organizations.filter(
    (organization) =>
      organization.name.toLowerCase().includes(normalizedQuery) || organization.slug.toLowerCase().includes(normalizedQuery)
  );
}

export function OrganizationSwitcher({
  basePath,
  organizations,
  quickOrganizations = [],
  currentOrganizationSlug,
  label = "Organizaciones"
}: {
  basePath: string;
  organizations: OrganizationOption[];
  quickOrganizations?: OrganizationOption[];
  currentOrganizationSlug?: string | null;
  label?: string;
}) {
  const [query, setQuery] = useState("");

  const visibleOrganizations = useMemo(() => filterOrganizations(organizations, query), [organizations, query]);
  const safeQuickOrganizations = useMemo(() => {
    if (!quickOrganizations.length) return [];

    const availableIds = new Set(organizations.map((organization) => organization.id));
    const seen = new Set<string>();

    return quickOrganizations.filter((organization) => {
      if (!availableIds.has(organization.id) || seen.has(organization.id)) return false;
      seen.add(organization.id);
      return true;
    });
  }, [organizations, quickOrganizations]);

  if (!organizations.length) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
        Todavia no hay organizaciones creadas.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>

      {safeQuickOrganizations.length ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">Mis organizaciones</p>
          <div className="flex flex-wrap gap-2">
            {safeQuickOrganizations.map((organization) => {
              const active = organization.slug === currentOrganizationSlug;
              return (
                <Link
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition md:text-sm",
                    active
                      ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200"
                      : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:bg-slate-800"
                  )}
                  href={withOrgQuery(basePath, organization.slug)}
                  key={organization.id}
                >
                  {organization.name}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <input
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/30"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar organizacion por nombre o slug..."
          type="search"
          value={query}
        />

        <div className="flex flex-wrap gap-2">
          {visibleOrganizations.map((organization) => {
            const active = organization.slug === currentOrganizationSlug;
            return (
              <Link
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition md:text-sm",
                  active
                    ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200"
                    : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:bg-slate-800"
                )}
                href={withOrgQuery(basePath, organization.slug)}
                key={organization.id}
              >
                {organization.name}
              </Link>
            );
          })}
        </div>

        {query.trim() && !visibleOrganizations.length ? (
          <p className="text-sm text-slate-400">No encontramos organizaciones con ese termino.</p>
        ) : null}
      </div>
    </div>
  );
}
