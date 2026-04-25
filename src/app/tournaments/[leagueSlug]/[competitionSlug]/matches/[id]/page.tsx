import Link from "next/link";
import { notFound } from "next/navigation";

import { TournamentMatchStatusBadge } from "@/components/tournaments/tournament-badges";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { getPublicCompetitionMatchDetails } from "@/lib/queries/tournaments";
import { formatDateTime } from "@/lib/utils";
import type { TournamentMatchStatus } from "@/types/domain";

function formatScheduledAt(value: string | null) {
  return value ? formatDateTime(value) : "Sin horario";
}

export default async function CompetitionMatchDetailPage({
  params
}: {
  params: Promise<{ leagueSlug: string; competitionSlug: string; id: string }>;
}) {
  const { leagueSlug, competitionSlug, id } = await params;
  const data = await getPublicCompetitionMatchDetails({
    leagueSlug,
    competitionSlug,
    matchId: id
  });

  if (!data) notFound();

  const showDetailedStats = data.competition.coverageMode !== "results_only";

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>
              {data.match.homeTeamName} vs {data.match.awayTeamName}
            </CardTitle>
            <CardDescription className="mt-2">
              {data.competition.name} · {data.league.name}
            </CardDescription>
            <p className="mt-2 text-sm text-slate-400">
              {formatScheduledAt(data.match.scheduledAt)} ·{" "}
              {data.match.venue || data.competition.venueOverride || data.league.venueName || "Sin sede"}
            </p>
          </div>
          <TournamentMatchStatusBadge status={data.match.status as TournamentMatchStatus} />
        </div>
      </Card>

      <Card>
        <CardTitle>Resultado</CardTitle>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <p className="text-3xl font-black text-slate-100">
            {data.match.homeScore ?? 0} - {data.match.awayScore ?? 0}
          </p>
          {data.result && data.result.penalty_home_score !== null && data.result.penalty_away_score !== null ? (
            <p className="text-sm text-amber-200">
              Penales: {data.result.penalty_home_score} - {data.result.penalty_away_score}
            </p>
          ) : null}
          {showDetailedStats ? (
            <p className="text-sm text-slate-400">
              Figura: {data.result?.mvp_player_name ?? "Sin figura cargada"}
            </p>
          ) : (
            <p className="text-sm text-slate-400">Competencia publicada solo con resultados.</p>
          )}
        </div>
        {data.result?.notes ? <p className="mt-3 text-sm text-slate-300">{data.result.notes}</p> : null}
      </Card>

      {showDetailedStats ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardTitle>{data.match.homeTeamName}</CardTitle>
            <div className="mt-4 overflow-x-auto">
              <Table>
                <THead>
                  <tr>
                    <TH>Jugador</TH>
                    <TH>G</TH>
                    <TH>A</TH>
                    <TH>R</TH>
                    <TH>Figura</TH>
                  </tr>
                </THead>
                <TBody>
                  {data.homeStats.map((row) => (
                    <tr className="transition-colors hover:bg-slate-800/70" key={`${row.player_id ?? row.player_name}:${row.team_id}`}>
                      <TD className="font-semibold text-slate-100">{row.player_name}</TD>
                      <TD>{row.goals}</TD>
                      <TD>{row.yellow_cards}</TD>
                      <TD>{row.red_cards}</TD>
                      <TD>{row.is_mvp ? "Si" : "-"}</TD>
                    </tr>
                  ))}
                  {!data.homeStats.length ? (
                    <tr>
                      <TD className="py-6 text-sm text-slate-400" colSpan={5}>
                        Sin acta cargada para este equipo.
                      </TD>
                    </tr>
                  ) : null}
                </TBody>
              </Table>
            </div>
          </Card>

          <Card>
            <CardTitle>{data.match.awayTeamName}</CardTitle>
            <div className="mt-4 overflow-x-auto">
              <Table>
                <THead>
                  <tr>
                    <TH>Jugador</TH>
                    <TH>G</TH>
                    <TH>A</TH>
                    <TH>R</TH>
                    <TH>Figura</TH>
                  </tr>
                </THead>
                <TBody>
                  {data.awayStats.map((row) => (
                    <tr className="transition-colors hover:bg-slate-800/70" key={`${row.player_id ?? row.player_name}:${row.team_id}`}>
                      <TD className="font-semibold text-slate-100">{row.player_name}</TD>
                      <TD>{row.goals}</TD>
                      <TD>{row.yellow_cards}</TD>
                      <TD>{row.red_cards}</TD>
                      <TD>{row.is_mvp ? "Si" : "-"}</TD>
                    </tr>
                  ))}
                  {!data.awayStats.length ? (
                    <tr>
                      <TD className="py-6 text-sm text-slate-400" colSpan={5}>
                        Sin acta cargada para este equipo.
                      </TD>
                    </tr>
                  ) : null}
                </TBody>
              </Table>
            </div>
          </Card>
        </section>
      ) : null}

      <Link className="text-sm font-semibold text-emerald-300 hover:underline" href={`/tournaments/${leagueSlug}/${competitionSlug}?tab=fixture`}>
        Volver al fixture de la competencia
      </Link>
    </div>
  );
}
