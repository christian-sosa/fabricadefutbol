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
import { getCaptainContext } from "@/lib/auth/captains";
import { MAX_TOURNAMENT_PLAYERS_PER_TEAM } from "@/lib/constants";
import { formatMatchDateTime } from "@/lib/match-datetime";
import { getCaptainCompetitionTeamPanelData } from "@/lib/queries/tournaments";
import type { TournamentMatchStatus } from "@/types/domain";

function buildCaptainTabHref(competitionId?: string | null, teamId?: string | null) {
  const searchParams = new URLSearchParams();
  if (competitionId) searchParams.set("competition", competitionId);
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
  const schedule = params.scheduledAt ? formatMatchDateTime(params.scheduledAt) : "Sin horario";
  const score =
    params.homeScore !== null && params.awayScore !== null ? ` · ${params.homeScore}-${params.awayScore}` : "";
  return `${prefix} ${params.opponentName} · ${schedule}${score}`;
}

export default async function CaptainPage({
  searchParams
}: {
  searchParams: Promise<{
    competition?: string;
    team?: string;
    error?: string;
    success?: string;
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const context = await getCaptainContext({
    competitionId: resolvedSearchParams.competition,
    teamId: resolvedSearchParams.team,
    nextPath: buildCaptainTabHref(resolvedSearchParams.competition, resolvedSearchParams.team)
  });

  if (!context.assignments.length) {
    return (
      <div className="space-y-4 py-6">
        <Card>
          <CardTitle>Tus equipos de competencia</CardTitle>
          <CardDescription className="mt-2">
            Todavía no tienes equipos asignados como capitán. Cuando un admin te invite a una competencia, los verás aquí.
          </CardDescription>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link className="text-sm font-semibold text-emerald-300 hover:underline" href="/admin">
              Ir al panel admin
            </Link>
            <Link className="text-sm font-semibold text-slate-300 hover:underline" href="/tournaments">
              Ver ligas públicas
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const selectedAssignment = context.selectedAssignment ?? context.assignments[0] ?? null;
  if (!selectedAssignment) return null;

  const panelData = await getCaptainCompetitionTeamPanelData({
    competitionId: selectedAssignment.competitionId,
    competitionTeamId: selectedAssignment.competitionTeamId
  });

  if (!panelData) {
    return (
      <div className="space-y-4 py-6">
        <Card>
          <CardTitle>No pudimos cargar tu equipo</CardTitle>
          <CardDescription className="mt-2">
            Intenta nuevamente en unos segundos. Si el problema sigue, pide al admin de la competencia que revise tu acceso.
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-400">Panel capitán</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <CardTitle>{panelData.competition.name}</CardTitle>
              <TournamentStatusBadge status={panelData.competition.status} />
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-200">Equipo asignado: {panelData.team.displayName}</p>
            <CardDescription className="mt-2">
              Gestiona el plantel y las fotos de {panelData.team.displayName} dentro de {panelData.competition.name}.
            </CardDescription>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link className="text-sm font-semibold text-emerald-300 hover:underline" href={`/tournaments/${panelData.league.slug}/${panelData.competition.slug}`}>
              Ver competencia
            </Link>
            <Link className="text-sm font-semibold text-slate-300 hover:underline" href="/admin">
              Ir al panel admin
            </Link>
          </div>
        </div>

        {resolvedSearchParams.error ? <p className="mt-3 text-sm font-semibold text-danger">{resolvedSearchParams.error}</p> : null}
        {resolvedSearchParams.success ? <p className="mt-3 text-sm font-semibold text-emerald-300">{resolvedSearchParams.success}</p> : null}
      </Card>

      <Card>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Equipos donde eres capitán</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {context.assignments.map((assignment) => {
            const active =
              assignment.competitionId === selectedAssignment.competitionId &&
              assignment.competitionTeamId === selectedAssignment.competitionTeamId;
            return (
              <Link
                className={
                  active
                    ? "rounded-full border border-emerald-400/60 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200"
                    : "rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-500 hover:bg-slate-800"
                }
                href={buildCaptainTabHref(assignment.competitionId, assignment.competitionTeamId)}
                key={`${assignment.competitionId}:${assignment.competitionTeamId}`}
              >
                {assignment.teamName} · {assignment.competitionName}
              </Link>
            );
          })}
        </div>
      </Card>

      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardDescription>Jugadores cargados</CardDescription>
          <CardTitle className="mt-1 text-3xl">{panelData.roster.length}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Posición actual</CardDescription>
          <CardTitle className="mt-1 text-3xl">
            {panelData.standingRow ? panelData.standings.indexOf(panelData.standingRow) + 1 : "-"}
          </CardTitle>
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

      <Card>
        <CardTitle>Agregar jugador</CardTitle>
        <CardDescription className="mt-2">
          Carga a tus compañeros del equipo. Límite: {MAX_TOURNAMENT_PLAYERS_PER_TEAM} jugadores por plantel.
        </CardDescription>
        <form action={addCaptainTournamentPlayerAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <input name="competitionId" type="hidden" value={panelData.competition.id} />
          <input name="teamId" type="hidden" value={panelData.team.id} />
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200">Nombre completo</label>
            <Input name="fullName" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200">Número</label>
            <Input max={99} min={1} name="shirtNumber" type="number" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-slate-200">Posición</label>
            <Input name="position" placeholder="Arquero / Defensor / ..." />
          </div>
          <div className="md:col-span-2">
            <Button type="submit">Agregar jugador</Button>
          </div>
        </form>
      </Card>

      <section className="space-y-4">
        {panelData.roster.length ? (
          panelData.roster.map((player) => (
            <Card key={player.id}>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex items-center gap-3">
                  <PlayerAvatar name={player.fullName} playerId={player.id} size="md" />
                  <div>
                    <CardTitle>{player.fullName}</CardTitle>
                    <CardDescription className="mt-1">
                      {player.shirtNumber ? `#${player.shirtNumber}` : "Sin número"} · {player.position ?? "Sin posición"}
                    </CardDescription>
                  </div>
                </div>

                <form action={deleteCaptainTournamentPlayerAction}>
                  <input name="competitionId" type="hidden" value={panelData.competition.id} />
                  <input name="teamId" type="hidden" value={panelData.team.id} />
                  <input name="playerId" type="hidden" value={player.id} />
                  <Button type="submit" variant="ghost">
                    Quitar del plantel
                  </Button>
                </form>
              </div>

              <form action={updateCaptainTournamentPlayerAction} className="mt-4 grid gap-3 md:grid-cols-2">
                <input name="competitionId" type="hidden" value={panelData.competition.id} />
                <input name="teamId" type="hidden" value={panelData.team.id} />
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

              <form action={uploadCaptainTournamentPlayerPhotoAction} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                <input name="competitionId" type="hidden" value={panelData.competition.id} />
                <input name="teamId" type="hidden" value={panelData.team.id} />
                <input name="playerId" type="hidden" value={player.id} />
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-200">Foto del jugador</label>
                  <PhotoUploadInput compact hint="Se optimiza automáticamente a WEBP." />
                </div>
                <div className="md:self-end">
                  <Button type="submit" variant="secondary">
                    Guardar foto
                  </Button>
                </div>
              </form>
            </Card>
          ))
        ) : (
          <Card>
            <CardDescription>Este equipo todavía no tiene jugadores cargados.</CardDescription>
          </Card>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Próximos partidos</CardTitle>
          <div className="mt-4 space-y-3">
            {upcomingMatches.length ? (
              upcomingMatches.map((match) => {
                const isHome = match.homeTeamId === panelData.team.id;
                const opponentName = isHome ? (match.awayTeamName ?? "Rival por definir") : (match.homeTeamName ?? "Rival por definir");
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
                      <TournamentMatchStatusBadge status={match.status as TournamentMatchStatus} />
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
          <div className="mt-4 space-y-3">
            {playedMatches.length ? (
              playedMatches.map((match) => {
                const isHome = match.homeTeamId === panelData.team.id;
                const opponentName = isHome ? (match.awayTeamName ?? "Rival por definir") : (match.homeTeamName ?? "Rival por definir");
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
                        {TOURNAMENT_MATCH_STATUS_LABELS[match.status as TournamentMatchStatus]}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-400">Todavía no hay partidos jugados para este equipo.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
