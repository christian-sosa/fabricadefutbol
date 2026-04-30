import Link from "next/link";
import { notFound } from "next/navigation";

import {
  addClubCompetitionAction,
  addClubMatchAction,
  addClubPlayerAction,
  addClubTeamAction,
  bulkAddClubPlayersAction,
  inviteClubAdminAction,
  removeClubAdminAction,
  revokeClubAdminInviteAction,
  syncClubTeamRosterAction,
  toggleClubPlayerAction,
  updateClubAction,
  uploadClubPlayerPhotoAction,
  uploadClubTeamLogoAction
} from "@/app/admin/(panel)/clubs/[clubId]/actions";
import { MatchPlayerPicker } from "@/app/admin/(panel)/clubs/[clubId]/match-player-picker";
import { LeagueLogo } from "@/components/tournaments/league-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Input } from "@/components/ui/input";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { requireAdminClub } from "@/lib/auth/clubs";
import { getAdminClubDetails } from "@/lib/queries/clubs";
import { getClubTeamLogoUrl } from "@/lib/team-logos";
import type { ClubCompetitionRecord, ClubMatchRecord, ClubPlayerRecord, ClubTeamPlayerRecord, ClubTeamRecord } from "@/lib/domain/clubs";

function buildAdminInviteUrl(inviteToken: string) {
  const pathname = `/admin/clubs/invite/${inviteToken}`;
  const appUrl = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) return pathname;
  return new URL(pathname, appUrl.replace(/\/+$/, "")).toString();
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Buenos_Aires"
  }).format(new Date(value));
}

function getStatusLabel(status: string) {
  switch (status) {
    case "active":
      return "Activo";
    case "archived":
      return "Archivado";
    default:
      return "Borrador";
  }
}

function getRosterIds(teamId: string, teamPlayers: ClubTeamPlayerRecord[]) {
  return new Set(
    teamPlayers
      .filter((row) => row.club_team_id === teamId)
      .map((row) => row.club_player_id)
  );
}

function getTeamName(teamId: string, teams: ClubTeamRecord[]) {
  return teams.find((team) => team.id === teamId)?.name ?? "Equipo";
}

