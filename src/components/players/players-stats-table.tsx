"use client";

import { useMemo, useState } from "react";

import { PlayerPhotoModalTrigger } from "@/components/ui/player-photo-modal-trigger";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { cn, formatPercent, formatRendimiento } from "@/lib/utils";

type PlayerStatsRow = {
  playerId: string;
  playerName: string;
  currentRating: number;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
};

type SortKey = "rating" | "pj" | "pg" | "pe" | "pp" | "winRate";
type SortDirection = "asc" | "desc";

const columnConfig: Array<{ key: SortKey; label: string }> = [
  { key: "rating", label: "Rendimiento" },
  { key: "pj", label: "PJ" },
  { key: "pg", label: "PG" },
  { key: "pe", label: "PE" },
  { key: "pp", label: "PP" },
  { key: "winRate", label: "Efectividad" }
];

function readSortableValue(player: PlayerStatsRow, key: SortKey) {
  switch (key) {
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

export function PlayersStatsTable({ players }: { players: PlayerStatsRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("rating");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      const aValue = readSortableValue(a, sortKey);
      const bValue = readSortableValue(b, sortKey);
      const rawDiff = aValue - bValue;
      if (rawDiff !== 0) return sortDirection === "asc" ? rawDiff : -rawDiff;

      const ratingDiff = b.currentRating - a.currentRating;
      if (ratingDiff !== 0) return ratingDiff;
      const matchesDiff = b.matchesPlayed - a.matchesPlayed;
      if (matchesDiff !== 0) return matchesDiff;
      return a.playerName.localeCompare(b.playerName);
    });
  }, [players, sortDirection, sortKey]);

  const onSort = (nextSortKey: SortKey) => {
    if (nextSortKey === sortKey) {
      setSortDirection((current) => (current === "desc" ? "asc" : "desc"));
      return;
    }
    setSortKey(nextSortKey);
    setSortDirection("desc");
  };

  return (
    <div className="space-y-3">
      <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1 md:hidden">
        {columnConfig.map((column) => {
          const isActive = sortKey === column.key;
          return (
            <button
              className={cn(
                "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                isActive
                  ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200"
                  : "border-slate-700 bg-slate-950 text-slate-300"
              )}
              key={column.key}
              onClick={() => onSort(column.key)}
              type="button"
            >
              {column.label}
              {isActive ? ` ${sortDirection === "desc" ? "desc" : "asc"}` : ""}
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 md:hidden">
        {sortedPlayers.map((player) => (
          <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4" key={player.playerId}>
            <div className="flex items-start justify-between gap-3">
              <PlayerPhotoModalTrigger playerId={player.playerId} playerName={player.playerName} />
              <div className="text-right">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Rendimiento</p>
                <p className="text-xl font-black text-emerald-300">{formatRendimiento(player.currentRating)}</p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">PJ</p>
                <p className="mt-1 font-semibold text-slate-100">{player.matchesPlayed}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Efectividad</p>
                <p className="mt-1 font-semibold text-emerald-300">{formatPercent(player.winRate)}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">PG</p>
                <p className="mt-1 font-semibold text-slate-100">{player.wins}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">PE / PP</p>
                <p className="mt-1 font-semibold text-slate-100">
                  {player.draws} / {player.losses}
                </p>
              </div>
            </div>
          </article>
        ))}

        {!sortedPlayers.length ? (
          <p className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-6 text-sm text-slate-400">
            No hay jugadores para este grupo.
          </p>
        ) : null}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <Table>
          <THead>
            <tr>
              <TH>Jugador</TH>
              {columnConfig.map((column) => {
                const isActive = sortKey === column.key;
                return (
                  <TH key={column.key}>
                    <button
                      className={cn(
                        "inline-flex items-center gap-1 text-left transition hover:text-emerald-300",
                        isActive ? "text-emerald-300" : "text-slate-200"
                      )}
                      onClick={() => onSort(column.key)}
                      type="button"
                    >
                      {column.label}
                      <span className="text-[10px] uppercase">
                        {isActive ? (sortDirection === "desc" ? "desc" : "asc") : ""}
                      </span>
                    </button>
                  </TH>
                );
              })}
            </tr>
          </THead>
          <TBody>
            {sortedPlayers.map((player) => (
              <tr className="transition-colors hover:bg-slate-800/70" key={player.playerId}>
                <TD>
                  <PlayerPhotoModalTrigger playerId={player.playerId} playerName={player.playerName} />
                </TD>
                <TD className="font-semibold text-slate-100">{formatRendimiento(player.currentRating)}</TD>
                <TD>{player.matchesPlayed}</TD>
                <TD>{player.wins}</TD>
                <TD>{player.draws}</TD>
                <TD>{player.losses}</TD>
                <TD className="font-semibold text-emerald-300">{formatPercent(player.winRate)}</TD>
              </tr>
            ))}
            {!sortedPlayers.length ? (
              <tr>
                <TD className="py-6 text-sm text-slate-400" colSpan={7}>
                  No hay jugadores para este grupo.
                </TD>
              </tr>
            ) : null}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
