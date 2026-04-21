import Link from "next/link";

import { TournamentMatchStatusBadge } from "@/components/tournaments/tournament-badges";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";
import type { TournamentFixtureRow } from "@/types/domain";

function formatScheduledAt(value: string | null) {
  return value ? formatDateTime(value) : "Por definir";
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
                <TD>{row.roundName}</TD>
                <TD>{formatScheduledAt(row.scheduledAt)}</TD>
                <TD className="font-semibold text-slate-100">
                  {row.homeTeamName} vs {row.awayTeamName}
                </TD>
                <TD>
                  {row.homeScore !== null && row.awayScore !== null ? `${row.homeScore} - ${row.awayScore}` : "Pendiente"}
                </TD>
                <TD>
                  <TournamentMatchStatusBadge status={row.status} />
                </TD>
                <TD>
                  {href ? (
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
