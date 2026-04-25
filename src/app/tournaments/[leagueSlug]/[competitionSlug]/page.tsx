import Link from "next/link";
import { notFound } from "next/navigation";

import { TournamentFixtureTable } from "@/components/tournaments/tournament-fixture-table";
import { TournamentStatusBadge } from "@/components/tournaments/tournament-badges";
import { TournamentStandingsTable } from "@/components/tournaments/tournament-standings-table";
import { TournamentTabs } from "@/components/tournaments/tournament-tabs";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { getPublicCompetitionBySlugs, groupFixtureByRound } from "@/lib/queries/tournaments";
import type {
  CompetitionCoverageMode,
  CompetitionType,
  TournamentFixtureRow
} from "@/types/domain";

function buildTabHref(leagueSlug: string, competitionSlug: string, tab: string, team: string | null) {
  const searchParams = new URLSearchParams();
  searchParams.set("tab", tab);
  if (team) searchParams.set("team", team);
  return `/tournaments/${leagueSlug}/${competitionSlug}?${searchParams.toString()}`;
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

function filterFixtureRowsByTeam(rows: TournamentFixtureRow[], teamId: string | null) {
  if (!teamId) return rows;
  return rows.filter(
    (row) => row.homeTeamId === teamId || row.awayTeamId === teamId || row.byeTeamId === teamId
  );
}

function getCompetitionTabs(params: {
  coverageMode: CompetitionCoverageMode;
  supportsTable: boolean;
  type: CompetitionType;
}) {
  if (params.coverageMode === "results_only") {
    return [
      ...(params.supportsTable ? [{ key: "table", label: "Tabla" }] : []),
      { key: "fixture", label: params.type === "cup" ? "Cruces" : "Fixture" }
    ];
  }

  return [
    ...(params.supportsTable ? [{ key: "table", label: "Tabla" }] : []),
    { key: "fixture", label: params.type === "cup" ? "Cruces" : "Fixture" },
    { key: "scorers", label: "Goleadores" },
    { key: "mvps", label: "Figuras" },
    { key: "defense", label: "Vallas" }
  ];
}

function renderRoundGroups(params: {
  groups: ReturnType<typeof groupFixtureByRound>;
  leagueSlug: string;
  competitionSlug: string;
  emptyMessage: string;
}) {
  if (!params.groups.length) {
    return <p className="text-sm text-slate-400">{params.emptyMessage}</p>;
  }

  return params.groups.map((group) => (
    <div key={`${group.phase}:${group.roundNumber}`}>
      <p className="mb-2 text-sm font-semibold text-slate-200">
        {group.phase === "cup" ? group.stageLabel : group.roundName}
      </p>
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
  ));
}

function renderFixtureSections(params: {
  leagueSlug: string;
  competitionSlug: string;
  fixture: TournamentFixtureRow[];
  selectedTeamId: string | null;
  teamOptions: Array<{ id: string; label: string }>;
  type: CompetitionType;
}) {
  const filteredFixture = filterFixtureRowsByTeam(params.fixture, params.selectedTeamId);
  const grouped = groupFixtureByRound(filteredFixture);
  const leagueRows = grouped.filter((group) => group.phase === "league");
  const cupRows = grouped.filter((group) => group.phase === "cup");

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Fixture por fechas</CardTitle>
        <CardDescription className="mt-2">
          Revisa todas las fechas de la competencia o filtra el recorrido de un equipo puntual.
        </CardDescription>
        <form className="mt-4 flex flex-col gap-3 md:flex-row md:items-end">
          <input name="tab" type="hidden" value="fixture" />
          <div className="w-full md:max-w-sm">
            <label className="mb-1 block text-sm font-semibold text-slate-200">Equipo</label>
            <Select defaultValue={params.selectedTeamId ?? ""} name="team">
              <option value="">Todos los equipos</option>
              {params.teamOptions.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-3">
            <button className="rounded-full border border-emerald-400/50 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20" type="submit">
              Filtrar
            </button>
            {params.selectedTeamId ? (
              <Link
                className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:bg-slate-800"
                href={`/tournaments/${params.leagueSlug}/${params.competitionSlug}?tab=fixture`}
              >
                Limpiar
              </Link>
            ) : null}
          </div>
        </form>
      </Card>

      {params.type === "league" ? (
        <Card>
          <CardTitle>Fixture</CardTitle>
          <CardDescription className="mt-2">
            Las fechas libres quedan marcadas dentro de cada jornada cuando la cantidad de equipos es impar.
          </CardDescription>
          <div className="mt-4 space-y-4">
            {renderRoundGroups({
              groups: leagueRows,
              leagueSlug: params.leagueSlug,
              competitionSlug: params.competitionSlug,
              emptyMessage: params.selectedTeamId
                ? "Ese equipo todavia no tiene partidos o fechas libres cargadas."
                : "Todavia no hay fechas generadas."
            })}
          </div>
        </Card>
      ) : null}

      {params.type === "league_and_cup" ? (
        <>
          <Card>
            <CardTitle>Fase liga</CardTitle>
            <CardDescription>
              La tabla se calcula solo con estos partidos. Si hay cantidad impar de equipos, la fecha libre se muestra explicitamente.
            </CardDescription>
            <div className="mt-4 space-y-4">
              {renderRoundGroups({
                groups: leagueRows,
                leagueSlug: params.leagueSlug,
                competitionSlug: params.competitionSlug,
                emptyMessage: params.selectedTeamId
                  ? "Ese equipo todavia no tiene partidos o fechas libres en la fase liga."
                  : "Todavia no hay fechas de liga generadas."
              })}
            </div>
          </Card>

          <Card>
            <CardTitle>Fase copa</CardTitle>
            <CardDescription>
              Los cruces empatados se definen por penales y los avances automaticos se muestran como &quot;Pasa de ronda&quot;.
            </CardDescription>
            <div className="mt-4 space-y-4">
              {renderRoundGroups({
                groups: cupRows,
                leagueSlug: params.leagueSlug,
                competitionSlug: params.competitionSlug,
                emptyMessage: params.selectedTeamId
                  ? "Ese equipo todavia no tiene cruces cargados en la fase copa."
                  : "La copa todavia no fue generada."
              })}
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
            {renderRoundGroups({
              groups: cupRows,
              leagueSlug: params.leagueSlug,
              competitionSlug: params.competitionSlug,
              emptyMessage: params.selectedTeamId
                ? "Ese equipo todavia no tiene cruces cargados."
                : "Todavia no hay cruces generados."
            })}
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
  searchParams: Promise<{ tab?: string; team?: string }>;
}) {
  const [{ leagueSlug, competitionSlug }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const data = await getPublicCompetitionBySlugs({ leagueSlug, competitionSlug });
  if (!data) notFound();

  const supportsTable = data.competition.type !== "cup";
  const availableTabs = getCompetitionTabs({
    coverageMode: data.competition.coverageMode,
    supportsTable,
    type: data.competition.type
  });
  const selectedTab = availableTabs.some((tab) => tab.key === resolvedSearchParams.tab)
    ? resolvedSearchParams.tab ?? availableTabs[0]?.key ?? "fixture"
    : availableTabs[0]?.key ?? "fixture";
  const selectedTeamId = data.competitionTeams.some((team) => team.id === resolvedSearchParams.team)
    ? resolvedSearchParams.team ?? null
    : null;

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
              {data.competition.description ||
                (data.competition.coverageMode === "results_only"
                  ? "Tabla y fixture de la competencia."
                  : "Tabla, fixture y estadisticas de la competencia.")}
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
              {data.competition.coverageMode === "results_only" ? (
                <p>Esta competencia publica solo tabla y fixture.</p>
              ) : null}
            </div>
          </div>
          <Link className="text-sm font-semibold text-slate-300 hover:underline" href={`/tournaments/${data.league.slug}`}>
            Volver a la liga
          </Link>
        </div>
      </Card>

      <Card>
        <TournamentTabs
          items={availableTabs.map((tab) => ({
            href: buildTabHref(data.league.slug, data.competition.slug, tab.key, selectedTeamId),
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
            selectedTeamId,
            teamOptions: data.competitionTeams.map((team) => ({
              id: team.id,
              label: team.shortName ? `${team.displayName} (${team.shortName})` : team.displayName
            })),
            type: data.competition.type
          })
        : null}

      {selectedTab === "scorers" && data.competition.coverageMode !== "results_only" ? (
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

      {selectedTab === "mvps" && data.competition.coverageMode !== "results_only" ? (
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

      {selectedTab === "defense" && data.competition.coverageMode !== "results_only" ? (
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
