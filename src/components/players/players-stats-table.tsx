"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/utils";
import { PlayerPhotoModalTrigger } from "@/components/ui/player-photo-modal-trigger";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";

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
  { key: "rating", label: "Rating" },
  { key: "pj", label: "PJ" },
  { key: "pg", label: "PG" },
  { key: "pe", label: "PE" },
  { key: "pp", label: "PP" },
  { key: "winRate", label: "Win Rate" }
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
    <div className="overflow-x-auto">
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
                    <span className="text-[10px] uppercase">{isActive ? (sortDirection === "desc" ? "desc" : "asc") : ""}</span>
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
              <TD className="font-semibold text-slate-100">{player.currentRating.toFixed(2)}</TD>
              <TD>{player.matchesPlayed}</TD>
              <TD>{player.wins}</TD>
              <TD>{player.draws}</TD>
              <TD>{player.losses}</TD>
              <TD className="font-semibold text-emerald-300">{formatPercent(player.winRate)}</TD>
            </tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
