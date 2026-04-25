import Link from "next/link";
import { notFound } from "next/navigation";

import { TournamentFixtureTable } from "@/components/tournaments/tournament-fixture-table";
import { TournamentStatusBadge } from "@/components/tournaments/tournament-badges";
import { TournamentStandingsTable } from "@/components/tournaments/tournament-standings-table";
import { TournamentTabs } from "@/components/tournaments/tournament-tabs";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { getPublicCompetitionBySlugs, groupFixtureByRound } from "@/lib/queries/tournaments";
import type { CompetitionType, TournamentFixtureRow } from "@/types/domain";

function buildTabHref(leagueSlug: string, competitionSlug: string, tab: string) {
  return `/tournaments/${leagueSlug}/${competitionSlug}?tab=${encodeURIComponent(tab)}`;
}

function getCompetitionTypeLabel(type: CompetitionType) {
  switch (type) {
    case "cup":
      return "Copa";
    case "league_and_cup":
      return "Liga + copa";
    default:
      return "Liga";
  }
}

function renderFixtureSections(params: {
  leagueSlug: string;
  competitionSlug: string;
  fixture: TournamentFixtureRow[];
  type: CompetitionType;
}) {
  const grouped = groupFixtureByRound(params.fixture);
  const leagueRows = grouped.filter((group) => group.phase === "league");
  const cupRows = grouped.filter((group) => group.phase === "cup");

  if (params.type === "league") {
    return (
      <Card>
        <CardTitle>Fixture</CardTitle>
        <div className="mt-4">
          <TournamentFixtureTable
            buildMatchHref={(row) =>
              row.kind === "match"
                ? `/tournaments/${params.leagueSlug}/${params.competitionSlug}/matches/${row.id}`
                : null
            }
            linkLabel="Detalle"
            rows={params.fixture}
          />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {params.type === "league_and_cup" ? (
        <>
          <Card>
            <CardTitle>Fase liga</CardTitle>
            <CardDescription>
              La tabla se calcula solo con estos partidos. Si hay cantidad impar de equipos, la fecha libre se muestra explicitamente.
            </CardDescription>
            <div className="mt-4 space-y-4">
              {leagueRows.length ? (
                leagueRows.map((group) => (
                  <div key={`${group.phase}:${group.roundNumber}`}>
                    <p className="mb-2 text-sm font-semibold text-slate-200">{group.roundName}</p>
                    <TournamentFixtureTable
                      buildMatchHref={(row) =>
                        row.kind === "match"
                          ? `/tournaments/${params.leagueSlug}/${params.competitionSlug}/matches/${row.id}`
                          : null
                      }
                      linkLabel="Detalle"
                      rows={group.matches}
                    />
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">Todavia no hay fechas de liga generadas.</p>
              )}
            </div>
          </Card>

          <Card>
            <CardTitle>Fase copa</CardTitle>
            <CardDescription>
              Los cruces empatados se definen por penales y los avances automaticos se muestran como &quot;Pasa de ronda&quot;.
            </CardDescription>
            <div className="mt-4 space-y-4">
              {cupRows.length ? (
                cupRows.map((group) => (
                  <div key={`${group.phase}:${group.roundNumber}`}>
                    <p className="mb-2 text-sm font-semibold text-slate-200">{group.stageLabel}</p>
                    <TournamentFixtureTable
                      buildMatchHref={(row) =>
                        row.kind === "match"
                          ? `/tournaments/${params.leagueSlug}/${params.competitionSlug}/matches/${row.id}`
                          : null
                      }
                      linkLabel="Detalle"
                      rows={group.matches}
                    />
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">La copa todavia no fue generada.</p>
              )}
            </div>
          </Card>
        </>
      ) : null}

      {params.type === "cup" ? (
        <Card>
          <CardTitle>Fixture y resultados</CardTitle>
          <CardDescription>
            Los byes se muestran como avances automaticos y los cruces empatados quedan definidos por penales.
          </CardDescription>
          <div className="mt-4 space-y-4">
            {cupRows.length ? (
              cupRows.map((group) => (
                <div key={`${group.phase}:${group.roundNumber}`}>
                  <p className="mb-2 text-sm font-semibold text-slate-200">{group.stageLabel}</p>
                  <TournamentFixtureTable
                    buildMatchHref={(row) =>
                      row.kind === "match"
                        ? `/tournaments/${params.leagueSlug}/${params.competitionSlug}/matches/${row.id}`
                        : null
                    }
                    linkLabel="Detalle"
                    rows={group.matches}
                  />
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">Todavia no hay cruces generados.</p>
            )}
          </div>
        </Card>
      ) : null}
    </div>
  );
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

  const supportsTable = data.competition.type !== "cup";
  const selectedTab = resolvedSearchParams.tab ?? (supportsTable ? "table" : "fixture");
  const tabs = [
    ...(supportsTable ? [{ key: "table", label: "Tabla" }] : []),
    { key: "fixture", label: data.competition.type === "cup" ? "Cruces" : "Fixture" },
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
              {data.competition.description || "Tabla, fixture y estadisticas de la competencia."}
            </CardDescription>
            <div className="mt-3 space-y-1 text-xs text-slate-500">
              <p>Liga: {data.league.name}</p>
              <p>Temporada {data.competition.seasonLabel}</p>
              <p>Formato: {getCompetitionTypeLabel(data.competition.type)}</p>
              {data.competition.playoffSize ? <p>Playoff: top {data.competition.playoffSize}</p> : null}
              <p>
                {data.competition.venueOverride
                  ? `Sede: ${data.competition.venueOverride}`
                  : data.league.venueName
                    ? `Usa la sede general: ${data.league.venueName}`
                    : "Sede pendiente"}
              </p>
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

      {selectedTab === "table" && supportsTable ? (
        <Card>
          <CardTitle>{data.competition.type === "league_and_cup" ? "Tabla fase liga" : "Tabla de posiciones"}</CardTitle>
          <div className="mt-4">
            {data.standings.length ? (
              <TournamentStandingsTable rows={data.standings} />
            ) : (
              <p className="text-sm text-slate-400">La tabla aparecera cuando haya partidos jugados en fase liga.</p>
            )}
          </div>
        </Card>
      ) : null}

      {selectedTab === "fixture"
        ? renderFixtureSections({
            leagueSlug: data.league.slug,
            competitionSlug: data.competition.slug,
            fixture: data.fixture,
            type: data.competition.type
          })
        : null}

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
                      Todavia no hay goles cargados.
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
                      Todavia no hay figuras cargadas.
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
                      Todavia no hay partidos jugados.
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
