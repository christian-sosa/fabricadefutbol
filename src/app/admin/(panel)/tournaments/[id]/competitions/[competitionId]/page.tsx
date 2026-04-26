import Link from "next/link";
import { notFound } from "next/navigation";

import { PhotoUploadInput } from "@/components/admin/photo-upload-input";
import { TournamentFixtureTable } from "@/components/tournaments/tournament-fixture-table";
import {
  TOURNAMENT_MATCH_STATUS_LABELS,
  TOURNAMENT_STATUS_LABELS,
  TournamentMatchStatusBadge,
  TournamentStatusBadge
} from "@/components/tournaments/tournament-badges";
import { TournamentStandingsTable } from "@/components/tournaments/tournament-standings-table";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  addCompetitionPlayerAction,
  createManualCompetitionMatchAction,
  deleteCompetitionCaptainInviteAction,
  deleteCompetitionPlayerAction,
  generateCompetitionFixtureAction,
  generateCompetitionPlayoffAction,
  inviteCompetitionCaptainAction,
  removeCompetitionCaptainAction,
  syncCompetitionTeamsAction,
  updateCompetitionAction,
  updateCompetitionMatchAction,
  updateCompetitionPlayerAction,
  uploadCompetitionPlayerPhotoAction
} from "@/app/admin/(panel)/tournaments/[id]/competitions/[competitionId]/actions";
import { requireAdminCompetition } from "@/lib/auth/tournaments";
import { MAX_TOURNAMENT_PLAYERS_PER_TEAM } from "@/lib/constants";
import { formatMatchDateTime, matchIsoToDatetimeLocal } from "@/lib/match-datetime";
import {
  findTopFigureRows,
  findTopScorerRows,
  getAdminCompetitionDetails,
  groupFixtureByRound
} from "@/lib/queries/tournaments";
import type {
  CompetitionCoverageMode,
  CompetitionType,
  TournamentFixtureRow,
  TournamentMatchStatus,
  TournamentStandingRow
} from "@/types/domain";

function toInputDateTime(isoDate: string | null) {
  return matchIsoToDatetimeLocal(isoDate);
}

function formatMatchSchedule(value: string | null) {
  return value ? formatMatchDateTime(value) : "Sin horario";
}

function buildCaptainInviteUrl(inviteToken: string) {
  const pathname = `/captain/invite/${inviteToken}`;
  const appUrl = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) return pathname;
  return new URL(pathname, appUrl.replace(/\/+$/, "")).toString();
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

function getCompetitionCoverageModeLabel(coverageMode: CompetitionCoverageMode) {
  return coverageMode === "results_only" ? "Solo resultados" : "Toda la info";
}

function getFixtureModeDescription(type: CompetitionType) {
  switch (type) {
    case "cup":
      return "La competencia genera cruces de eliminacion directa. Si faltan equipos para completar la llave, se muestran los avances automaticos.";
    case "league_and_cup":
      return "La competencia arranca con fase liga. Cuando terminen esos partidos, podras generar la copa con el top configurado.";
    default:
      return "La competencia genera un round robin. Si hay cantidad impar de equipos, se muestra explicitamente quien queda libre en cada fecha.";
  }
}

function getSummaryLeaderText(params: {
  type: CompetitionType;
  standings: TournamentStandingRow[];
  cupRoundsCount: number;
}) {
  if (params.type === "cup") {
    return params.cupRoundsCount ? `Etapas cargadas: ${params.cupRoundsCount}` : "Todavia sin cruces";
  }

  if (!params.standings[0]) {
    return "Todavia sin tabla";
  }

  return `${params.standings[0].teamName} (${params.standings[0].points} pts)`;
}

function filterFixtureRowsByTeam(rows: TournamentFixtureRow[], teamId: string | null) {
  if (!teamId) return rows;
  return rows.filter(
    (row) =>
      row.homeTeamId === teamId || row.awayTeamId === teamId || row.byeTeamId === teamId
  );
}

