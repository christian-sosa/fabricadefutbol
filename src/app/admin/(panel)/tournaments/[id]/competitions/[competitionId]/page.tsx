import Link from "next/link";
import { notFound } from "next/navigation";

import {
  addCompetitionPlayerAction,
  createManualCompetitionMatchAction,
  deleteCompetitionCaptainInviteAction,
  deleteCompetitionPlayerAction,
  generateCompetitionFixtureAction,
  inviteCompetitionCaptainAction,
  removeCompetitionCaptainAction,
  syncCompetitionTeamsAction,
  updateCompetitionAction,
  updateCompetitionMatchAction,
  updateCompetitionPlayerAction,
  uploadCompetitionPlayerPhotoAction
} from "@/app/admin/(panel)/tournaments/[id]/competitions/[competitionId]/actions";
import { TournamentFixtureTable } from "@/components/tournaments/tournament-fixture-table";
import {
  TOURNAMENT_MATCH_STATUS_LABELS,
  TOURNAMENT_STATUS_LABELS,
  TournamentMatchStatusBadge,
  TournamentStatusBadge
} from "@/components/tournaments/tournament-badges";
import { TournamentStandingsTable } from "@/components/tournaments/tournament-standings-table";
import { TournamentTabs } from "@/components/tournaments/tournament-tabs";
import { PhotoUploadInput } from "@/components/admin/photo-upload-input";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { requireAdminCompetition } from "@/lib/auth/tournaments";
import { MAX_TOURNAMENT_PLAYERS_PER_TEAM } from "@/lib/constants";
import {
  findTopFigureRows,
  findTopScorerRows,
  getAdminCompetitionDetails,
  groupFixtureByRound
} from "@/lib/queries/tournaments";
import { formatDateTime } from "@/lib/utils";

function toInputDateTime(isoDate: string | null) {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatMatchSchedule(value: string | null) {
  return value ? formatDateTime(value) : "Sin horario";
}

function buildCaptainInviteUrl(inviteToken: string) {
  const pathname = `/captain/invite/${inviteToken}`;
  const appUrl = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) return pathname;
  return new URL(pathname, appUrl.replace(/\/+$/, "")).toString();
}

function buildTabHref(leagueId: string, competitionId: string, tab: string) {
  return `/admin/tournaments/${leagueId}/competitions/${competitionId}?tab=${encodeURIComponent(tab)}`;
}

