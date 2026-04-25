import Link from "next/link";
import { notFound } from "next/navigation";

import { TournamentFixtureTable } from "@/components/tournaments/tournament-fixture-table";
import { TournamentStatusBadge } from "@/components/tournaments/tournament-badges";
import { TournamentStandingsTable } from "@/components/tournaments/tournament-standings-table";
import { TournamentTabs } from "@/components/tournaments/tournament-tabs";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { getPublicCompetitionBySlugs } from "@/lib/queries/tournaments";

function buildTabHref(leagueSlug: string, competitionSlug: string, tab: string) {
  return `/tournaments/${leagueSlug}/${competitionSlug}?tab=${encodeURIComponent(tab)}`;
}

export default async function CompetitionDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ leagueSlug: string; competitionSlug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ leagueSlug, competitionSlug }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const data = await getPublicCompetitionBySlugs({ leagueSlug, competitionSlug });
  if (!data) notFound();

  const selectedTab = resolvedSearchParams.tab ?? "table";
  const tabs = [
    { key: "table", label: "Tabla" },
    { key: "fixture", label: "Fixture" },
    { key: "scorers", label: "Goleadores" },
    { key: "mvps", label: "Figuras" },
    { key: "defense", label: "Vallas" }
  ];

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{data.competition.name}</CardTitle>
              <TournamentStatusBadge status={data.competition.status} />
            </div>
            <CardDescription className="mt-2">
              {data.competition.description || "Tabla, fixture y estadísticas de la competencia."}
            </CardDescription>
            <div className="mt-3 space-y-1 text-xs text-slate-500">
              <p>Liga: {data.league.name}</p>
              <p>Temporada {data.competition.seasonLabel}</p>
              <p>{data.competition.venueOverride ? `Sede: ${data.competition.venueOverride}` : data.league.venueName ? `Usa la sede general: ${data.league.venueName}` : "Sede pendiente"}</p>
            </div>
          </div>
          <Link className="text-sm font-semibold text-slate-300 hover:underline" href={`/tournaments/${data.league.slug}`}>
            Volver a la liga
          </Link>
        </div>
      </Card>

      <Card>
        <TournamentTabs
          items={tabs.map((tab) => ({
            href: buildTabHref(data.league.slug, data.competition.slug, tab.key),
            label: tab.label,
            active: selectedTab === tab.key
          }))}
        />
      </Card>

      {selectedTab === "table" ? (
        <Card>
          <CardTitle>Tabla de posiciones</CardTitle>
          <div className="mt-4">
            <TournamentStandingsTable rows={data.standings} />
          </div>
        </Card>
      ) : null}

      {selectedTab === "fixture" ? (
        <Card>
          <CardTitle>Fixture</CardTitle>
          <div className="mt-4">
            <TournamentFixtureTable
              buildMatchHref={(row) => `/tournaments/${data.league.slug}/${data.competition.slug}/matches/${row.id}`}
              linkLabel="Detalle"
              rows={data.fixture}
            />
          </div>
        </Card>
      ) : null}

      {selectedTab === "scorers" ? (
        <Card>
          <CardTitle>Goleadores</CardTitle>
          <div className="mt-4 overflow-x-auto">
            <Table>
              <THead>
                <tr>
                  <TH>Jugador</TH>
                  <TH>Equipo</TH>
                  <TH>Goles</TH>
                </tr>
              </THead>
              <TBody>
                {data.topScorers.map((row) => (
                  <tr className="transition-colors hover:bg-slate-800/70" key={`${row.teamId}:${row.playerId ?? row.playerName}`}>
                    <TD className="font-semibold text-slate-100">{row.playerName}</TD>
                    <TD>{row.teamName}</TD>
                    <TD>{row.goals}</TD>
                  </tr>
                ))}
                {!data.topScorers.length ? (
                  <tr>
                    <TD className="py-6 text-sm text-slate-400" colSpan={3}>
                      Todavía no hay goles cargados.
                    </TD>
                  </tr>
                ) : null}
              </TBody>
            </Table>
          </div>
        </Card>
      ) : null}

      {selectedTab === "mvps" ? (
        <Card>
          <CardTitle>Figuras del partido</CardTitle>
          <div className="mt-4 overflow-x-auto">
            <Table>
              <THead>
                <tr>
                  <TH>Jugador</TH>
                  <TH>Equipo</TH>
                  <TH>Figuras</TH>
                </tr>
              </THead>
              <TBody>
                {data.topFigures.map((row) => (
                  <tr className="transition-colors hover:bg-slate-800/70" key={`${row.teamId}:${row.playerId ?? row.playerName}`}>
                    <TD className="font-semibold text-slate-100">{row.playerName}</TD>
                    <TD>{row.teamName}</TD>
                    <TD>{row.mvpCount}</TD>
                  </tr>
                ))}
                {!data.topFigures.length ? (
                  <tr>
                    <TD className="py-6 text-sm text-slate-400" colSpan={3}>
                      Todavía no hay figuras cargadas.
                    </TD>
                  </tr>
                ) : null}
              </TBody>
            </Table>
          </div>
        </Card>
      ) : null}

      {selectedTab === "defense" ? (
        <Card>
          <CardTitle>Vallas menos vencidas</CardTitle>
          <div className="mt-4 overflow-x-auto">
            <Table>
              <THead>
                <tr>
                  <TH>Equipo</TH>
                  <TH>GC</TH>
                  <TH>PJ</TH>
                </tr>
              </THead>
              <TBody>
                {data.bestDefense.map((row) => (
                  <tr className="transition-colors hover:bg-slate-800/70" key={row.teamId}>
                    <TD className="font-semibold text-slate-100">{row.teamName}</TD>
                    <TD>{row.goalsAgainst}</TD>
                    <TD>{row.matchesPlayed}</TD>
                  </tr>
                ))}
                {!data.bestDefense.length ? (
                  <tr>
                    <TD className="py-6 text-sm text-slate-400" colSpan={3}>
                      Todavía no hay partidos jugados.
                    </TD>
                  </tr>
                ) : null}
              </TBody>
            </Table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
