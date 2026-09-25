"use client";

import Link from "next/link";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { withOrgQuery } from "@/lib/org";

type DirectoryOrganization = {
  id: string;
  name: string;
  slug: string;
  is_public: boolean;
};

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
}

export function AdminGroupDirectory({ organizations }: { organizations: DirectoryOrganization[] }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeSearch(query);
  const visibleOrganizations = organizations.filter((organization) =>
    normalizeSearch(`${organization.name} ${organization.slug}`).includes(normalizedQuery)
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Input
            aria-label="Buscar entre tus grupos"
            className="min-h-12 rounded-xl bg-slate-950/70 pr-20"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre o identificador…"
            type="search"
            value={query}
          />
          {query ? (
            <button
              className="absolute inset-y-1 right-2 rounded-lg px-2 text-xs font-semibold text-emerald-300 hover:bg-slate-800"
              onClick={() => setQuery("")}
              type="button"
            >
              Limpiar
            </button>
          ) : null}
        </div>
        <p className="shrink-0 text-sm text-slate-400" role="status">
          {normalizedQuery
            ? `${visibleOrganizations.length} de ${organizations.length} grupos`
            : `${organizations.length} ${organizations.length === 1 ? "grupo disponible" : "grupos disponibles"}`}
        </p>
      </div>

      {visibleOrganizations.length ? (
        <ul aria-label="Tus grupos" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleOrganizations.map((organization) => (
            <li className="min-w-0" key={organization.id}>
              <Link
                aria-label={`Administrar ${organization.name}`}
                className="group flex h-full min-h-48 flex-col rounded-2xl border border-slate-700/80 bg-slate-950/50 p-5 transition hover:border-emerald-400/60 hover:bg-emerald-500/5"
                href={withOrgQuery("/admin", organization.slug)}
              >
                <div className="flex items-center justify-between gap-3">
                  <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-lg font-black text-emerald-200">
                    {organization.name.trim().slice(0, 1).toLocaleUpperCase("es") || "G"}
                  </span>
                  <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">
                    {organization.is_public ? "Público" : "Privado"}
                  </span>
                </div>
                <h3 className="mt-4 break-words text-lg font-bold leading-snug text-white">{organization.name}</h3>
                <p className="mt-1 break-all text-xs text-slate-400">{organization.slug}</p>
                <span className="mt-auto flex items-center justify-between gap-3 pt-5 text-sm font-semibold text-emerald-300">
                  Administrar grupo <span aria-hidden="true">↗</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center">
          <p className="font-semibold text-slate-200">No encontramos ese grupo</p>
          <p className="mt-2 text-sm text-slate-400">Probá con otra parte del nombre o limpiá la búsqueda.</p>
        </div>
      )}
    </div>
  );
}
