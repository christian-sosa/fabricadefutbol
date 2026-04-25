import Link from "next/link";

import { TournamentMatchStatusBadge } from "@/components/tournaments/tournament-badges";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";
import type { TournamentFixtureRow } from "@/types/domain";

function formatScheduledAt(value: string | null) {
  return value ? formatDateTime(value) : "Por definir";
}

function formatFixtureScore(row: TournamentFixtureRow) {
  if (row.kind === "bye") {
    return row.byeKind === "advance" ? "Pasa de ronda" : "Fecha libre";
  }

  if (row.homeScore === null || row.awayScore === null) {
    return "Pendiente";
  }

  if (row.penaltyHomeScore !== null && row.penaltyAwayScore !== null) {
    return `${row.homeScore} - ${row.awayScore} (pen ${row.penaltyHomeScore}-${row.penaltyAwayScore})`;
  }

  return `${row.homeScore} - ${row.awayScore}`;
}

export function TournamentFixtureTable({
  rows,
  buildMatchHref,
  linkLabel = "Ver"
}: {
  rows: TournamentFixtureRow[];
  buildMatchHref?: ((row: TournamentFixtureRow) => string | null) | null;
  linkLabel?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <THead>
          <tr>
            <TH>Fecha</TH>
            <TH>Horario</TH>
            <TH>Partido</TH>
            <TH>Resultado</TH>
            <TH>Estado</TH>
            <TH></TH>
          </tr>
        </THead>
        <TBody>
          {rows.map((row) => {
            const href = buildMatchHref ? buildMatchHref(row) : null;
            return (
              <tr className="transition-colors hover:bg-slate-800/70" key={row.id}>
                <TD>
                  <div className="space-y-1">
                    <p>{row.roundName}</p>
                    <p className="text-xs text-slate-500">{row.phase === "cup" ? row.stageLabel : "Fase liga"}</p>
                  </div>
                </TD>
                <TD>{row.kind === "bye" ? "-" : formatScheduledAt(row.scheduledAt)}</TD>
                <TD className="font-semibold text-slate-100">
                  {row.kind === "bye"
                    ? `${row.byeTeamName ?? "Equipo"} - ${row.byeKind === "advance" ? "Pasa de ronda" : "Fecha libre"}`
                    : `${row.homeTeamName} vs ${row.awayTeamName}`}
                </TD>
                <TD>{formatFixtureScore(row)}</TD>
                <TD>
                  {row.status === "bye" ? (
                    <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-200">
                      Bye
                    </span>
                  ) : (
                    <TournamentMatchStatusBadge status={row.status} />
                  )}
                </TD>
                <TD>
                  {href && row.kind === "match" ? (
                    <Link className="font-semibold text-emerald-300 hover:underline" href={href}>
                      {linkLabel}
                    </Link>
                  ) : (
                    <span className="text-sm text-slate-500">-</span>
                  )}
                </TD>
              </tr>
            );
          })}
          {!rows.length ? (
            <tr>
              <TD className="py-6 text-sm text-slate-400" colSpan={6}>
                Todavia no hay partidos cargados.
              </TD>
            </tr>
          ) : null}
        </TBody>
      </Table>
    </div>
  );
}