function Feedback({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null;
  return (
    <Card>
      {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}
      {success ? <p className="text-sm font-semibold text-emerald-300">{success}</p> : null}
    </Card>
  );
}

function TabLink({
  active,
  children,
  href
}: {
  active: boolean;
  children: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      className={
        active
          ? "shrink-0 rounded-full border border-emerald-400/60 bg-emerald-500/15 px-3 py-1.5 text-sm font-semibold text-emerald-200"
          : "shrink-0 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:bg-slate-800"
      }
      href={href}
    >
      {children}
    </Link>
  );
}

function SummaryTab({
  clubId,
  details
}: {
  clubId: string;
  details: NonNullable<Awaited<ReturnType<typeof getAdminClubDetails>>>;
}) {
  const snapshot = details.publicSnapshot;

  return (
    <div className="space-y-4">
      <section className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardDescription>Equipos</CardDescription>
          <CardTitle className="mt-1 text-3xl">{snapshot.summary.teamCount}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Jugadores</CardDescription>
          <CardTitle className="mt-1 text-3xl">{snapshot.summary.playerCount}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Partidos</CardDescription>
          <CardTitle className="mt-1 text-3xl">{snapshot.summary.playedMatches}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Goles a favor</CardDescription>
          <CardTitle className="mt-1 text-3xl">{snapshot.summary.goalsFor}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Goles en contra</CardDescription>
          <CardTitle className="mt-1 text-3xl">{snapshot.summary.goalsAgainst}</CardTitle>
        </Card>
      </section>

      <Card>
        <CardTitle>Configuracion general</CardTitle>
        <CardDescription className="mt-2">
          Estos datos alimentan la vista publica del club.
        </CardDescription>
        <form action={updateClubAction.bind(null, clubId)} className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="name">
              Nombre
            </label>
            <Input defaultValue={details.club.name} id="name" name="name" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="status">
              Estado
            </label>
            <Select defaultValue={details.club.status} id="status" name="status">
              <option value="draft">Borrador</option>
              <option value="active">Activo</option>
              <option value="archived">Archivado</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="homeVenue">
              Sede habitual
            </label>
            <Input defaultValue={details.club.home_venue ?? ""} id="homeVenue" name="homeVenue" />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <input className="h-4 w-4 accent-emerald-400" defaultChecked={details.club.is_public} name="isPublic" type="checkbox" />
              Visible por URL
            </label>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="description">
              Descripcion
            </label>
            <Textarea defaultValue={details.club.description ?? ""} id="description" name="description" rows={4} />
          </div>
          <div className="md:col-span-2">
            <Button type="submit">Guardar club</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function PlayersTab({ clubId, players }: { clubId: string; players: ClubPlayerRecord[] }) {
  return (
    <div className="space-y-4">
      <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardTitle>Nuevo jugador</CardTitle>
          <form action={addClubPlayerAction.bind(null, clubId)} className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200">Nombre</label>
              <Input name="fullName" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200">Apodo</label>
              <Input name="nickname" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200">Posicion</label>
              <Input name="position" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200">Numero</label>
              <Input min={1} max={99} name="shirtNumber" type="number" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-slate-200">Notas</label>
              <Textarea name="notes" rows={2} />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Agregar jugador</Button>
            </div>
          </form>
        </Card>

        <Card>
          <CardTitle>Carga masiva</CardTitle>
          <form action={bulkAddClubPlayersAction.bind(null, clubId)} className="mt-4 space-y-3">
            <Textarea name="players" placeholder={"Un jugador por linea"} rows={8} />
            <Button type="submit" variant="secondary">
              Cargar jugadores
            </Button>
          </form>
        </Card>
      </section>

      <Card>
        <CardTitle>Pool del club</CardTitle>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <THead>
              <tr>
                <TH>Foto</TH>
                <TH>Jugador</TH>
                <TH>Datos</TH>
                <TH>Estado</TH>
                <TH>Accion</TH>
              </tr>
            </THead>
            <TBody>
              {players.map((player) => (
                <tr key={player.id}>
                  <TD>
                    <PlayerAvatar name={player.full_name} playerId={player.id} size="sm" />
                  </TD>
                  <TD className="font-semibold">{player.full_name}</TD>
                  <TD className="text-slate-300">
                    {[player.nickname, player.position, player.shirt_number ? `#${player.shirt_number}` : null].filter(Boolean).join(" - ") || "Sin detalle"}
                  </TD>
                  <TD>
                    <Badge className={player.active ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-800 text-slate-300"}>
                      {player.active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TD>
                  <TD>
                    <div className="flex flex-col gap-2">
                      <form action={uploadClubPlayerPhotoAction.bind(null, clubId)} className="flex flex-col gap-2" encType="multipart/form-data">
                        <input name="playerId" type="hidden" value={player.id} />
                        <Input accept="image/jpeg,image/png,image/webp" className="max-w-48" name="photo" type="file" />
                        <Button className="h-8 w-fit px-3 text-xs" type="submit" variant="secondary">
                          Subir foto
                        </Button>
                      </form>
                      <form action={toggleClubPlayerAction.bind(null, clubId)}>
                      <input name="playerId" type="hidden" value={player.id} />
                      <input name="active" type="hidden" value={player.active ? "false" : "true"} />
                      <Button className="h-8 px-3 text-xs" type="submit" variant="ghost">
                        {player.active ? "Desactivar" : "Activar"}
                      </Button>
                      </form>
                    </div>
                  </TD>
                </tr>
              ))}
            </TBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function TeamsTab({
  clubId,
  players,
  teamPlayers,
  teams
}: {
  clubId: string;
  players: ClubPlayerRecord[];
  teamPlayers: ClubTeamPlayerRecord[];
  teams: ClubTeamRecord[];
}) {
  const activePlayers = players.filter((player) => player.active);

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Nuevo equipo</CardTitle>
        <CardDescription className="mt-2">Cada club puede tener hasta 5 equipos activos.</CardDescription>
        <form action={addClubTeamAction.bind(null, clubId)} className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200">Nombre</label>
            <Input name="name" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200">Nombre corto</label>
            <Input name="shortName" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-slate-200">Notas</label>
            <Textarea name="notes" rows={2} />
          </div>
          <div className="md:col-span-2">
            <Button type="submit">Agregar equipo</Button>
          </div>
        </form>
      </Card>

      {teams.map((team) => {
        const rosterIds = getRosterIds(team.id, teamPlayers);
        return (
          <Card key={team.id}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <LeagueLogo
                  alt={`Logo de ${team.name}`}
                  src={team.logo_path ? getClubTeamLogoUrl(team.id) : null}
                />
                <div>
                  <CardTitle>{team.name}</CardTitle>
                  <CardDescription className="mt-1">
                    {team.short_name ? `${team.short_name} - ` : ""}{rosterIds.size} jugadores en el equipo
                  </CardDescription>
                  <form action={uploadClubTeamLogoAction.bind(null, clubId)} className="mt-3 flex flex-col gap-2 sm:flex-row" encType="multipart/form-data">
                    <input name="teamId" type="hidden" value={team.id} />
                    <Input accept="image/jpeg,image/png,image/webp,image/svg+xml" className="max-w-60" name="logo" type="file" />
                    <Button className="h-9 w-fit px-3 text-xs" type="submit" variant="secondary">
                      Subir logo
                    </Button>
                  </form>
                </div>
              </div>
              <Badge className={team.active ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-800 text-slate-300"}>
                {team.active ? "Activo" : "Inactivo"}
              </Badge>
            </div>
            <form action={syncClubTeamRosterAction.bind(null, clubId)} className="mt-4 space-y-3">
              <input name="teamId" type="hidden" value={team.id} />
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {activePlayers.map((player) => (
                  <label
                    className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-200"
                    key={player.id}
                  >
                    <input
                      className="h-4 w-4 accent-emerald-400"
                      defaultChecked={rosterIds.has(player.id)}
                      name="playerIds"
                      type="checkbox"
                      value={player.id}
                    />
                    <span>{player.full_name}</span>
                  </label>
                ))}
              </div>
              <Button type="submit" variant="secondary">
                Guardar plantel
              </Button>
            </form>
          </Card>
        );
      })}
    </div>
  );
}

function CompetitionsTab({
  clubId,
  competitions
}: {
  clubId: string;
  competitions: ClubCompetitionRecord[];
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Torneos del club</CardTitle>
        <CardDescription className="mt-2">
          Usa estos torneos para clasificar partidos como Copa Premier, LAFAB o amistosos.
        </CardDescription>
        <form action={addClubCompetitionAction.bind(null, clubId)} className="mt-4 grid gap-3 md:grid-cols-[1fr_1.4fr_auto]">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200">Nombre</label>
            <Input name="name" placeholder="Copa Premier" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200">Notas</label>
            <Input name="notes" placeholder="Opcional" />
          </div>
          <div className="flex items-end">
            <Button type="submit">Agregar</Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardTitle>Actuales</CardTitle>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <THead>
              <tr>
                <TH>Torneo</TH>
                <TH>Slug</TH>
                <TH>Estado</TH>
                <TH>Notas</TH>
              </tr>
            </THead>
            <TBody>
              {competitions.map((competition) => (
                <tr key={competition.id}>
                  <TD className="font-semibold">{competition.name}</TD>
                  <TD className="text-slate-300">{competition.slug}</TD>
                  <TD>
                    <Badge className={competition.active ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-800 text-slate-300"}>
                      {competition.active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TD>
                  <TD className="text-slate-300">{competition.notes || "Sin notas"}</TD>
                </tr>
              ))}
            </TBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function MatchesTab({
  clubId,
  competitions,
  matches,
  players,
  teamPlayers,
  teams
}: {
  clubId: string;
  competitions: ClubCompetitionRecord[];
  matches: ClubMatchRecord[];
  players: ClubPlayerRecord[];
  teamPlayers: ClubTeamPlayerRecord[];
  teams: ClubTeamRecord[];
}) {
  const activeTeams = teams.filter((team) => team.active);
  const activeCompetitions = competitions.filter((competition) => competition.active);
  const competitionById = new Map(competitions.map((competition) => [competition.id, competition]));

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Nuevo partido jugado</CardTitle>
        <CardDescription className="mt-2">
          Los partidos de clubes son siempre 11 vs 11 y quedan publicados por snapshot.
        </CardDescription>
        <form action={addClubMatchAction.bind(null, clubId)} className="mt-4 space-y-5">
          <section className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200">Torneo</label>
              <Select name="competitionId" required>
                <option value="">Donde se jugo</option>
                {activeCompetitions.map((competition) => (
                  <option key={competition.id} value={competition.id}>
                    {competition.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200">Fecha</label>
              <Input name="playedAt" required type="datetime-local" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200">Rival</label>
              <Input name="opponentName" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200">Cancha</label>
              <Input name="venue" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200">Goles a favor</label>
              <Input min={0} name="goalsFor" required type="number" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200">Goles en contra</label>
              <Input min={0} name="goalsAgainst" required type="number" />
            </div>
          </section>

          <MatchPlayerPicker players={players} teamPlayers={teamPlayers} teams={activeTeams} />

          <section>
            <p className="text-sm font-semibold text-slate-200">Invitados</p>
            <div className="mt-2 grid gap-3">
              {Array.from({ length: 6 }, (_, index) => index + 1).map((slot) => (
                <div className="grid gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3 md:grid-cols-[1fr_150px_90px_90px_80px]" key={slot}>
                  <Input name={`guestName:${slot}`} placeholder="Nombre" />
                  <Select defaultValue="starter" name={`guestRole:${slot}`}>
                    <option value="starter">Titular</option>
                    <option value="substitute">Suplente</option>
                  </Select>
                  <Input min={0} name={`guestGoals:${slot}`} placeholder="Goles" type="number" />
                  <Input min={0} name={`guestAssists:${slot}`} placeholder="Asist." type="number" />
                  <label className="flex items-center gap-2 text-sm text-slate-200">
                    <input className="h-4 w-4 accent-emerald-400" name="mvp" type="radio" value={`guest:${slot}`} />
                    Figura
                  </label>
                </div>
              ))}
            </div>
          </section>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200">Notas</label>
            <Textarea name="notes" rows={3} />
          </div>

          <Button type="submit">Guardar partido</Button>
        </form>
      </Card>

      <Card>
        <CardTitle>Historial cargado</CardTitle>
        <div className="mt-4 space-y-3">
          {matches.length ? (
            matches.map((match) => (
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4" key={match.id}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-100">
                      {getTeamName(match.club_team_id, teams)} vs {match.opponent_name}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">{formatDateTime(match.played_at)}{match.venue ? ` - ${match.venue}` : ""}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                      {match.club_competition_id ? competitionById.get(match.club_competition_id)?.name ?? "Torneo" : "Sin torneo"}
                    </p>
                  </div>
                  <p className="text-2xl font-black text-white">
                    {match.goals_for} - {match.goals_against}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400">Todavia no hay partidos cargados.</p>
          )}
        </div>
      </Card>
    </div>
  );
}

function AdminsTab({
  clubId,
  details
}: {
  clubId: string;
  details: NonNullable<Awaited<ReturnType<typeof getAdminClubDetails>>>;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Equipo administrador</CardTitle>
        <CardDescription className="mt-2">Puedes sumar hasta 4 administradores por club.</CardDescription>
        <form action={inviteClubAdminAction.bind(null, clubId)} className="mt-4 flex flex-col gap-3 md:flex-row">
          <Input name="email" placeholder="email@dominio.com" required type="email" />
          <Button type="submit" variant="secondary">
            Invitar admin
          </Button>
        </form>
      </Card>

      <Card>
        <CardTitle>Admins activos</CardTitle>
        <div className="mt-4 space-y-3">
          {details.admins.map((admin) => (
            <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4 sm:flex-row sm:items-center sm:justify-between" key={admin.membershipId}>
              <div>
                <p className="font-semibold text-slate-100">{admin.displayName}</p>
                <p className="mt-1 text-sm text-slate-400">{admin.email ?? "Email no disponible"}</p>
              </div>
              <form action={removeClubAdminAction.bind(null, clubId)}>
                <input name="adminId" type="hidden" value={admin.id} />
                <ConfirmSubmitButton
                  className="h-8 px-3 text-xs"
                  confirmMessage={`Seguro que quieres quitar a ${admin.displayName}?`}
                  label="Quitar"
                  variant="ghost"
                />
              </form>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>Invitaciones pendientes</CardTitle>
        <div className="mt-4 space-y-3">
          {details.pendingInvites.length ? (
            details.pendingInvites.map((invite) => (
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4" key={invite.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-100">{invite.email}</p>
                    <p className="mt-1 break-all text-xs text-slate-400">{buildAdminInviteUrl(invite.inviteToken)}</p>
                  </div>
                  <form action={revokeClubAdminInviteAction.bind(null, clubId)}>
                    <input name="inviteId" type="hidden" value={invite.id} />
                    <Button type="submit" variant="ghost">
                      Cancelar
                    </Button>
                  </form>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400">No hay invitaciones pendientes.</p>
          )}
        </div>
      </Card>
    </div>
  );
}

export default async function AdminClubDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ clubId: string }>;
  searchParams: Promise<{ tab?: string; error?: string; success?: string }>;
}) {
  const [{ clubId }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  await requireAdminClub(clubId);
  const details = await getAdminClubDetails(clubId);

  if (!details) notFound();

  const selectedTab = resolvedSearchParams.tab ?? "summary";
  const tabs = [
    { key: "summary", label: "Resumen" },
    { key: "players", label: "Jugadores" },
    { key: "teams", label: "Equipos" },
    { key: "competitions", label: "Torneos" },
    { key: "matches", label: "Partidos" },
    { key: "admins", label: "Admins" }
  ];

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{details.club.name}</CardTitle>
              <Badge className="border border-emerald-500/40 bg-emerald-500/15 text-emerald-200">
                {getStatusLabel(details.club.status)}
              </Badge>
            </div>
            <CardDescription className="mt-2">
              Club oculto: no aparece en navegacion, precios ni ayuda.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="text-sm font-semibold text-slate-300 hover:underline" href="/admin/clubs">
              Volver
            </Link>
            <Link className="text-sm font-semibold text-sky-300 hover:underline" href={`/clubs/${details.club.slug}`}>
              Ver publica
            </Link>
          </div>
        </div>
      </Card>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/75 px-4 py-3">
        <nav className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <TabLink active={selectedTab === tab.key} href={`/admin/clubs/${clubId}?tab=${tab.key}`} key={tab.key}>
              {tab.label}
            </TabLink>
          ))}
        </nav>
      </section>

      <Feedback error={resolvedSearchParams.error} success={resolvedSearchParams.success} />

      {selectedTab === "summary" ? <SummaryTab clubId={clubId} details={details} /> : null}
      {selectedTab === "players" ? <PlayersTab clubId={clubId} players={details.players} /> : null}
      {selectedTab === "teams" ? (
        <TeamsTab clubId={clubId} players={details.players} teamPlayers={details.teamPlayers} teams={details.teams} />
      ) : null}
      {selectedTab === "competitions" ? (
        <CompetitionsTab clubId={clubId} competitions={details.competitions} />
      ) : null}
      {selectedTab === "matches" ? (
        <MatchesTab
          clubId={clubId}
          competitions={details.competitions}
          matches={details.matches}
          players={details.players}
          teamPlayers={details.teamPlayers}
          teams={details.teams}
        />
      ) : null}
      {selectedTab === "admins" ? <AdminsTab clubId={clubId} details={details} /> : null}
    </div>
  );
}