export default async function AdminCompetitionDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string; competitionId: string }>;
  searchParams: Promise<{ tab?: string; error?: string; success?: string }>;
}) {
  const [{ id, competitionId }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  await requireAdminCompetition({ leagueId: id, competitionId });
  const details = await getAdminCompetitionDetails({ leagueId: id, competitionId });

  if (!details) notFound();

  const selectedTab = resolvedSearchParams.tab ?? "summary";
  const tabs = [
    { key: "summary", label: "Resumen" },
    { key: "teams", label: "Inscriptos" },
    { key: "rosters", label: "Planteles" },
    { key: "fixture", label: "Fixture" },
    { key: "results", label: "Resultados" },
    { key: "stats", label: "Estadísticas" }
  ];
  const groupedFixture = groupFixtureByRound(details.fixture);
  const selectedLeagueTeamIds = new Set(details.competitionTeams.map((team) => team.leagueTeamId));
  const topScorers = findTopScorerRows(details.topScorers);
  const topFigures = findTopFigureRows(details.topFigures);

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
              Competencia dentro de {details.league.name}. Aquí gestionas inscriptos, planteles, capitanes, fixture y estadísticas.
            </CardDescription>
            <p className="mt-2 text-xs text-slate-400">
              Temporada {details.competition.seasonLabel} · {details.competition.isPublic ? "Visible públicamente" : "Solo admin"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link className="text-sm font-semibold text-slate-300 hover:underline" href={`/admin/tournaments/${id}?tab=competitions`}>
              Volver a la liga
            </Link>
            <Link className="text-sm font-semibold text-emerald-300 hover:underline" href={`/tournaments/${details.league.slug}/${details.competition.slug}`}>
              Ver pública
            </Link>
          </div>
        </div>
        {resolvedSearchParams.error ? <p className="mt-3 text-sm font-semibold text-danger">{resolvedSearchParams.error}</p> : null}
        {resolvedSearchParams.success ? <p className="mt-3 text-sm font-semibold text-emerald-300">{resolvedSearchParams.success}</p> : null}
      </Card>

      <Card>
        <TournamentTabs
          items={tabs.map((tab) => ({
            href: buildTabHref(id, competitionId, tab.key),
            label: tab.label,
            active: selectedTab === tab.key
          }))}
        />
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
              <CardTitle className="mt-1 text-3xl">{details.fixture.length}</CardTitle>
            </Card>
            <Card>
              <CardDescription>Fechas</CardDescription>
              <CardTitle className="mt-1 text-3xl">{details.rounds.length}</CardTitle>
            </Card>
          </section>

          <Card>
            <CardTitle>Configuración general</CardTitle>
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
                <label className="mb-1 block text-sm font-semibold text-slate-200">Sede específica</label>
                <Input defaultValue={details.competition.venueOverride ?? ""} name="venueOverride" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-slate-200">Descripción</label>
                <Textarea defaultValue={details.competition.description ?? ""} name="description" rows={4} />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-slate-200">
                  <input className="h-4 w-4 accent-emerald-400" defaultChecked={details.competition.isPublic} name="isPublic" type="checkbox" />
                  Competencia pública
                </label>
              </div>
              <div className="md:col-span-2">
                <Button type="submit">Guardar resumen</Button>
              </div>
            </form>
          </Card>

          <section className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardTitle>Líder actual</CardTitle>
              <CardDescription className="mt-2">
                {details.standings[0] ? `${details.standings[0].teamName} (${details.standings[0].points} pts)` : "Todavía sin tabla"}
              </CardDescription>
            </Card>
            <Card>
              <CardTitle>Goleadores</CardTitle>
              <CardDescription className="mt-2">
                {topScorers.length ? topScorers.map((row) => `${row.playerName} (${row.goals})`).join(" · ") : "Sin goles cargados"}
              </CardDescription>
            </Card>
            <Card>
              <CardTitle>Figuras</CardTitle>
              <CardDescription className="mt-2">
                {topFigures.length ? topFigures.map((row) => `${row.playerName} (${row.mvpCount})`).join(" · ") : "Sin figuras cargadas"}
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
              Selecciona qué equipos de la liga participan de esta competencia. Cada inscripto mantiene plantel y capitán propios.
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
                          <p>{captain ? `Capitán: ${captain.displayName}` : invite ? `Invitado: ${invite.email}` : "Sin capitán asignado"}</p>
                          {invite ? (
                            <Link className="font-semibold text-emerald-300 hover:underline" href={buildCaptainInviteUrl(invite.inviteToken)} rel="noreferrer" target="_blank">
                              Abrir link de invitación
                            </Link>
                          ) : null}
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-slate-500">Todavía no está inscripto en esta competencia.</p>
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
                        {captain ? `Capitán asignado: ${captain.displayName}` : "Sin capitán asignado"}
                      </CardDescription>
                    </div>
                    {captain ? (
                      <form action={removeCompetitionCaptainAction.bind(null, id, competitionId)}>
                        <input name="competitionTeamId" type="hidden" value={team.id} />
                        <Button type="submit" variant="ghost">
                          Quitar capitán
                        </Button>
                      </form>
                    ) : null}
                  </div>

                  {!captain ? (
                    <form action={inviteCompetitionCaptainAction.bind(null, id, competitionId)} className="mt-4 flex flex-col gap-3 md:flex-row">
                      <input name="competitionTeamId" type="hidden" value={team.id} />
                      <Input name="email" placeholder="email@dominio.com" required type="email" />
                      <Button type="submit" variant="secondary">
                        Invitar capitán
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
                          Cancelar invitación
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
                <label className="mb-1 block text-sm font-semibold text-slate-200">Número</label>
                <Input max={99} min={1} name="shirtNumber" type="number" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200">Posición</label>
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
                                  {player.shirtNumber ? `#${player.shirtNumber}` : "Sin número"} · {player.position ?? "Sin posición"}
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
                              <label className="mb-1 block text-sm font-semibold text-slate-200">Número</label>
                              <Input defaultValue={player.shirtNumber ?? ""} max={99} min={1} name="shirtNumber" type="number" />
                            </div>
                            <div className="md:col-span-2">
                              <label className="mb-1 block text-sm font-semibold text-slate-200">Posición</label>
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
                              <PhotoUploadInput compact hint="La imagen se optimiza automáticamente a WEBP." />
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
                    <p className="mt-4 text-sm text-slate-400">Este equipo todavía no tiene jugadores cargados.</p>
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
                <CardTitle>Generación automática</CardTitle>
                <CardDescription>
                  Puedes generar el fixture automáticamente o cargar partidos manuales. La generación automática solo está disponible cuando hay al menos 2 inscriptos y todavía no existe ningún partido.
                </CardDescription>
              </div>
              <form action={generateCompetitionFixtureAction.bind(null, id, competitionId)}>
                <Button disabled={details.competitionTeams.length < 2 || details.fixture.length > 0} type="submit">
                  Generar fixture
                </Button>
              </form>
            </div>
          </Card>

          <Card>
            <CardTitle>Crear partido manual</CardTitle>
            <form action={createManualCompetitionMatchAction.bind(null, id, competitionId)} className="mt-4 grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200">Fecha</label>
                <Input defaultValue={`Fecha ${Math.max(1, details.rounds.length + 1)}`} name="roundName" required />
              </div>
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

          <div className="space-y-4">
            {groupedFixture.map((round) => (
              <Card key={`${round.roundNumber}:${round.roundName}`}>
                <CardTitle>{round.roundName}</CardTitle>
                <div className="mt-4 space-y-4">
                  {round.matches.map((match) => (
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
                          <TournamentMatchStatusBadge status={match.status} />
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
                            {details.rounds.map((roundOption) => (
                              <option key={roundOption.id} value={roundOption.id}>
                                {roundOption.name}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-slate-200">Local</label>
                          <Select defaultValue={match.homeTeamId} disabled={match.status === "played"} name="homeTeamId">
                            {details.competitionTeams.map((team) => (
                              <option key={team.id} value={team.id}>
                                {team.displayName}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-slate-200">Visitante</label>
                          <Select defaultValue={match.awayTeamId} disabled={match.status === "played"} name="awayTeamId">
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
              </Card>
            ))}

            {!groupedFixture.length ? (
              <Card>
                <CardDescription>Todavía no hay partidos generados para esta competencia.</CardDescription>
              </Card>
            ) : null}
          </div>
        </div>
      ) : null}

      {selectedTab === "results" ? (
        <Card>
          <CardTitle>Resultados y actas</CardTitle>
          <CardDescription>Entra a cada partido para cargar o corregir su marcador, notas y estadísticas opcionales.</CardDescription>
          <div className="mt-4">
            <TournamentFixtureTable
              buildMatchHref={(row) => `/admin/tournaments/${id}/competitions/${competitionId}/matches/${row.id}`}
              linkLabel="Acta"
              rows={details.fixture}
            />
          </div>
        </Card>
      ) : null}

      {selectedTab === "stats" ? (
        <div className="space-y-4">
          <Card>
            <CardTitle>Tabla de posiciones</CardTitle>
            <div className="mt-4">
              <TournamentStandingsTable rows={details.standings} />
            </div>
          </Card>

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
                          Todavía no hay goles cargados.
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
                          Todavía no hay figuras cargadas.
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
                          Todavía no hay partidos jugados.
                        </TD>
                      </tr>
                    ) : null}
                  </TBody>
                </Table>
              </div>
            </Card>
          </section>
        </div>
      ) : null}
    </div>
  );
}
