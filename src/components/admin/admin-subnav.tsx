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

function getTournamentIdFromPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "admin" || segments[1] !== "tournaments") return null;
  const candidate = segments[2];
  if (!candidate || candidate === "billing" || candidate === "new") return null;
  return candidate;
}

function buildTournamentTabHref(tournamentId: string, tab: string) {
  return `/admin/tournaments/${tournamentId}?tab=${encodeURIComponent(tab)}`;
}

function buildCompetitionTabHref(tournamentId: string, competitionId: string, tab: string) {
  return `/admin/tournaments/${tournamentId}/competitions/${competitionId}?tab=${encodeURIComponent(tab)}`;
}

function buildOrganizationItems(pathname: string, organizationKey: string | null): AdminSubnavItem[] {
  const isMatchDetail =
    pathname.startsWith("/admin/matches/") && !pathname.startsWith("/admin/matches/new");

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
      href: withOrgQuery("/admin/matches/new", organizationKey),
      label: "Nuevo partido",
      active: pathname === "/admin/matches/new"
    },
    {
      href: withOrgQuery("/admin/matches", organizationKey),
      label: "Partidos",
      active: pathname === "/admin/matches" || isMatchDetail
    },
    {
      href: withOrgQuery("/admin/billing", organizationKey),
      label: "Facturacion",
      active: pathname === "/admin/billing"
    }
  ];
}

function buildTournamentItems(pathname: string, tournamentId: string | null, currentTab: string | null): AdminSubnavItem[] {
  if (!tournamentId) {
    return [
      {
        href: "/admin/tournaments",
        label: "Panel",
        active: pathname === "/admin/tournaments"
      },
      {
        href: "/admin/tournaments/billing",
        label: "Facturacion",
        active: pathname === "/admin/tournaments/billing"
      }
    ];
  }

  const segments = pathname.split("/").filter(Boolean);
  const isNewCompetitionPath = segments[3] === "competitions" && segments[4] === "new";
  const competitionId = segments[3] === "competitions" && !isNewCompetitionPath ? segments[4] ?? null : null;

  const activeTab = isNewCompetitionPath
    ? "competitions"
    : pathname.includes("/matches/")
      ? "results"
      : currentTab ?? "summary";
  const tabItems = competitionId
    ? [
        { key: "summary", label: "Resumen" },
        { key: "teams", label: "Inscriptos" },
        { key: "rosters", label: "Planteles" },
        { key: "fixture", label: "Fixture" },
        { key: "results", label: "Resultados" },
        { key: "stats", label: "Estadisticas" }
      ]
    : [
        { key: "summary", label: "Resumen" },
        { key: "teams", label: "Equipos" },
        { key: "competitions", label: "Competencias" },
        { key: "admins", label: "Admins" }
      ];

  return tabItems.map((item) => ({
    href: competitionId
      ? buildCompetitionTabHref(tournamentId, competitionId, item.key)
      : buildTournamentTabHref(tournamentId, item.key),
    label: item.label,
    active: activeTab === item.key
  }));
}

export function AdminSubnav() {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const organizationKey = searchParams.get("org");
  const currentTab = searchParams.get("tab");
  const tournamentId = getTournamentIdFromPath(pathname);

  if (
    !pathname.startsWith("/admin") ||
    pathname.startsWith("/admin/super") ||
    pathname === "/admin/new" ||
    pathname === "/admin/tournaments/new" ||
    (pathname === "/admin" && !organizationKey)
  ) {
    return null;
  }

  const isTournamentArea = pathname.startsWith("/admin/tournaments");
  const showHeader = isTournamentArea;
  const items = isTournamentArea
    ? buildTournamentItems(pathname, tournamentId, currentTab)
    : buildOrganizationItems(pathname, organizationKey);

  if (!items.length) return null;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/75 px-4 py-3">
      <div className="space-y-3">
        {showHeader ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-400">
              {tournamentId ? "Liga actual" : "Torneos"}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {tournamentId
                ? "Estas trabajando dentro de una liga. Las competencias, equipos y resultados quedan separados de Grupos."
                : "Elige una liga para administrar sus equipos, competencias, resultados y facturacion."}
            </p>
          </div>
        ) : null}

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
