import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import type { TournamentStandingRow } from "@/types/domain";

export function TournamentStandingsTable({ rows }: { rows: TournamentStandingRow[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <THead>
          <tr>
            <TH>#</TH>
            <TH>Equipo</TH>
            <TH>PTS</TH>
            <TH>PJ</TH>
            <TH>PG</TH>
            <TH>PE</TH>
            <TH>PP</TH>
            <TH>GF</TH>
            <TH>GC</TH>
            <TH>DG</TH>
          </tr>
        </THead>
        <TBody>
          {rows.map((row, index) => (
            <tr className="transition-colors hover:bg-slate-800/70" key={row.teamId}>
              <TD>{index + 1}</TD>
              <TD className="font-semibold text-slate-100">
                {row.teamName}
                {row.shortName ? <span className="ml-2 text-xs text-slate-400">({row.shortName})</span> : null}
              </TD>
              <TD className="font-semibold text-emerald-300">{row.points}</TD>
              <TD>{row.played}</TD>
              <TD>{row.wins}</TD>
              <TD>{row.draws}</TD>
              <TD>{row.losses}</TD>
              <TD>{row.goalsFor}</TD>
              <TD>{row.goalsAgainst}</TD>
              <TD>{row.goalDifference}</TD>
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <TD className="py-6 text-sm text-slate-400" colSpan={10}>
                Todavia no hay datos suficientes para armar la tabla.
              </TD>
            </tr>
          ) : null}
        </TBody>
      </Table>
    </div>
  );
}
