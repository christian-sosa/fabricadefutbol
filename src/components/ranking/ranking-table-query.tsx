"use client";

import { useMemo, useState } from "react";

import { Card } from "@/components/ui/card";
import { PlayerPhotoModalTrigger } from "@/components/ui/player-photo-modal-trigger";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { useOrganizationStandingsQuery } from "@/lib/query/hooks";
import { cn, formatPercent, formatRendimiento } from "@/lib/utils";
import type { PlayerComputedStats } from "@/types/domain";

const PODIUM_RANK_STYLES: Record<number, string> = {
  1: "border-amber-300/70 bg-amber-400/20 text-amber-200",
  2: "border-slate-300/70 bg-slate-300/20 text-slate-100",
  3: "border-orange-300/70 bg-orange-400/20 text-orange-200"
};

const STAT_CARDS = [
  {
    key: "matchesPlayed",
    label: "PJ",
    value: (player: PlayerComputedStats) => player.matchesPlayed,
    className: "text-slate-100"
  },
  {
    key: "wins",
    label: "PG",
    value: (player: PlayerComputedStats) => player.wins,
    className: "text-slate-100"
  },
  {
    key: "draws",
    label: "PE",
    value: (player: PlayerComputedStats) => player.draws,
    className: "text-slate-100"
  },
  {
    key: "losses",
    label: "PP",
    value: (player: PlayerComputedStats) => player.losses,
    className: "text-slate-100"
  },
  {
    key: "winRate",
    label: "Efectividad",
    value: (player: PlayerComputedStats) => formatPercent(player.winRate),
    className: "text-emerald-300"
  }
] as const;

type SortKey = "rank" | "player" | "rating" | "pj" | "pg" | "pe" | "pp" | "winRate";
type SortDirection = "asc" | "desc";

const SORTABLE_COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: "rank", label: "# Actual" },
  { key: "player", label: "Jugador" },
  { key: "rating", label: "Rendimiento" },
  { key: "pj", label: "PJ" },
  { key: "pg", label: "PG" },
  { key: "pe", label: "PE" },
  { key: "pp", label: "PP" },
  { key: "winRate", label: "Efectividad" }
];

type RankingTableQueryProps = {
  organizationId: string | null;
  initialPlayers?: PlayerComputedStats[];
};

function getInitialSortDirection(sortKey: SortKey): SortDirection {
  return sortKey === "rank" || sortKey === "player" ? "asc" : "desc";
}

function readSortableValue(player: PlayerComputedStats, sortKey: SortKey) {
  switch (sortKey) {
    case "rank":
      return player.currentRank;
    case "player":
      return player.playerName;
    case "rating":
      return player.currentRating;
    case "pj":
      return player.matchesPlayed;
    case "pg":
      return player.wins;
    case "pe":
      return player.draws;
    case "pp":
      return player.losses;
    case "winRate":
      return player.winRate;
  }
}

function compareSortableValues(left: string | number, right: string | number) {
  if (typeof left === "string" || typeof right === "string") {
    return String(left).localeCompare(String(right), "es");
  }

  return left - right;
}

function sortRankingPlayers(players: PlayerComputedStats[], sortKey: SortKey, sortDirection: SortDirection) {
  return [...players].sort((left, right) => {
    const rawDiff = compareSortableValues(readSortableValue(left, sortKey), readSortableValue(right, sortKey));
    if (rawDiff !== 0) return sortDirection === "asc" ? rawDiff : -rawDiff;

    const rankDiff = left.currentRank - right.currentRank;
    if (rankDiff !== 0) return rankDiff;
    return left.playerName.localeCompare(right.playerName, "es");
  });
}

function SortLabel({
  active,
  direction,
  label
}: {
  active: boolean;
  direction: SortDirection;
  label: string;
}) {
  return (
    <>
      <span>{label}</span>
      <span aria-hidden="true" className="inline-flex w-3 justify-center text-[11px] leading-none">
        {active ? (direction === "desc" ? "↓" : "↑") : ""}
      </span>
    </>
  );
}

