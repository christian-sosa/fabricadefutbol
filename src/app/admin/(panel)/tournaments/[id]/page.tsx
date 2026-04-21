import Link from "next/link";
import { notFound } from "next/navigation";

import {
  addTournamentPlayerAction,
  addTournamentTeamAction,
  createManualTournamentMatchAction,
  deleteTournamentPlayerAction,
  deleteTournamentTeamAction,
  generateTournamentFixtureAction,
  updateTournamentAction,
  updateTournamentMatchAction,
  updateTournamentTeamAction
} from "@/app/admin/(panel)/tournaments/[id]/actions";
import { TournamentFixtureTable } from "@/components/tournaments/tournament-fixture-table";
import { TournamentMatchStatusBadge, TournamentStatusBadge } from "@/components/tournaments/tournament-badges";
import { TournamentStandingsTable } from "@/components/tournaments/tournament-standings-table";
import { TournamentTabs } from "@/components/tournaments/tournament-tabs";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { requireAdminTournament } from "@/lib/auth/tournaments";
import { findBestDefenseRows, findTopFigureRows, findTopScorerRows, getAdminTournamentDetails, groupFixtureByRound } from "@/lib/queries/tournaments";
import { formatDateTime } from "@/lib/utils";

function buildTabHref(tournamentId: string, tab: string) {
  return `/admin/tournaments/${tournamentId}?tab=${encodeURIComponent(tab)}`;
}

