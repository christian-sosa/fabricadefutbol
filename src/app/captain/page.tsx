import Link from "next/link";

import {
  addCaptainTournamentPlayerAction,
  deleteCaptainTournamentPlayerAction,
  updateCaptainTournamentPlayerAction,
  uploadCaptainTournamentPlayerPhotoAction
} from "@/app/captain/actions";
import { PhotoUploadInput } from "@/components/admin/photo-upload-input";
import {
  TOURNAMENT_MATCH_STATUS_LABELS,
  TournamentMatchStatusBadge,
  TournamentStatusBadge
} from "@/components/tournaments/tournament-badges";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { Select } from "@/components/ui/select";
import { getCaptainContext } from "@/lib/auth/captains";
import { getCaptainTournamentTeamPanelData } from "@/lib/queries/tournaments";
import { formatDateTime } from "@/lib/utils";

function buildCaptainTabHref(tournamentId?: string | null, teamId?: string | null) {
  const searchParams = new URLSearchParams();
  if (tournamentId) searchParams.set("tournament", tournamentId);
  if (teamId) searchParams.set("team", teamId);
  const query = searchParams.toString();
  return query ? `/captain?${query}` : "/captain";
}

function formatTeamMatchLabel(params: {
  isHome: boolean;
  opponentName: string;
  scheduledAt: string | null;
  homeScore: number | null;
  awayScore: number | null;
}) {
  const prefix = params.isHome ? "vs" : "@";
  const schedule = params.scheduledAt ? formatDateTime(params.scheduledAt) : "Sin horario";
  const score =
    params.homeScore !== null && params.awayScore !== null ? ` · ${params.homeScore}-${params.awayScore}` : "";
  return `${prefix} ${params.opponentName} · ${schedule}${score}`;
}

