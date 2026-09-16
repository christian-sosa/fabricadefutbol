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
  pickerOnly = false,
  label = "Grupos"
}: {
  basePath: string;
  organizations: OrganizationOption[];
  quickOrganizations?: OrganizationOption[];
  currentOrganizationSlug?: string | null;
  pickerOnly?: boolean;
  label?: string;
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const selectedOrganization = organizations.find((organization) => organization.slug === currentOrganizationSlug);

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
  const browsableOrganizations = useMemo(() => {
    if (!safeQuickOrganizations.length) return organizations;

    const quickIds = new Set(safeQuickOrganizations.map((organization) => organization.id));
    return organizations.filter((organization) => !quickIds.has(organization.id));
  }, [organizations, safeQuickOrganizations]);
  const visibleOrganizations = useMemo(
    () => filterOrganizations(browsableOrganizations, query),
    [browsableOrganizations, query]
  );

  if (!organizations.length) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
        Todavia no hay grupos creados.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!pickerOnly ? <div className="flex items-center justify-between gap-3">
        <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
          {selectedOrganization ? <p className="truncate font-semibold text-slate-100 md:hidden">{selectedOrganization.name}</p> : null}
        </div>
        {selectedOrganization ? <button aria-expanded={expanded} className="shrink-0 rounded-md border border-slate-700 px-3 py-2 text-sm md:hidden" onClick={() => setExpanded((value) => !value)} type="button">{expanded ? "Cerrar" : "Cambiar grupo"}</button> : null}
      </div> : null}
      <div className={cn("space-y-3", !pickerOnly && selectedOrganization && !expanded ? "hidden md:block" : "block")}>

      {safeQuickOrganizations.length ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">Mis grupos</p>
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
                  aria-current={active ? "page" : undefined}
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
          aria-label="Buscar grupo por nombre"
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/30"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar grupo por nombre..."
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
                aria-current={active ? "page" : undefined}
                key={organization.id}
              >
                {organization.name}
              </Link>
            );
          })}
        </div>

        {query.trim() && !visibleOrganizations.length ? (
          <p className="text-sm text-slate-400">No encontramos grupos con ese termino.</p>
        ) : null}
        {!query.trim() && safeQuickOrganizations.length > 0 && !visibleOrganizations.length ? (
          <p className="text-sm text-slate-400">No hay otros grupos publicos por ahora.</p>
        ) : null}
      </div>
      </div>
    </div>
  );
}
