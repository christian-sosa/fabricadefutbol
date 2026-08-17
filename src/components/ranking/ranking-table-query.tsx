"use client";

import { useMemo, useState } from "react";

import { Card } from "@/components/ui/card";
import { PlayerPhotoModalTrigger } from "@/components/ui/player-photo-modal-trigger";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { useOrganizationStandingsQuery } from "@/lib/query/hooks";
import { cn, formatRendimiento } from "@/lib/utils";
import type { PlayerComputedStats, PlayerRecentResult } from "@/types/domain";

const PODIUM_RANK_STYLES: Record<number, string> = {
  1: "border-amber-300/70 bg-amber-400/20 text-amber-200",
  2: "border-slate-300/70 bg-slate-300/20 text-slate-100",
  3: "border-orange-300/70 bg-orange-400/20 text-orange-200"
};

const RECENT_RESULT_STYLES: Record<PlayerRecentResult, { label: string; className: string }> = {
  V: {
    label: "Victoria",
    className: "border-emerald-300/80 bg-emerald-400 text-emerald-950"
  },
  E: {
    label: "Empate",
    className: "border-amber-200/80 bg-amber-300 text-amber-950"
  },
  D: {
    label: "Derrota",
    className: "border-rose-300/80 bg-rose-500 text-white"
  }
};

const RECENT_RESULTS_LIMIT = 5;

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
    key: "mvpCount",
    label: "MVP",
    value: (player: PlayerComputedStats) => player.mvpCount ?? 0,
    className: "text-amber-200"
  }
] as const;

type SortKey = "rank" | "player" | "rating" | "pj" | "pg" | "pe" | "pp" | "mvp";
type SortDirection = "asc" | "desc";

const SORTABLE_COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: "rank", label: "# Actual" },
  { key: "player", label: "Jugador" },
  { key: "rating", label: "Rendimiento" },
  { key: "pj", label: "PJ" },
  { key: "pg", label: "PG" },
  { key: "pe", label: "PE" },
  { key: "pp", label: "PP" },
  { key: "mvp", label: "MVP" }
];