export default async function AdminCompetitionDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string; competitionId: string }>;
  searchParams: Promise<{ tab?: string; error?: string; success?: string; team?: string }>;
}) {
  const [{ id, competitionId }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  await requireAdminCompetition({ leagueId: id, competitionId });
  const details = await getAdminCompetitionDetails({ leagueId: id, competitionId });

  if (!details) notFound();

  const selectedTab = resolvedSearchParams.tab ?? "summary";
  const selectedTeamFilter = details.competitionTeams.some((team) => team.id === resolvedSearchParams.team)
    ? resolvedSearchParams.team ?? null
    : null;
  const filteredFixture = filterFixtureRowsByTeam(details.fixture, selectedTeamFilter);
  const groupedFixture = groupFixtureByRound(filteredFixture);
  const leagueGroups = groupedFixture.filter((group) => group.phase === "league");
  const cupGroups = groupedFixture.filter((group) => group.phase === "cup");
  const selectedLeagueTeamIds = new Set(details.competitionTeams.map((team) => team.leagueTeamId));
  const topScorers = findTopScorerRows(details.topScorers);
  const topFigures = findTopFigureRows(details.topFigures);
  const matchCount = details.fixture.filter((row) => row.kind === "match").length;
  const byeCount = details.fixture.filter((row) => row.kind === "bye").length;
  const leagueMatchRows = details.fixture.filter((row) => row.kind === "match" && row.phase === "league");
  const canEditFormat = details.fixture.length === 0;
  const canGeneratePlayoff =
    details.competition.type === "league_and_cup" &&
    leagueMatchRows.length > 0 &&
    leagueMatchRows.every((row) => row.status === "played") &&
    cupGroups.length === 0;
  const defaultManualRoundName =
    details.competition.type === "cup"
      ? details.competitionTeams.length <= 2
        ? "Final"
        : details.competitionTeams.length <= 4
          ? "Semifinal"
          : "Cuartos"
      : `Fecha ${Math.max(1, leagueGroups.length + 1)}`;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{details.competition.name}</CardTitle>
              <TournamentStatusBadge status={details.competition.status} />
            </div>
            <CardDescription className="mt-2">
              Competencia dentro de {details.league.name}. Aqui gestionas inscriptos, planteles, fixture y la forma en que se publica la informacion.
            </CardDescription>
            <div className="mt-3 space-y-1 text-xs text-slate-400">
              <p>Temporada {details.competition.seasonLabel}</p>
              <p>Formato: {getCompetitionTypeLabel(details.competition.type)}</p>
              <p>Carga: {getCompetitionCoverageModeLabel(details.competition.coverageMode)}</p>
              {details.competition.playoffSize ? <p>Playoff: top {details.competition.playoffSize}</p> : null}
              <p>Publica para visitantes cuando la liga y la competencia estan activas o finalizadas.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link className="text-sm font-semibold text-slate-300 hover:underline" href={`/admin/tournaments/${id}?tab=competitions`}>
              Volver a la liga
            </Link>
            <Link className="text-sm font-semibold text-emerald-300 hover:underline" href={`/tournaments/${details.league.slug}/${details.competition.slug}`}>
              Ver publica
            </Link>
          </div>
        </div>
        {resolvedSearchParams.error ? <p className="mt-3 text-sm font-semibold text-danger">{resolvedSearchParams.error}</p> : null}
        {resolvedSearchParams.success ? <p className="mt-3 text-sm font-semibold text-emerald-300">{resolvedSearchParams.success}</p> : null}
      </Card>

      {selectedTab === "summary" ? (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardDescription>Inscriptos</CardDescription>
              <CardTitle className="mt-1 text-3xl">{details.competitionTeams.length}</CardTitle>
            </Card>
            <Card>
              <CardDescription>Jugadores</CardDescription>
              <CardTitle className="mt-1 text-3xl">{details.players.length}</CardTitle>
            </Card>
            <Card>
              <CardDescription>Partidos</CardDescription>
              <CardTitle className="mt-1 text-3xl">{matchCount}</CardTitle>
            </Card>
            <Card>
              <CardDescription>{byeCount ? "Fechas libres / byes" : "Fechas"}</CardDescription>
              <CardTitle className="mt-1 text-3xl">{byeCount || details.rounds.length}</CardTitle>
            </Card>
          </section>

          <Card>
            <CardTitle>Configuracion general</CardTitle>
            <CardDescription className="mt-2">
              Ajusta estado, descripcion, sede y visibilidad. El formato queda bloqueado una vez que ya existe fixture.
            </CardDescription>
            <form action={updateCompetitionAction.bind(null, id, competitionId)} className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200">Nombre</label>
                <Input defaultValue={details.competition.name} name="name" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200">Temporada</label>
                <Input defaultValue={details.competition.seasonLabel} name="seasonLabel" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200">Estado</label>
                <Select defaultValue={details.competition.status} name="status">
                  {(["draft", "active", "finished", "archived"] as const).map((status) => (
                    <option key={status} value={status}>
                      {TOURNAMENT_STATUS_LABELS[status]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200">Sede especifica</label>
                <Input defaultValue={details.competition.venueOverride ?? ""} name="venueOverride" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200">Formato</label>
                <Select defaultValue={details.competition.type} disabled={!canEditFormat} name="type">
                  <option value="league">Liga</option>
                  <option value="cup">Copa</option>
                  <option value="league_and_cup">Liga + copa</option>
                </Select>
                {!canEditFormat ? <input name="type" type="hidden" value={details.competition.type} /> : null}
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200">Carga de datos</label>
                <Select defaultValue={details.competition.coverageMode} name="coverageMode">
                  <option value="full_stats">Toda la info</option>
                  <option value="results_only">Solo resultados</option>
                </Select>
                <p className="mt-1 text-xs text-slate-500">
                  En solo resultados se muestran tabla y fixture. El acta se reduce a marcador y notas.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200">Playoff</label>
                <Select
                  defaultValue={details.competition.playoffSize ? String(details.competition.playoffSize) : ""}
                  disabled={!canEditFormat}
                  name="playoffSize"
                >
                  <option value="">No aplica</option>
                  <option value="4">Top 4</option>
                  <option value="8">Top 8</option>
                </Select>
                {!canEditFormat ? (
                  <input
                    name="playoffSize"
                    type="hidden"
                    value={details.competition.playoffSize ? String(details.competition.playoffSize) : ""}
                  />
                ) : null}
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-slate-200">Descripcion</label>
                <Textarea defaultValue={details.competition.description ?? ""} name="description" rows={4} />
              </div>
              <div className="md:col-span-2 space-y-3">
                {!canEditFormat ? (
                  <p className="text-xs text-amber-300">
                    El formato ya no se puede cambiar porque la competencia tiene fixture cargado.
                  </p>
                ) : null}
                <Button type="submit">Guardar resumen</Button>
              </div>
            </form>
          </Card>

          <section className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardTitle>Resumen deportivo</CardTitle>
              <CardDescription className="mt-2">
                {getSummaryLeaderText({
                  type: details.competition.type,
                  standings: details.standings,
                  cupRoundsCount: cupGroups.length
                })}
              </CardDescription>
            </Card>
            <Card>
              <CardTitle>{details.competition.coverageMode === "results_only" ? "Carga simplificada" : "Goleadores"}</CardTitle>
              <CardDescription className="mt-2">
                {details.competition.coverageMode === "results_only"
                  ? "Esta competencia no publica goleadores ni figuras. Solo usa tabla, fixture y resultados."
                  : topScorers.length
                    ? topScorers.map((row) => `${row.playerName} (${row.goals})`).join(" · ")
                    : "Sin goles cargados"}
              </CardDescription>
            </Card>
            <Card>
              <CardTitle>{details.competition.coverageMode === "results_only" ? "Acta reducida" : "Figuras"}</CardTitle>
              <CardDescription className="mt-2">
                {details.competition.coverageMode === "results_only"
                  ? "El acta guarda marcador, notas y penales si la fase lo necesita."
                  : topFigures.length
                    ? topFigures.map((row) => `${row.playerName} (${row.mvpCount})`).join(" · ")
                    : "Sin figuras cargadas"}
              </CardDescription>
            </Card>
          </section>
        </>
      ) : null}

      {selectedTab === "teams" ? (
        <div className="space-y-4">
          <Card>
            <CardTitle>Equipos inscriptos</CardTitle>
            <CardDescription className="mt-2">
              Selecciona que equipos de la liga participan de esta competencia. Cada inscripto mantiene plantel y capitan propios.
            </CardDescription>
            <form action={syncCompetitionTeamsAction.bind(null, id, competitionId)} className="mt-4 space-y-4">
              <div className="grid gap-2 md:grid-cols-2">
                {details.leagueTeams.map((team) => {
                  const competitionTeam = details.competitionTeams.find((item) => item.leagueTeamId === team.id) ?? null;
                  const captain = competitionTeam ? details.teamCaptainsByTeam.get(competitionTeam.id) ?? null : null;
                  const invite = competitionTeam ? details.captainInvitesByTeam.get(competitionTeam.id) ?? null : null;

                  return (
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3" key={team.id}>
                      <label className="flex items-center gap-3 text-sm font-semibold text-slate-200">
                        <input
                          className="h-4 w-4 accent-emerald-400"
                          defaultChecked={selectedLeagueTeamIds.has(team.id)}
                          name="leagueTeamIds"
                          type="checkbox"
                          value={team.id}
                        />
                        <span>
                          {team.name}
                          {team.shortName ? ` (${team.shortName})` : ""}
                        </span>
                      </label>

                      {competitionTeam ? (
                        <div className="mt-3 space-y-2 text-xs text-slate-400">
                          <p>Orden interno: {competitionTeam.displayOrder}</p>
                          <p>{captain ? `Capitan: ${captain.displayName}` : invite ? `Invitado: ${invite.email}` : "Sin capitan asignado"}</p>
                          {invite ? (
                            <Link className="font-semibold text-emerald-300 hover:underline" href={buildCaptainInviteUrl(invite.inviteToken)} rel="noreferrer" target="_blank">
                              Abrir link de invitacion
                            </Link>
                          ) : null}
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-slate-500">Todavia no esta inscripto en esta competencia.</p>
                      )}
                    </div>
                  );
                })}
              </div>
              <Button type="submit">Guardar inscriptos</Button>
            </form>
          </Card>

          <div className="space-y-4">
            {details.competitionTeams.map((team) => {
              const captain = details.teamCaptainsByTeam.get(team.id) ?? null;
              const invite = details.captainInvitesByTeam.get(team.id) ?? null;
              return (
                <Card key={team.id}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <CardTitle>{team.displayName}</CardTitle>
                      <CardDescription className="mt-1">
                        {captain ? `Capitan asignado: ${captain.displayName}` : "Sin capitan asignado"}
                      </CardDescription>
                    </div>
                    {captain ? (
                      <form action={removeCompetitionCaptainAction.bind(null, id, competitionId)}>
                        <input name="competitionTeamId" type="hidden" value={team.id} />
                        <Button type="submit" variant="ghost">
                          Quitar capitan
                        </Button>
                      </form>
                    ) : null}
                  </div>

                  {!captain ? (
                    <form action={inviteCompetitionCaptainAction.bind(null, id, competitionId)} className="mt-4 flex flex-col gap-3 md:flex-row">
                      <input name="competitionTeamId" type="hidden" value={team.id} />
                      <Input name="email" placeholder="email@dominio.com" required type="email" />
                      <Button type="submit" variant="secondary">
                        Invitar capitan
                      </Button>
                    </form>
                  ) : null}

                  {invite ? (
                    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 px-3 py-3 text-sm">
                      <p className="font-semibold text-slate-100">{invite.email}</p>
                      <Link className="mt-2 block break-all text-xs font-semibold text-emerald-300 hover:underline" href={buildCaptainInviteUrl(invite.inviteToken)} rel="noreferrer" target="_blank">
                        {buildCaptainInviteUrl(invite.inviteToken)}
                      </Link>
                      <form action={deleteCompetitionCaptainInviteAction.bind(null, id, competitionId)} className="mt-2">
                        <input name="inviteId" type="hidden" value={invite.id} />
                        <Button type="submit" variant="ghost">
                          Cancelar invitacion
                        </Button>
                      </form>
                    </div>
                  ) : null}
                </Card>
              );
            })}

            {!details.competitionTeams.length ? (
              <Card>
                <CardDescription>Primero inscribe equipos para poder gestionar capitanes.</CardDescription>
              </Card>
            ) : null}
          </div>
        </div>
      ) : null}

      {selectedTab === "rosters" ? (
        <div className="space-y-4">
          <Card>
            <CardTitle>Agregar jugador a la competencia</CardTitle>
            <CardDescription className="mt-2">
              Cada plantel admite hasta {MAX_TOURNAMENT_PLAYERS_PER_TEAM} jugadores. El mismo equipo puede tener otro roster distinto en otra competencia.
            </CardDescription>
            <form action={addCompetitionPlayerAction.bind(null, id, competitionId)} className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200">Equipo inscripto</label>
                <Select defaultValue={details.competitionTeams[0]?.id ?? ""} name="competitionTeamId">
                  {details.competitionTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.displayName}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200">Nombre completo</label>
                <Input name="fullName" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200">Numero</label>
                <Input max={99} min={1} name="shirtNumber" type="number" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200">Posicion</label>
                <Input name="position" placeholder="Arquero / Defensor / ..." />
              </div>
              <div className="md:col-span-2">
                <Button disabled={!details.competitionTeams.length} type="submit">
                  Agregar jugador
                </Button>
              </div>
            </form>
          </Card>

          <div className="space-y-4">
            {details.competitionTeams.map((team) => {
              const players = details.playersByTeam.get(team.id) ?? [];
              return (
                <Card key={team.id}>
                  <CardTitle>{team.displayName}</CardTitle>
                  <CardDescription className="mt-2">
                    {players.length}/{MAX_TOURNAMENT_PLAYERS_PER_TEAM} jugadores cargados en este plantel.
                  </CardDescription>

                  {players.length ? (
                    <div className="mt-4 space-y-4">
                      {players.map((player) => (
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4" key={player.id}>
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="flex items-center gap-3">
                              <PlayerAvatar name={player.fullName} playerId={player.id} size="md" />
                              <div>
                                <p className="font-semibold text-slate-100">{player.fullName}</p>
                                <p className="text-xs text-slate-500">
                                  {player.shirtNumber ? `#${player.shirtNumber}` : "Sin numero"} · {player.position ?? "Sin posicion"}
                                </p>
                              </div>
                            </div>
                            <form action={deleteCompetitionPlayerAction.bind(null, id, competitionId)}>
                              <input name="competitionTeamId" type="hidden" value={team.id} />
                              <input name="playerId" type="hidden" value={player.id} />
                              <Button type="submit" variant="ghost">
                                Quitar del plantel
                              </Button>
                            </form>
                          </div>

                          <form action={updateCompetitionPlayerAction.bind(null, id, competitionId)} className="mt-4 grid gap-3 md:grid-cols-2">
                            <input name="competitionTeamId" type="hidden" value={team.id} />
                            <input name="playerId" type="hidden" value={player.id} />
                            <div>
                              <label className="mb-1 block text-sm font-semibold text-slate-200">Nombre completo</label>
                              <Input defaultValue={player.fullName} name="fullName" required />
                            </div>
                            <div>
                              <label className="mb-1 block text-sm font-semibold text-slate-200">Numero</label>
                              <Input defaultValue={player.shirtNumber ?? ""} max={99} min={1} name="shirtNumber" type="number" />
                            </div>
                            <div className="md:col-span-2">
                              <label className="mb-1 block text-sm font-semibold text-slate-200">Posicion</label>
                              <Input defaultValue={player.position ?? ""} name="position" />
                            </div>
                            <div className="md:col-span-2">
                              <Button type="submit" variant="secondary">
                                Guardar jugador
                              </Button>
                            </div>
                          </form>

                          <form action={uploadCompetitionPlayerPhotoAction.bind(null, id, competitionId)} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                            <input name="competitionTeamId" type="hidden" value={team.id} />
                            <input name="playerId" type="hidden" value={player.id} />
                            <div>
                              <label className="mb-1 block text-sm font-semibold text-slate-200">Foto del jugador</label>
                              <PhotoUploadInput compact hint="La imagen se optimiza automaticamente a WEBP." />
                            </div>
                            <div className="md:self-end">
                              <Button type="submit" variant="secondary">
                                Guardar foto
                              </Button>
                            </div>
                          </form>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-400">Este equipo todavia no tiene jugadores cargados.</p>
                  )}
                </Card>
              );
            })}

            {!details.competitionTeams.length ? (
              <Card>
                <CardDescription>Primero debes tener equipos inscriptos para cargar planteles.</CardDescription>
              </Card>
            ) : null}
          </div>
        </div>
      ) : null}

      {selectedTab === "fixture" ? (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Generacion automatica</CardTitle>
                <CardDescription className="mt-1">{getFixtureModeDescription(details.competition.type)}</CardDescription>
              </div>
              <div className="flex flex-wrap gap-3">
                <form action={generateCompetitionFixtureAction.bind(null, id, competitionId)}>
                  <Button disabled={details.competitionTeams.length < 2 || details.fixture.length > 0} type="submit">
                    Generar fixture
                  </Button>
                </form>
                {details.competition.type === "league_and_cup" ? (
                  <form action={generateCompetitionPlayoffAction.bind(null, id, competitionId)}>
                    <Button disabled={!canGeneratePlayoff} type="submit" variant="secondary">
                      Generar copa
                    </Button>
                  </form>
                ) : null}
              </div>
            </div>
            {details.competition.type === "league_and_cup" && !canGeneratePlayoff && cupGroups.length === 0 ? (
              <p className="mt-3 text-xs text-slate-400">
                La copa se habilita cuando todos los partidos de la fase liga esten jugados.
              </p>
            ) : null}
          </Card>

          <Card>
            <CardTitle>Crear partido manual</CardTitle>
            <CardDescription className="mt-2">
              Si necesitas ajustar el fixture, puedes crear partidos sueltos sin perder el resto de la estructura.
            </CardDescription>
            <form action={createManualCompetitionMatchAction.bind(null, id, competitionId)} className="mt-4 grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200">Nombre de fecha / etapa</label>
                <Input defaultValue={defaultManualRoundName} name="roundName" required />
              </div>
              {details.competition.type === "league_and_cup" ? (
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-200">Fase</label>
                  <Select defaultValue="league" name="phase">
                    <option value="league">Liga</option>
                    <option value="cup">Copa</option>
                  </Select>
                </div>
              ) : null}
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200">Local</label>
                <Select defaultValue={details.competitionTeams[0]?.id ?? ""} name="homeTeamId">
                  {details.competitionTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.displayName}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200">Visitante</label>
                <Select defaultValue={details.competitionTeams[1]?.id ?? details.competitionTeams[0]?.id ?? ""} name="awayTeamId">
                  {details.competitionTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.displayName}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200">Horario</label>
                <Input name="scheduledAt" type="datetime-local" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200">Sede</label>
                <Input name="venue" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200">Estado</label>
                <Select defaultValue="scheduled" name="status">
                  {(["draft", "scheduled", "cancelled"] as const).map((status) => (
                    <option key={status} value={status}>
                      {TOURNAMENT_MATCH_STATUS_LABELS[status]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="md:col-span-3">
                <Button disabled={details.competitionTeams.length < 2} type="submit">
                  Crear partido
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <CardTitle>Filtrar fixture</CardTitle>
            <CardDescription className="mt-2">
              Divide el calendario por fechas y, si quieres, sigue solamente el recorrido de un equipo.
            </CardDescription>
            <form className="mt-4 flex flex-col gap-3 md:flex-row md:items-end">
              <input name="tab" type="hidden" value="fixture" />
              <div className="w-full md:max-w-sm">
                <label className="mb-1 block text-sm font-semibold text-slate-200">Equipo</label>
                <Select defaultValue={selectedTeamFilter ?? ""} name="team">
                  <option value="">Todos los equipos</option>
                  {details.competitionTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.shortName ? `${team.displayName} (${team.shortName})` : team.displayName}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex gap-3">
                <Button type="submit" variant="secondary">
                  Filtrar
                </Button>
                {selectedTeamFilter ? (
                  <Link
                    className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:bg-slate-800"
                    href={`/admin/tournaments/${id}/competitions/${competitionId}?tab=fixture`}
                  >
                    Limpiar
                  </Link>
                ) : null}
              </div>
            </form>
          </Card>

          <div className="space-y-4">
            {groupedFixture.map((group) => {
              const byeRows = group.matches.filter((row) => row.kind === "bye");
              const matchRows = group.matches.filter((row) => row.kind === "match");

              return (
                <Card key={`${group.phase}:${group.roundNumber}:${group.roundName}`}>
                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <CardTitle>{group.phase === "cup" ? group.stageLabel : group.roundName}</CardTitle>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {group.phase === "cup" ? "Fase copa" : "Fase liga"}
                    </p>
                  </div>

                  {byeRows.length ? (
                    <div className="mt-4">
                      <TournamentFixtureTable rows={byeRows} />
                    </div>
                  ) : null}

                  {matchRows.length ? (
                    <div className="mt-4 space-y-4">
                      {matchRows.map((match) => (
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4" key={match.id}>
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="font-semibold text-slate-100">
                                {match.homeTeamName} vs {match.awayTeamName}
                              </p>
                              <p className="text-sm text-slate-400">
                                {formatMatchSchedule(match.scheduledAt)} · {match.venue || details.competition.venueOverride || details.league.venueName || "Sin sede"}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                              <TournamentMatchStatusBadge status={match.status as TournamentMatchStatus} />
                              <Link
                                className="text-sm font-semibold text-emerald-300 hover:underline"
                                href={`/admin/tournaments/${id}/competitions/${competitionId}/matches/${match.id}`}
                              >
                                Gestionar acta
                              </Link>
                            </div>
                          </div>

                          <form action={updateCompetitionMatchAction.bind(null, id, competitionId)} className="mt-4 grid gap-3 md:grid-cols-3">
                            <input name="matchId" type="hidden" value={match.id} />
                            <div>
                              <label className="mb-1 block text-sm font-semibold text-slate-200">Fecha</label>
                              <Select defaultValue={match.roundId ?? ""} disabled={match.status === "played"} name="roundId">
                                <option value="">Partido suelto</option>
                                {details.rounds
                                  .filter((roundOption) => roundOption.phase === match.phase)
                                  .map((roundOption) => (
                                    <option key={roundOption.id} value={roundOption.id}>
                                      {roundOption.name}
                                    </option>
                                  ))}
                              </Select>
                            </div>
                            <div>
                              <label className="mb-1 block text-sm font-semibold text-slate-200">Local</label>
                              <Select defaultValue={match.homeTeamId ?? ""} disabled={match.status === "played"} name="homeTeamId">
                                {details.competitionTeams.map((team) => (
                                  <option key={team.id} value={team.id}>
                                    {team.displayName}
                                  </option>
                                ))}
                              </Select>
                            </div>
                            <div>
                              <label className="mb-1 block text-sm font-semibold text-slate-200">Visitante</label>
                              <Select defaultValue={match.awayTeamId ?? ""} disabled={match.status === "played"} name="awayTeamId">
                                {details.competitionTeams.map((team) => (
                                  <option key={team.id} value={team.id}>
                                    {team.displayName}
                                  </option>
                                ))}
                              </Select>
                            </div>
                            <div>
                              <label className="mb-1 block text-sm font-semibold text-slate-200">Horario</label>
                              <Input defaultValue={toInputDateTime(match.scheduledAt)} disabled={match.status === "played"} name="scheduledAt" type="datetime-local" />
                            </div>
                            <div>
                              <label className="mb-1 block text-sm font-semibold text-slate-200">Sede</label>
                              <Input defaultValue={match.venue ?? ""} disabled={match.status === "played"} name="venue" />
                            </div>
                            <div>
                              <label className="mb-1 block text-sm font-semibold text-slate-200">Estado</label>
                              <Select defaultValue={match.status} disabled={match.status === "played"} name="status">
                                {(["draft", "scheduled", "cancelled"] as const).map((status) => (
                                  <option key={status} value={status}>
                                    {TOURNAMENT_MATCH_STATUS_LABELS[status]}
                                  </option>
                                ))}
                              </Select>
                            </div>
                            <div className="md:col-span-3">
                              <Button disabled={match.status === "played"} type="submit" variant="secondary">
                                Guardar partido
                              </Button>
                            </div>
                          </form>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </Card>
              );
            })}

            {!groupedFixture.length ? (
              <Card>
                <CardDescription>
                  {selectedTeamFilter
                    ? "Ese equipo todavia no tiene partidos ni fechas libres cargadas."
                    : "Todavia no hay partidos generados para esta competencia."}
                </CardDescription>
              </Card>
            ) : null}
          </div>
        </div>
      ) : null}

      {selectedTab === "results" ? (
        <Card>
          <CardTitle>Resultados y actas</CardTitle>
          <CardDescription>
            {details.competition.coverageMode === "results_only"
              ? "Entra a cada partido para cargar o corregir marcador, notas y penales cuando corresponda."
              : "Entra a cada partido para cargar o corregir su marcador, notas y estadisticas opcionales."}
          </CardDescription>
          <div className="mt-4">
            <TournamentFixtureTable
              buildMatchHref={(row) =>
                row.kind === "match" ? `/admin/tournaments/${id}/competitions/${competitionId}/matches/${row.id}` : null
              }
              linkLabel="Acta"
              rows={details.fixture}
            />
          </div>
        </Card>
      ) : null}

      {selectedTab === "stats" ? (
        <div className="space-y-4">
          {details.competition.coverageMode === "results_only" ? (
            <Card>
              <CardTitle>Competencia en modo solo resultados</CardTitle>
              <CardDescription>
                Esta competencia no calcula goleadores, figuras ni vallas. Usa Tabla y Fixture como vistas principales.
              </CardDescription>
            </Card>
          ) : null}

          {details.competition.type !== "cup" ? (
            <Card>
              <CardTitle>{details.competition.type === "league_and_cup" ? "Tabla fase liga" : "Tabla de posiciones"}</CardTitle>
              <div className="mt-4">
                <TournamentStandingsTable rows={details.standings} />
              </div>
            </Card>
          ) : (
            <Card>
              <CardTitle>Sin tabla general</CardTitle>
              <CardDescription>
                Las competencias de copa se siguen por cruces. Usa Fixture y Resultados para ver los avances de ronda.
              </CardDescription>
            </Card>
          )}

          {details.competition.coverageMode !== "results_only" ? (
            <section className="grid gap-4 lg:grid-cols-3">
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
                      {details.topScorers.map((row) => (
                        <tr className="transition-colors hover:bg-slate-800/70" key={`${row.teamId}:${row.playerId ?? row.playerName}`}>
                          <TD className="font-semibold text-slate-100">{row.playerName}</TD>
                          <TD>{row.teamName}</TD>
                          <TD>{row.goals}</TD>
                        </tr>
                      ))}
                      {!details.topScorers.length ? (
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

              <Card>
                <CardTitle>Figuras</CardTitle>
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
                      {details.topFigures.map((row) => (
                        <tr className="transition-colors hover:bg-slate-800/70" key={`${row.teamId}:${row.playerId ?? row.playerName}`}>
                          <TD className="font-semibold text-slate-100">{row.playerName}</TD>
                          <TD>{row.teamName}</TD>
                          <TD>{row.mvpCount}</TD>
                        </tr>
                      ))}
                      {!details.topFigures.length ? (
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
                      {details.bestDefense.map((row) => (
                        <tr className="transition-colors hover:bg-slate-800/70" key={row.teamId}>
                          <TD className="font-semibold text-slate-100">{row.teamName}</TD>
                          <TD>{row.goalsAgainst}</TD>
                          <TD>{row.matchesPlayed}</TD>
                        </tr>
                      ))}
                      {!details.bestDefense.length ? (
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
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
