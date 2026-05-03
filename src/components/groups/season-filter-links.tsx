import Link from "next/link";

import type { OrganizationSeasonOption } from "@/lib/query/types";
import { cn } from "@/lib/utils";

type SeasonFilterLinksProps = {
  basePath: string;
  currentSeason: string;
  organizationSlug?: string | null;
  seasons: OrganizationSeasonOption[];
};

function buildSeasonHref(basePath: string, organizationSlug: string | null | undefined, season: string) {
  const params = new URLSearchParams();
  if (organizationSlug) params.set("org", organizationSlug);
  if (season !== "current") params.set("season", season);
  const queryString = params.toString().replace(/\+/g, "%20");
  return queryString ? `${basePath}?${queryString}` : basePath;
}

export function SeasonFilterLinks({
  basePath,
  currentSeason,
  organizationSlug,
  seasons
}: SeasonFilterLinksProps) {
  const activeSeason = seasons.find((season) => season.status === "active") ?? null;
  const closedSeasons = seasons.filter((season) => season.status !== "active");
  const items = [
    {
      key: "current",
      label: activeSeason?.label ?? "Temporada actual"
    },
    ...closedSeasons.map((season) => ({
      key: season.id,
      label: season.label
    })),
    {
      key: "all",
      label: "Historico"
    }
  ];

  return (
    <nav aria-label="Filtrar temporada" className="flex gap-2 overflow-x-auto pb-1">
      {items.map((item) => {
        const active = currentSeason === item.key || (currentSeason === "current" && item.key === activeSeason?.id);
        return (
          <Link
            className={cn(
              "inline-flex min-h-9 shrink-0 items-center rounded-md border px-3 py-1.5 text-sm font-semibold transition",
              active
                ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200"
                : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500 hover:text-slate-100"
            )}
            href={buildSeasonHref(basePath, organizationSlug, item.key)}
            key={item.key}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