type RankingTableQueryProps = {
  organizationId: string | null;
  season?: string;
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
    case "mvp":
      return player.mvpCount ?? 0;
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

function RecentResults({ results, className }: { results?: PlayerRecentResult[]; className?: string }) {
  const recentResults = results?.slice(-RECENT_RESULTS_LIMIT) ?? [];
  const emptySlots = RECENT_RESULTS_LIMIT - recentResults.length;
  const readableResults = recentResults.length
    ? recentResults.map((result) => RECENT_RESULT_STYLES[result].label.toLowerCase()).join(", ")
    : "sin partidos jugados";

  return (
    <div
      aria-label={`Últimos ${RECENT_RESULTS_LIMIT} partidos: ${readableResults}. El más reciente está a la derecha.`}
      className={cn("flex items-center justify-end gap-1 sm:gap-1.5", className)}
      role="img"
    >
      {Array.from({ length: emptySlots }, (_, index) => (
        <span
          aria-hidden="true"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800/65 text-xs font-black text-slate-600"
          key={`empty-${index}`}
        >
          –
        </span>
      ))}
      {recentResults.map((result, index) => {
        const resultStyle = RECENT_RESULT_STYLES[result];
        return (
          <span
            aria-hidden="true"
            className={cn(
              "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs font-black shadow-sm",
              resultStyle.className
            )}
            key={`${result}-${index}`}
            title={resultStyle.label}
          >
            {result}
          </span>
        );
      })}
    </div>
  );
}

export function RankingTableQuery({ organizationId, initialPlayers, season = "current" }: RankingTableQueryProps) {
  const { data, isFetching } = useOrganizationStandingsQuery({
    organizationId,
    season,
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
      {isFetching ? (
        <p aria-live="polite" className="sr-only">
          Actualizando tabla...
        </p>
      ) : null}

      <div className="space-y-3 p-3 lg:hidden">
        <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
          {SORTABLE_COLUMNS.map((column) => {
            const isActive = sortKey === column.key;
            return (
              <button
                aria-label={`Ordenar por ${column.label}`}
                className={cn(
                  "inline-flex min-h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition",
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

        <div className="grid gap-3 sm:grid-cols-2">
          {sortedPlayers.map((player) => {
            const rank = player.currentRank;
            return (
              <article className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/70 p-3.5" key={player.playerId}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-3">
                    <span
                      className={cn(
                        "inline-flex min-w-[4.25rem] justify-center rounded-full border px-3 py-1.5 text-sm font-black",
                        PODIUM_RANK_STYLES[rank] ?? "border-slate-700 bg-slate-800 text-slate-200"
                      )}
                    >
                      #{rank}
                    </span>
                    <PlayerPhotoModalTrigger
                      avatarSize="md"
                      nameClassName="min-w-0 break-words leading-tight"
                      playerId={player.playerId}
                      playerName={player.playerName}
                      triggerClassName="min-w-0 max-w-full"
                    />
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Rendimiento</p>
                    <p className="text-2xl font-black text-emerald-300">{formatRendimiento(player.currentRating)}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-300">Últimos 5</p>
                    <p className="text-[10px] text-slate-500">Reciente a la derecha</p>
                  </div>
                  <RecentResults className="mt-2 justify-end" results={player.recentResults} />
                </div>

                <div className="mt-3 grid grid-cols-5 gap-1.5 text-center text-sm">
                  {STAT_CARDS.map((item) => (
                    <div
                      className="min-w-0 rounded-lg border border-slate-800 bg-slate-900 px-1.5 py-2"
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
            <p className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-6 text-sm text-slate-400 sm:col-span-2">
              {isFetching ? "Cargando ranking..." : "No hay jugadores para este grupo."}
            </p>
          ) : null}
        </div>
      </div>

      <div className="hidden lg:block">
        <Table className="table-fixed text-sm text-slate-100">
          <colgroup>
            <col className="w-[7%]" />
            <col className="w-[25%]" />
            <col className="w-[13%]" />
            <col className="w-[6%]" />
            <col className="w-[6%]" />
            <col className="w-[6%]" />
            <col className="w-[6%]" />
            <col className="w-[7%]" />
            <col className="w-[24%]" />
          </colgroup>
          <THead className="bg-slate-800/90 text-slate-300">
            <tr>
              {SORTABLE_COLUMNS.map((column) => {
                const isActive = sortKey === column.key;
                return (
                  <TH
                    aria-sort={isActive ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                    className="px-2.5 py-3 text-[11px] font-bold uppercase text-slate-400 lg:px-3"
                    key={column.key}
                  >
                    <button
                      className={cn(
                        "inline-flex min-h-8 items-center gap-1 whitespace-nowrap text-left uppercase transition hover:text-emerald-300",
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
              <TH className="px-2.5 py-3 text-center text-[11px] font-bold uppercase text-slate-400 lg:px-3">
                Últimos 5
              </TH>
            </tr>
          </THead>
          <TBody className="divide-slate-800">
            {sortedPlayers.map((player) => {
              const rank = player.currentRank;
              return (
                <tr className="transition-colors hover:bg-slate-800/75" key={player.playerId}>
                  <TD className="px-2.5 py-4 lg:px-3">
                    <span
                      className={cn(
                        "inline-flex min-w-12 justify-center rounded-full border px-2.5 py-1.5 text-sm font-black",
                        PODIUM_RANK_STYLES[rank] ?? "border-slate-700 bg-slate-800 text-slate-200"
                      )}
                    >
                      #{rank}
                    </span>
                  </TD>
                  <TD className="px-2.5 py-4 lg:px-3">
                    <PlayerPhotoModalTrigger avatarSize="md" playerId={player.playerId} playerName={player.playerName} />
                  </TD>
                  <TD className="px-2.5 py-4 text-base font-semibold text-emerald-300 lg:px-3">
                    {formatRendimiento(player.currentRating)}
                  </TD>
                  <TD className="px-2.5 py-4 text-base font-medium text-slate-300 lg:px-3">{player.matchesPlayed}</TD>
                  <TD className="px-2.5 py-4 text-base font-medium text-slate-300 lg:px-3">{player.wins}</TD>
                  <TD className="px-2.5 py-4 text-base font-medium text-slate-300 lg:px-3">{player.draws}</TD>
                  <TD className="px-2.5 py-4 text-base font-medium text-slate-300 lg:px-3">{player.losses}</TD>
                  <TD className="px-2.5 py-4 text-base font-semibold text-amber-200 lg:px-3">{player.mvpCount ?? 0}</TD>
                  <TD className="px-2.5 py-4 lg:px-3">
                    <RecentResults className="justify-center" results={player.recentResults} />
                  </TD>
                </tr>
              );
            })}

            {!sortedPlayers.length ? (
              <tr>
                <TD className="px-3 py-6 text-sm text-slate-400" colSpan={9}>
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