export function RankingTableQuery({ organizationId, initialPlayers }: RankingTableQueryProps) {
  const { data, isFetching } = useOrganizationStandingsQuery({
    organizationId,
    initialData: initialPlayers
  });

  const players = useMemo(() => data ?? initialPlayers ?? [], [data, initialPlayers]);
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const sortedPlayers = useMemo(
    () => sortRankingPlayers(players, sortKey, sortDirection),
    [players, sortDirection, sortKey]
  );

  const onSort = (nextSortKey: SortKey) => {
    if (nextSortKey === sortKey) {
      setSortDirection((current) => (current === "desc" ? "asc" : "desc"));
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection(getInitialSortDirection(nextSortKey));
  };

  return (
    <Card className="overflow-hidden border-slate-800 bg-slate-900/85 p-0 shadow-[0_18px_45px_-20px_rgba(16,185,129,0.55)]">
      <div className="border-b border-slate-800 px-4 py-2 text-xs text-slate-400">
        {isFetching ? "Actualizando tabla..." : "Tabla al dia"}
      </div>

      <div className="space-y-3 p-3 md:hidden">
        <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
          {SORTABLE_COLUMNS.map((column) => {
            const isActive = sortKey === column.key;
            return (
              <button
                aria-label={`Ordenar por ${column.label}`}
                className={cn(
                  "inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  isActive
                    ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200"
                    : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500 hover:text-slate-100"
                )}
                key={column.key}
                onClick={() => onSort(column.key)}
                type="button"
              >
                <SortLabel active={isActive} direction={sortDirection} label={column.label} />
              </button>
            );
          })}
        </div>

        {sortedPlayers.map((player) => {
          const rank = player.currentRank;
          return (
            <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4" key={player.playerId}>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-3">
                  <span
                    className={cn(
                      "inline-flex min-w-[4.25rem] justify-center rounded-full border px-3 py-1.5 text-sm font-black",
                      PODIUM_RANK_STYLES[rank] ?? "border-slate-700 bg-slate-800 text-slate-200"
                    )}
                  >
                    #{rank}
                  </span>
                  <PlayerPhotoModalTrigger avatarSize="md" playerId={player.playerId} playerName={player.playerName} />
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Rendimiento</p>
                  <p className="text-2xl font-black text-emerald-300">{formatRendimiento(player.currentRating)}</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                {STAT_CARDS.map((item) => (
                  <div
                    className={cn(
                      "rounded-xl border border-slate-800 bg-slate-900 px-3 py-2",
                      item.key === "winRate" ? "col-span-2" : ""
                    )}
                    key={item.key}
                  >
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">{item.label}</p>
                    <p className={cn("mt-1 font-semibold", item.className)}>{item.value(player)}</p>
                  </div>
                ))}
              </div>
            </article>
          );
        })}

        {!sortedPlayers.length ? (
          <p className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-6 text-sm text-slate-400">
            {isFetching ? "Cargando ranking..." : "No hay jugadores para este grupo."}
          </p>
        ) : null}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <Table className="text-base text-slate-100 md:text-lg">
          <THead className="bg-slate-800/90 text-slate-300">
            <tr>
              {SORTABLE_COLUMNS.map((column) => {
                const isActive = sortKey === column.key;
                return (
                  <TH
                    aria-sort={isActive ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                    className="px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-400 md:text-sm"
                    key={column.key}
                  >
                    <button
                      className={cn(
                        "inline-flex min-h-8 items-center gap-1 text-left uppercase tracking-[0.18em] transition hover:text-emerald-300",
                        isActive ? "text-emerald-300" : "text-slate-400"
                      )}
                      onClick={() => onSort(column.key)}
                      type="button"
                    >
                      <SortLabel active={isActive} direction={sortDirection} label={column.label} />
                    </button>
                  </TH>
                );
              })}
            </tr>
          </THead>
          <TBody className="divide-slate-800">
            {sortedPlayers.map((player) => {
              const rank = player.currentRank;
              return (
                <tr className="transition-colors hover:bg-slate-800/75" key={player.playerId}>
                  <TD className="px-6 py-5">
                    <span
                      className={cn(
                        "inline-flex min-w-[4.5rem] justify-center rounded-full border px-4 py-2 text-base font-black md:text-lg",
                        PODIUM_RANK_STYLES[rank] ?? "border-slate-700 bg-slate-800 text-slate-200"
                      )}
                    >
                      #{rank}
                    </span>
                  </TD>
                  <TD className="px-6 py-5">
                    <PlayerPhotoModalTrigger avatarSize="md" playerId={player.playerId} playerName={player.playerName} />
                  </TD>
                  <TD className="px-6 py-5 text-lg font-semibold text-emerald-300 md:text-xl">
                    {formatRendimiento(player.currentRating)}
                  </TD>
                  <TD className="px-6 py-5 text-lg font-medium text-slate-300 md:text-xl">{player.matchesPlayed}</TD>
                  <TD className="px-6 py-5 text-lg font-medium text-slate-300 md:text-xl">{player.wins}</TD>
                  <TD className="px-6 py-5 text-lg font-medium text-slate-300 md:text-xl">{player.draws}</TD>
                  <TD className="px-6 py-5 text-lg font-medium text-slate-300 md:text-xl">{player.losses}</TD>
                  <TD className="px-6 py-5 text-lg font-semibold text-emerald-300 md:text-xl">
                    {formatPercent(player.winRate)}
                  </TD>
                </tr>
              );
            })}

            {!sortedPlayers.length ? (
              <tr>
                <TD className="px-6 py-6 text-sm text-slate-400" colSpan={8}>
                  {isFetching ? "Cargando ranking..." : "No hay jugadores para este grupo."}
                </TD>
              </tr>
            ) : null}
          </TBody>
        </Table>
      </div>
    </Card>
  );
}