function toInputDateTime(isoDate: string | null) {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatMatchSchedule(value: string | null) {
  return value ? formatDateTime(value) : "Sin horario";
}

export default async function AdminTournamentDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; error?: string; success?: string }>;
}) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  await requireAdminTournament(id);
  const details = await getAdminTournamentDetails(id);

  if (!details) notFound();

  const selectedTab = resolvedSearchParams.tab ?? "summary";
  const tabs = [
    { key: "summary", label: "Resumen" },
    { key: "teams", label: "Equipos" },
    { key: "players", label: "Jugadores" },
    { key: "fixture", label: "Fixture" },
    { key: "results", label: "Resultados" },
    { key: "stats", label: "Estadisticas" }
  ];

  const groupedFixture = groupFixtureByRound(details.fixture);
  const playedMatches = details.fixture.filter((row) => row.status === "played").length;
  const standingsLeaders = details.standings[0];
  const topScorers = findTopScorerRows(details.topScorers);
  const topFigures = findTopFigureRows(details.topFigures);
  const bestDefense = findBestDefenseRows(details.bestDefense);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{details.tournament.name}</CardTitle>
              <TournamentStatusBadge status={details.tournament.status} />
              <span className="rounded-full border border-slate-700 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                {details.tournament.seasonLabel}
              </span>
            </div>
            <CardDescription className="mt-2">
              {details.tournament.description || "Sin descripcion cargada."}
            </CardDescription>
            <p className="mt-2 text-xs text-slate-400">
              {details.tournament.isPublic ? "Visible publicamente" : "Solo visible en admin"} - /{details.tournament.slug}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link className="text-sm font-semibold text-slate-300 hover:underline" href="/admin/tournaments">
              Volver a torneos
            </Link>
            <Link className="text-sm font-semibold text-emerald-300 hover:underline" href={`/tournaments/${details.tournament.slug}`}>
              Ver publico
            </Link>
          </div>
        </div>
        {resolvedSearchParams.error ? <p className="mt-3 text-sm font-semibold text-danger">{resolvedSearchParams.error}</p> : null}
        {resolvedSearchParams.success ? <p className="mt-3 text-sm font-semibold text-emerald-300">{resolvedSearchParams.success}</p> : null}
      </Card>

      <Card>
        <TournamentTabs
          items={tabs.map((tab) => ({
            href: buildTabHref(id, tab.key),
            label: tab.label,
            active: selectedTab === tab.key
          }))}
        />
      </Card>

      {selectedTab === "summary" ? (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardDescription>Equipos</CardDescription>
              <CardTitle className="mt-1 text-3xl">{details.teams.length}</CardTitle>
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
              <CardDescription>Jugados</CardDescription>
              <CardTitle className="mt-1 text-3xl">{playedMatches}</CardTitle>
            </Card>
          </section>

          <Card>
            <CardTitle>Configuracion general</CardTitle>
            <form action={updateTournamentAction.bind(null, id)} className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="name">
                  Nombre
                </label>
                <Input defaultValue={details.tournament.name} id="name" name="name" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="seasonLabel">
                  Temporada
                </label>
                <Input defaultValue={details.tournament.seasonLabel} id="seasonLabel" name="seasonLabel" required />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="description">
                  Descripcion
                </label>
                <Textarea defaultValue={details.tournament.description ?? ""} id="description" name="description" rows={3} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="status">
                  Estado
                </label>
                <Select defaultValue={details.tournament.status} id="status" name="status">
                  <option value="draft">draft</option>
                  <option value="active">active</option>
                  <option value="finished">finished</option>
                  <option value="archived">archived</option>
                </Select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    className="h-4 w-4 accent-emerald-400"
                    defaultChecked={details.tournament.isPublic}
                    name="isPublic"
                    type="checkbox"
                  />
                  Torneo publico
                </label>
              </div>
              <div className="md:col-span-2">
                <Button type="submit">Guardar resumen</Button>
              </div>
            </form>
          </Card>

          <section className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardTitle>Lider actual</CardTitle>
              <CardDescription className="mt-2">
                {standingsLeaders ? `${standingsLeaders.teamName} (${standingsLeaders.points} pts)` : "Todavia sin tabla"}
              </CardDescription>
            </Card>
            <Card>
              <CardTitle>Goleadores</CardTitle>
              <CardDescription className="mt-2">
                {topScorers.length
                  ? topScorers.map((row) => `${row.playerName} (${row.goals})`).join(" / ")
                  : "Todavia sin goles cargados"}
              </CardDescription>
            </Card>
            <Card>
              <CardTitle>Figuras</CardTitle>
              <CardDescription className="mt-2">
                {topFigures.length
                  ? topFigures.map((row) => `${row.playerName} (${row.mvpCount})`).join(" / ")
                  : "Todavia sin figuras cargadas"}
              </CardDescription>
            </Card>
            <Card>
              <CardTitle>Valla menos vencida</CardTitle>
              <CardDescription className="mt-2">
                {bestDefense.length
                  ? bestDefense.map((row) => `${row.teamName} (${row.goalsAgainst} GC)`).join(" / ")
                  : "Todavia sin partidos jugados"}
              </CardDescription>
            </Card>
          </section>
        </>
      ) : null}

      {selectedTab === "teams" ? (
        <>
          <Card>
            <CardTitle>Agregar equipo</CardTitle>
            <form action={addTournamentTeamAction.bind(null, id)} className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="teamName">
                  Nombre
                </label>
                <Input id="teamName" name="name" placeholder="Los Pibes FC" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="shortName">
                  Nombre corto
                </label>
                <Input id="shortName" name="shortName" placeholder="LPF" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="displayOrder">
                  Orden
                </label>
                <Input defaultValue={details.teams.length + 1} id="displayOrder" min={1} name="displayOrder" required type="number" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="teamNotes">
                  Notas
                </label>
                <Textarea id="teamNotes" name="notes" rows={2} />
              </div>
              <div className="md:col-span-2">
                <Button type="submit">Agregar equipo</Button>
              </div>
            </form>
          </Card>

          <div className="space-y-4">
            {details.teams.map((team) => (
              <Card key={team.id}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle>{team.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {team.short_name ? `Corto: ${team.short_name}` : "Sin nombre corto"} - Orden {team.display_order}
                    </CardDescription>
                    <p className="mt-1 text-xs text-slate-500">
                      {details.playersByTeam.get(team.id)?.length ?? 0} jugador(es) en plantilla
                    </p>
                  </div>
                  <form action={deleteTournamentTeamAction.bind(null, id)}>
                    <input name="teamId" type="hidden" value={team.id} />
                    <Button type="submit" variant="danger">
                      Borrar equipo
                    </Button>
                  </form>
                </div>

                <form action={updateTournamentTeamAction.bind(null, id)} className="mt-4 grid gap-3 md:grid-cols-2">
                  <input name="teamId" type="hidden" value={team.id} />
                  <Input defaultValue={team.name} name="name" required />
                  <Input defaultValue={team.short_name ?? ""} name="shortName" placeholder="Nombre corto" />
                  <Input defaultValue={team.display_order} min={1} name="displayOrder" required type="number" />
                  <Textarea className="md:col-span-2" defaultValue={team.notes ?? ""} name="notes" rows={2} />
                  <div className="md:col-span-2">
                    <Button type="submit" variant="secondary">
                      Guardar equipo
                    </Button>
                  </div>
                </form>
              </Card>
            ))}

            {!details.teams.length ? (
              <Card>
                <CardDescription>Todavia no hay equipos cargados.</CardDescription>
              </Card>
            ) : null}
          </div>
        </>
      ) : null}

      {selectedTab === "players" ? (
        <>
          <Card>
            <CardTitle>Agregar jugador al torneo</CardTitle>
            <form action={addTournamentPlayerAction.bind(null, id)} className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="playerTeamId">
                  Equipo
                </label>
                <Select defaultValue={details.teams[0]?.id ?? ""} id="playerTeamId" name="teamId">
                  {details.teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="fullName">
                  Nombre completo
                </label>
                <Input id="fullName" name="fullName" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="shirtNumber">
                  Numero
                </label>
                <Input id="shirtNumber" max={99} min={1} name="shirtNumber" type="number" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="position">
                  Posicion
                </label>
                <Input id="position" name="position" placeholder="Arquero / Defensor / ..." />
              </div>
              <div className="md:col-span-2">
                <Button disabled={!details.teams.length} type="submit">
                  Agregar jugador
                </Button>
              </div>
            </form>
          </Card>

          <div className="space-y-4">
            {details.teams.map((team) => {
              const players = details.playersByTeam.get(team.id) ?? [];
              return (
                <Card key={team.id}>
                  <CardTitle>{team.name}</CardTitle>
                  <div className="mt-4 overflow-x-auto">
                    <Table>
                      <THead>
                        <tr>
                          <TH>Jugador</TH>
                          <TH>Numero</TH>
                          <TH>Posicion</TH>
                          <TH>Activo</TH>
                          <TH></TH>
                        </tr>
                      </THead>
                      <TBody>
                        {players.map((player) => (
                          <tr className="transition-colors hover:bg-slate-800/70" key={player.id}>
                            <TD className="font-semibold text-slate-100">{player.full_name}</TD>
                            <TD>{player.shirt_number ?? "-"}</TD>
                            <TD>{player.position ?? "-"}</TD>
                            <TD>{player.active ? "Si" : "No"}</TD>
                            <TD>
                              <form action={deleteTournamentPlayerAction.bind(null, id)}>
                                <input name="playerId" type="hidden" value={player.id} />
                                <Button type="submit" variant="ghost">
                                  Borrar
                                </Button>
                              </form>
                            </TD>
                          </tr>
                        ))}
                        {!players.length ? (
                          <tr>
                            <TD className="py-6 text-sm text-slate-400" colSpan={5}>
                              Este equipo todavia no tiene jugadores cargados.
                            </TD>
                          </tr>
                        ) : null}
                      </TBody>
                    </Table>
                  </div>
                </Card>
              );
            })}

            {!details.teams.length ? (
              <Card>
                <CardDescription>Primero necesitas cargar al menos un equipo.</CardDescription>
              </Card>
            ) : null}
          </div>
        </>
      ) : null}

      {selectedTab === "fixture" ? (
        <>
          <Card>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Generacion automatica</CardTitle>
                <CardDescription>
                  Solo disponible cuando hay al menos 2 equipos y todavia no existe ningun partido.
                </CardDescription>
              </div>
              <form action={generateTournamentFixtureAction.bind(null, id)}>
                <Button disabled={details.teams.length < 2 || details.fixture.length > 0} type="submit">
                  Generar fixture
                </Button>
              </form>
            </div>
          </Card>

          <Card>
            <CardTitle>Crear partido manual</CardTitle>
            <form action={createManualTournamentMatchAction.bind(null, id)} className="mt-4 grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="roundName">
                  Fecha
                </label>
                <Input defaultValue={`Fecha ${Math.max(1, details.rounds.length + 1)}`} id="roundName" name="roundName" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="homeTeamId">
                  Local
                </label>
                <Select defaultValue={details.teams[0]?.id ?? ""} id="homeTeamId" name="homeTeamId">
                  {details.teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="awayTeamId">
                  Visitante
                </label>
                <Select defaultValue={details.teams[1]?.id ?? details.teams[0]?.id ?? ""} id="awayTeamId" name="awayTeamId">
                  {details.teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="scheduledAt">
                  Horario
                </label>
                <Input id="scheduledAt" name="scheduledAt" type="datetime-local" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="venue">
                  Sede
                </label>
                <Input id="venue" name="venue" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="status">
                  Estado
                </label>
                <Select defaultValue="scheduled" id="status" name="status">
                  <option value="draft">draft</option>
                  <option value="scheduled">scheduled</option>
                  <option value="cancelled">cancelled</option>
                </Select>
              </div>
              <div className="md:col-span-3">
                <Button disabled={details.teams.length < 2} type="submit">
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
                            {formatMatchSchedule(match.scheduledAt)} - {match.venue || "Sin sede"}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <TournamentMatchStatusBadge status={match.status} />
                          <Link
                            className="text-sm font-semibold text-emerald-300 hover:underline"
                            href={`/admin/tournaments/${id}/matches/${match.id}`}
                          >
                            Gestionar acta
                          </Link>
                        </div>
                      </div>

                      <form action={updateTournamentMatchAction.bind(null, id)} className="mt-4 grid gap-3 md:grid-cols-3">
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
                            {details.teams.map((team) => (
                              <option key={team.id} value={team.id}>
                                {team.name}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-slate-200">Visitante</label>
                          <Select defaultValue={match.awayTeamId} disabled={match.status === "played"} name="awayTeamId">
                            {details.teams.map((team) => (
                              <option key={team.id} value={team.id}>
                                {team.name}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-slate-200">Horario</label>
                          <Input
                            defaultValue={toInputDateTime(match.scheduledAt)}
                            disabled={match.status === "played"}
                            name="scheduledAt"
                            type="datetime-local"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-slate-200">Sede</label>
                          <Input defaultValue={match.venue ?? ""} disabled={match.status === "played"} name="venue" />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-slate-200">Estado</label>
                          <Select defaultValue={match.status} disabled={match.status === "played"} name="status">
                            <option value="draft">draft</option>
                            <option value="scheduled">scheduled</option>
                            <option value="cancelled">cancelled</option>
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
                <CardDescription>Todavia no hay partidos generados para este torneo.</CardDescription>
              </Card>
            ) : null}
          </div>
        </>
      ) : null}

      {selectedTab === "results" ? (
        <Card>
          <CardTitle>Resultados y actas</CardTitle>
          <CardDescription>Entra a cada partido para cargar o corregir su acta y figura.</CardDescription>
          <div className="mt-4">
            <TournamentFixtureTable
              buildMatchHref={(row) => `/admin/tournaments/${id}/matches/${row.id}`}
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
        </div>
      ) : null}
    </div>
  );
}