export default async function CaptainPage({
  searchParams
}: {
  searchParams: Promise<{
    tournament?: string;
    team?: string;
    error?: string;
    success?: string;
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const context = await getCaptainContext({
    tournamentId: resolvedSearchParams.tournament,
    teamId: resolvedSearchParams.team,
    nextPath: buildCaptainTabHref(resolvedSearchParams.tournament, resolvedSearchParams.team)
  });

  if (!context.assignments.length) {
    return (
      <div className="space-y-4 py-6">
        <Card>
          <CardTitle>Mi equipo</CardTitle>
          <CardDescription className="mt-2">
            Todavia no tienes un equipo asignado como capitan. Cuando un admin te invite a un torneo, lo veras aqui.
          </CardDescription>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link className="text-sm font-semibold text-emerald-300 hover:underline" href="/admin">
              Ir al panel admin
            </Link>
            <Link className="text-sm font-semibold text-slate-300 hover:underline" href="/tournaments">
              Ver torneos publicos
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const selectedAssignment = context.selectedAssignment ?? context.assignments[0] ?? null;
  if (!selectedAssignment) {
    return null;
  }

  const panelData = await getCaptainTournamentTeamPanelData({
    tournamentId: selectedAssignment.tournamentId,
    teamId: selectedAssignment.teamId
  });

  if (!panelData) {
    return (
      <div className="space-y-4 py-6">
        <Card>
          <CardTitle>No pudimos cargar tu equipo</CardTitle>
          <CardDescription className="mt-2">
            Intenta nuevamente en unos segundos. Si el problema sigue, pide al admin del torneo que revise tu acceso.
          </CardDescription>
        </Card>
      </div>
    );
  }

  const upcomingMatches = panelData.teamMatches.filter((match) => match.status !== "played");
  const playedMatches = panelData.teamMatches.filter((match) => match.status === "played");

  return (
    <div className="space-y-4 py-6">
      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-400">Panel capitan</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <CardTitle>{panelData.team.name}</CardTitle>
              <TournamentStatusBadge status={panelData.tournament.status} />
              <span className="rounded-full border border-slate-700 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                {panelData.tournament.seasonLabel}
              </span>
            </div>
            <CardDescription className="mt-2">
              Gestiona los datos de tu plantel y mantén al día las fotos del equipo dentro de {panelData.tournament.name}.
            </CardDescription>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              className="text-sm font-semibold text-emerald-300 hover:underline"
              href={`/tournaments/${panelData.tournament.slug}`}
            >
              Ver torneo
            </Link>
            <Link className="text-sm font-semibold text-slate-300 hover:underline" href="/admin">
              Ir al panel admin
            </Link>
          </div>
        </div>

        {resolvedSearchParams.error ? (
          <p className="mt-3 text-sm font-semibold text-danger">{resolvedSearchParams.error}</p>
        ) : null}
        {resolvedSearchParams.success ? (
          <p className="mt-3 text-sm font-semibold text-emerald-300">{resolvedSearchParams.success}</p>
        ) : null}
      </Card>

      <Card>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Equipos que administras
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {context.assignments.map((assignment) => {
            const active =
              assignment.tournamentId === selectedAssignment.tournamentId && assignment.teamId === selectedAssignment.teamId;
            return (
              <Link
                className={
                  active
                    ? "rounded-full border border-emerald-400/60 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200"
                    : "rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-500 hover:bg-slate-800"
                }
                href={buildCaptainTabHref(assignment.tournamentId, assignment.teamId)}
                key={`${assignment.tournamentId}:${assignment.teamId}`}
              >
                {assignment.tournamentName} · {assignment.teamName}
              </Link>
            );
          })}
        </div>
      </Card>

      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardDescription>Plantel cargado</CardDescription>
          <CardTitle className="mt-1 text-3xl">{panelData.roster.length}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Posicion actual</CardDescription>
          <CardTitle className="mt-1 text-3xl">{panelData.standingRow ? panelData.standings.indexOf(panelData.standingRow) + 1 : "-"}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Puntos</CardDescription>
          <CardTitle className="mt-1 text-3xl">{panelData.standingRow?.points ?? 0}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Partidos jugados</CardDescription>
          <CardTitle className="mt-1 text-3xl">{panelData.standingRow?.played ?? 0}</CardTitle>
        </Card>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardTitle>Agregar jugador</CardTitle>
          <CardDescription className="mt-2">
            Carga a tus compañeros del plantel. Luego podrás completar su número, posición y foto.
          </CardDescription>
          <form action={addCaptainTournamentPlayerAction} className="mt-4 grid gap-3 md:grid-cols-2">
            <input name="tournamentId" type="hidden" value={panelData.tournament.id} />
            <input name="teamId" type="hidden" value={panelData.team.id} />
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="captain-full-name">
                Nombre completo
              </label>
              <Input id="captain-full-name" name="fullName" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="captain-shirt-number">
                Numero
              </label>
              <Input id="captain-shirt-number" max={99} min={1} name="shirtNumber" type="number" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="captain-position">
                Posicion
              </label>
              <Input id="captain-position" name="position" placeholder="Arquero / Defensor / ..." />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Agregar al plantel</Button>
            </div>
          </form>
        </Card>

        <Card>
          <CardTitle>Subir foto</CardTitle>
          <CardDescription className="mt-2">
            La foto se optimiza automáticamente y se refleja en el torneo.
          </CardDescription>
          <form action={uploadCaptainTournamentPlayerPhotoAction} className="mt-4 grid gap-3">
            <input name="tournamentId" type="hidden" value={panelData.tournament.id} />
            <input name="teamId" type="hidden" value={panelData.team.id} />
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="captain-player-photo">
                Jugador
              </label>
              <Select defaultValue={panelData.roster[0]?.id ?? ""} id="captain-player-photo" name="playerId" required>
                <option value="">Selecciona jugador</option>
                {panelData.roster.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.full_name}
                  </option>
                ))}
              </Select>
            </div>
            <PhotoUploadInput />
            <Button disabled={!panelData.roster.length} type="submit" variant="secondary">
              Guardar foto
            </Button>
          </form>
        </Card>
      </div>

      <section className="space-y-4">
        <Card>
          <CardTitle>Plantel del equipo</CardTitle>
          <CardDescription className="mt-2">
            Solo puedes editar jugadores de {panelData.team.name}. Los cambios impactan en el torneo, no en grupos.
          </CardDescription>
        </Card>

        {panelData.roster.length ? (
          panelData.roster.map((player) => (
            <Card key={player.id}>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex items-center gap-3">
                  <PlayerAvatar name={player.full_name} playerId={player.id} size="md" />
                  <div>
                    <CardTitle>{player.full_name}</CardTitle>
                    <CardDescription className="mt-1">
                      {player.shirt_number ? `#${player.shirt_number}` : "Sin numero"} · {player.position ?? "Sin posicion"}
                    </CardDescription>
                  </div>
                </div>

                <form action={deleteCaptainTournamentPlayerAction}>
                  <input name="tournamentId" type="hidden" value={panelData.tournament.id} />
                  <input name="teamId" type="hidden" value={panelData.team.id} />
                  <input name="playerId" type="hidden" value={player.id} />
                  <Button type="submit" variant="ghost">
                    Quitar del plantel
                  </Button>
                </form>
              </div>

              <form action={updateCaptainTournamentPlayerAction} className="mt-4 grid gap-3 md:grid-cols-2">
                <input name="tournamentId" type="hidden" value={panelData.tournament.id} />
                <input name="teamId" type="hidden" value={panelData.team.id} />
                <input name="playerId" type="hidden" value={player.id} />
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor={`player-name-${player.id}`}>
                    Nombre completo
                  </label>
                  <Input defaultValue={player.full_name} id={`player-name-${player.id}`} name="fullName" required />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor={`player-number-${player.id}`}>
                    Numero
                  </label>
                  <Input
                    defaultValue={player.shirt_number ?? ""}
                    id={`player-number-${player.id}`}
                    max={99}
                    min={1}
                    name="shirtNumber"
                    type="number"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor={`player-position-${player.id}`}>
                    Posicion
                  </label>
                  <Input
                    defaultValue={player.position ?? ""}
                    id={`player-position-${player.id}`}
                    name="position"
                    placeholder="Arquero / Defensor / ..."
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-slate-200">
                    <input
                      className="h-4 w-4 accent-emerald-400"
                      defaultChecked={player.active}
                      name="active"
                      type="checkbox"
                    />
                    Jugador activo
                  </label>
                </div>
                <div className="md:col-span-2">
                  <Button type="submit" variant="secondary">
                    Guardar jugador
                  </Button>
                </div>
              </form>
            </Card>
          ))
        ) : (
          <Card>
            <CardDescription>Este equipo todavia no tiene jugadores cargados.</CardDescription>
          </Card>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Proximos partidos</CardTitle>
          <CardDescription className="mt-2">
            Revisa fixture, horarios y estado de los encuentros de tu equipo.
          </CardDescription>
          <div className="mt-4 space-y-3">
            {upcomingMatches.length ? (
              upcomingMatches.map((match) => {
                const isHome = match.homeTeamId === panelData.team.id;
                const opponentName = isHome ? match.awayTeamName : match.homeTeamName;
                return (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3" key={match.id}>
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-semibold text-slate-100">
                          {match.roundName}
                        </p>
                        <p className="text-sm text-slate-400">
                          {formatTeamMatchLabel({
                            isHome,
                            opponentName,
                            scheduledAt: match.scheduledAt,
                            homeScore: match.homeScore,
                            awayScore: match.awayScore
                          })}
                        </p>
                      </div>
                      <TournamentMatchStatusBadge status={match.status} />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-400">No hay partidos pendientes para este equipo.</p>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle>Partidos jugados</CardTitle>
          <CardDescription className="mt-2">
            Referencia rápida de los resultados ya cargados en el torneo.
          </CardDescription>
          <div className="mt-4 space-y-3">
            {playedMatches.length ? (
              playedMatches.map((match) => {
                const isHome = match.homeTeamId === panelData.team.id;
                const opponentName = isHome ? match.awayTeamName : match.homeTeamName;
                return (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3" key={match.id}>
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-semibold text-slate-100">{match.roundName}</p>
                        <p className="text-sm text-slate-400">
                          {formatTeamMatchLabel({
                            isHome,
                            opponentName,
                            scheduledAt: match.scheduledAt,
                            homeScore: match.homeScore,
                            awayScore: match.awayScore
                          })}
                        </p>
                      </div>
                      <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200">
                        {TOURNAMENT_MATCH_STATUS_LABELS[match.status]}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-400">Todavia no hay partidos jugados para este equipo.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
