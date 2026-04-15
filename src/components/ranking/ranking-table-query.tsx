"use client";

import { useMemo } from "react";

import { Card } from "@/components/ui/card";
import { PlayerPhotoModalTrigger } from "@/components/ui/player-photo-modal-trigger";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { useOrganizationStandingsQuery } from "@/lib/query/hooks";
import { cn } from "@/lib/utils";
import type { PlayerComputedStats } from "@/types/domain";

const PODIUM_RANK_STYLES: Record<number, string> = {
  1: "border-amber-300/70 bg-amber-400/20 text-amber-200",
  2: "border-slate-300/70 bg-slate-300/20 text-slate-100",
  3: "border-orange-300/70 bg-orange-400/20 text-orange-200"
};

type RankingTableQueryProps = {
  organizationId: string | null;
  initialPlayers?: PlayerComputedStats[];
};

export function RankingTableQuery({ organizationId, initialPlayers }: RankingTableQueryProps) {
  const { data, isFetching } = useOrganizationStandingsQuery({
    organizationId,
    initialData: initialPlayers
  });

  const players = useMemo(() => data ?? initialPlayers ?? [], [data, initialPlayers]);

  return (
    <Card className="overflow-hidden border-slate-800 bg-slate-900/85 p-0 shadow-[0_18px_45px_-20px_rgba(16,185,129,0.55)]">
      <div className="border-b border-slate-800 px-4 py-2 text-xs text-slate-400">
        {isFetching ? "Actualizando tabla..." : "Tabla al dia"}
      </div>

      <div className="space-y-3 p-3 md:hidden">
        {players.map((player, index) => {
          const rank = index + 1;
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
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Rating</p>
                  <p className="text-2xl font-black text-emerald-300">{player.currentRating.toFixed(2)}</p>
                  <p className="mt-2 text-sm text-slate-400">PJ: {player.matchesPlayed}</p>
                </div>
              </div>
            </article>
          );
        })}

        {!players.length ? (
          <p className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-6 text-sm text-slate-400">
            {isFetching ? "Cargando ranking..." : "No hay jugadores para esta organizacion."}
          </p>
        ) : null}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <Table className="text-base text-slate-100 md:text-lg">
          <THead className="bg-slate-800/90 text-slate-300">
            <tr>
              <TH className="px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-400 md:text-sm"># Actual</TH>
              <TH className="px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-400 md:text-sm">Jugador</TH>
              <TH className="px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-400 md:text-sm">Rating</TH>
              <TH className="px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-400 md:text-sm">PJ</TH>
            </tr>
          </THead>
          <TBody className="divide-slate-800">
            {players.map((player, index) => {
              const rank = index + 1;
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
                    {player.currentRating.toFixed(2)}
                  </TD>
                  <TD className="px-6 py-5 text-lg font-medium text-slate-300 md:text-xl">{player.matchesPlayed}</TD>
                </tr>
              );
            })}

            {!players.length ? (
              <tr>
                <TD className="px-6 py-6 text-sm text-slate-400" colSpan={4}>
                  {isFetching ? "Cargando ranking..." : "No hay jugadores para esta organizacion."}
                </TD>
              </tr>
            ) : null}
          </TBody>
        </Table>
      </div>
    </Card>
  );
}
