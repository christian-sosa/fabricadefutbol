import Link from "next/link";
import { notFound } from "next/navigation";

import {
  addClubCompetitionAction,
  addClubMatchAction,
  addClubPlayerAction,
  addClubTeamAction,
  addClubTeamPlayersAction,
  bulkAddClubPlayersAction,
  inviteClubAdminAction,
  removeClubTeamPlayerAction,
  removeClubAdminAction,
  revokeClubAdminInviteAction,
  toggleClubCompetitionAction,
  toggleClubPlayerAction,
  updateClubAction,
  uploadClubLogoAction,
  uploadClubPlayerPhotoAction,
} from "@/app/admin/(panel)/clubs/[clubId]/actions";
import { MatchDateTimeFields } from "@/components/admin/match-date-time-fields";
import { MatchGuestFields } from "@/app/admin/(panel)/clubs/[clubId]/match-guest-fields";
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
import { getCurrentMatchDateInput } from "@/lib/match-datetime";
import {
  CLUB_PLAYER_POSITIONS,
  buildClubTeamRosterOptions,
  filterClubPlayersForRosterManagement,
  formatClubPlayerPosition,
  normalizeClubPlayerPosition,
  type ClubCompetitionRecord,
  type ClubMatchRecord,
  type ClubPlayerPosition,
  type ClubPlayerRecord,
  type ClubTeamPlayerRecord,
  type ClubTeamRecord
} from "@/lib/domain/clubs";
import { getAdminClubDetails } from "@/lib/queries/clubs";
import { getClubLogoUrl } from "@/lib/team-logos";

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

function getTeamName(teamId: string, teams: ClubTeamRecord[]) {
  return teams.find((team) => team.id === teamId)?.name ?? "Equipo";
}

function formatPlayerMeta(player: ClubPlayerRecord) {
  return [
    player.nickname,
    formatClubPlayerPosition(player.position),
    player.shirt_number ? `#${player.shirt_number}` : null,
    player.notes
  ].filter(Boolean).join(" - ");
}

type TeamRosterFilters = {
  availablePosition: ClubPlayerPosition | null;
  availableSearch: string;
  rosterPosition: ClubPlayerPosition | null;
  rosterSearch: string;
};

function buildTeamRosterPath({
  availablePosition,
  availableSearch,
  clubId,
  rosterPosition,
  rosterSearch,
  teamId
}: TeamRosterFilters & {
  clubId: string;
  teamId: string;
}) {
  const searchParams = new URLSearchParams({
    tab: "teams",
    teamId
  });
  if (rosterPosition) searchParams.set("rosterPosition", rosterPosition);
  if (availablePosition) searchParams.set("availablePosition", availablePosition);
  if (rosterSearch.trim()) searchParams.set("rosterSearch", rosterSearch.trim());
  if (availableSearch.trim()) searchParams.set("availableSearch", availableSearch.trim());
  return `/admin/clubs/${clubId}?${searchParams.toString()}`;
}

function PositionFilterLinks({
  clubId,
  filters,
  selectedPosition,
  target,
  teamId
}: {
  clubId: string;
  filters: TeamRosterFilters;
  selectedPosition: ClubPlayerPosition | null;
  target: "available" | "roster";
  teamId: string;
}) {
  const buildHref = (position: ClubPlayerPosition | null) =>
    buildTeamRosterPath({
      ...filters,
      availablePosition: target === "available" ? position : filters.availablePosition,
      clubId,
      rosterPosition: target === "roster" ? position : filters.rosterPosition,
      teamId
    });

  return (
    <div className="flex flex-wrap gap-2">
      <Link
        className={
          selectedPosition
            ? "rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300"
            : "rounded-full border border-emerald-400/60 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200"
        }
        href={buildHref(null)}
      >
        Todos
      </Link>
      {CLUB_PLAYER_POSITIONS.map((position) => (
        <Link
          className={
            selectedPosition === position
              ? "rounded-full border border-emerald-400/60 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200"
              : "rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300"
          }
          href={buildHref(position)}
          key={position}
        >
          {formatClubPlayerPosition(position)}
        </Link>
      ))}
    </div>
  );
}

function RosterSearchForm({
  fieldName,
  filters,
  placeholder,
  teamId
}: {
  fieldName: "availableSearch" | "rosterSearch";
  filters: TeamRosterFilters;
  placeholder: string;
  teamId: string;
}) {
  return (
    <form className="flex flex-col gap-2 sm:flex-row" method="get">
      <input name="tab" type="hidden" value="teams" />
      <input name="teamId" type="hidden" value={teamId} />
      {filters.rosterPosition ? <input name="rosterPosition" type="hidden" value={filters.rosterPosition} /> : null}
      {filters.availablePosition ? <input name="availablePosition" type="hidden" value={filters.availablePosition} /> : null}
      {fieldName === "availableSearch" && filters.rosterSearch.trim() ? (
        <input name="rosterSearch" type="hidden" value={filters.rosterSearch.trim()} />
      ) : null}
      {fieldName === "rosterSearch" && filters.availableSearch.trim() ? (
        <input name="availableSearch" type="hidden" value={filters.availableSearch.trim()} />
      ) : null}
      <Input
        defaultValue={fieldName === "availableSearch" ? filters.availableSearch : filters.rosterSearch}
        name={fieldName}
        placeholder={placeholder}
      />
      <Button className="sm:w-fit" type="submit" variant="secondary">
        Buscar
      </Button>
    </form>
  );
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
      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
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
        <CardTitle>Escudo del club</CardTitle>
        <CardDescription className="mt-2">
          Este escudo lo heredan todos los equipos del club.
        </CardDescription>
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3 sm:flex-row sm:items-center">
          <LeagueLogo
            alt={`Escudo de ${details.club.name}`}
            size={64}
            src={getClubLogoUrl(clubId)}
          />
          <form action={uploadClubLogoAction.bind(null, clubId)} className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <Input accept="image/jpeg,image/png,image/webp,image/svg+xml" className="max-w-72" name="logo" type="file" />
            <Button className="w-fit" type="submit" variant="secondary">
              Guardar escudo
            </Button>
          </form>
        </div>
        <p className="mt-2 text-xs text-slate-500">JPG, PNG, WEBP o SVG.</p>
      </Card>

      <Card>
        <CardTitle>Configuracion general</CardTitle>
        <CardDescription className="mt-2">
          Estos datos alimentan la vista por URL privada del club. Por ahora solo la pueden abrir el super admin y los admins del club.
        </CardDescription>
        <form action={updateClubAction.bind(null, clubId)} className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="name">
              Nombre
            </label>
            <Input defaultValue={details.club.name} id="name" name="name" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="homeVenue">
              Sede habitual
            </label>
            <Input defaultValue={details.club.home_venue ?? ""} id="homeVenue" name="homeVenue" />
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

function PlayersTab({
  clubId,
  players,
  selectedPosition
}: {
  clubId: string;
  players: ClubPlayerRecord[];
  selectedPosition: ClubPlayerPosition | null;
}) {
  const filteredPlayers = selectedPosition
    ? players.filter((player) => player.position === selectedPosition)
    : players;

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
              <Select name="position">
                <option value="">Sin posicion</option>
                {CLUB_PLAYER_POSITIONS.map((position) => (
                  <option key={position} value={position}>
                    {formatClubPlayerPosition(position)}
                  </option>
                ))}
              </Select>
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
          <CardDescription className="mt-2">
            Cada salto de linea crea otro jugador. Dentro de cada linea, separa los datos con <span className="font-mono">;</span>.
          </CardDescription>
          <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">
            <p className="font-semibold text-slate-100">Formato</p>
            <p className="mt-1 text-xs text-slate-400">Nombre;Apodo;Posicion;Numero;Nota</p>
            <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-slate-400">
{`Juan Perez;Juani;Delantero;9;Zurdo
Nicolas Gomez;Nico;Arquero;1;
Martin Alvarez`}
            </pre>
            <p className="mt-2 text-xs text-slate-500">
              El salto de linea cambia de jugador; el punto y coma separa campos. Posicion solo puede ser Arquero, Defensor, Volante o Delantero.
            </p>
          </div>
          <form action={bulkAddClubPlayersAction.bind(null, clubId)} className="mt-4 space-y-3">
            <Textarea
              name="players"
              placeholder={"Juan Perez;Juani;Delantero;9;Zurdo\nNicolas Gomez;Nico;Arquero;1;\nMartin Alvarez"}
              rows={8}
            />
            <Button type="submit" variant="secondary">
              Cargar jugadores
            </Button>
          </form>
        </Card>
      </section>

      <Card>
        <CardTitle>Pool del club</CardTitle>
        <CardDescription className="mt-2">
          Desactivar no borra al jugador: lo deja fuera del pool activo y puedes volver a activarlo.
        </CardDescription>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            className={
              selectedPosition
                ? "rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-semibold text-slate-300"
                : "rounded-full border border-emerald-400/60 bg-emerald-500/15 px-3 py-1.5 text-sm font-semibold text-emerald-200"
            }
            href={`/admin/clubs/${clubId}?tab=players`}
          >
            Todos
          </Link>
          {CLUB_PLAYER_POSITIONS.map((position) => (
            <Link
              className={
                selectedPosition === position
                  ? "rounded-full border border-emerald-400/60 bg-emerald-500/15 px-3 py-1.5 text-sm font-semibold text-emerald-200"
                  : "rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-semibold text-slate-300"
              }
              href={`/admin/clubs/${clubId}?tab=players&position=${position}`}
              key={position}
            >
              {formatClubPlayerPosition(position)}
            </Link>
          ))}
        </div>
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
              {filteredPlayers.map((player) => (
                <tr key={player.id}>
                  <TD>
                    <PlayerAvatar name={player.full_name} playerId={player.id} size="sm" />
                  </TD>
                  <TD className="font-semibold">{player.full_name}</TD>
                  <TD className="text-slate-300">
                    {formatPlayerMeta(player) || "Sin detalle"}
                  </TD>
                  <TD>
                    <Badge className={player.active ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-800 text-slate-300"}>
                      {player.active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TD>
                  <TD>
                    <div className="flex flex-col gap-2">
                      <form action={uploadClubPlayerPhotoAction.bind(null, clubId)} className="flex flex-col gap-2">
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
  return (
    <div className="space-y-4">
      <details className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <div>
            <CardTitle>Equipos</CardTitle>
            <CardDescription className="mt-1">Cada club puede tener hasta 5 equipos activos.</CardDescription>
          </div>
          <span className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white">
            Nuevo equipo
          </span>
        </summary>
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
      </details>

      <section className="grid gap-3 lg:grid-cols-2">
        {teams.map((team) => {
          const rosterOptions = buildClubTeamRosterOptions({
            players,
            teamId: team.id,
            teamPlayers
          });
          return (
            <Card key={team.id}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <LeagueLogo
                    alt={`Escudo de ${team.name}`}
                    src={getClubLogoUrl(clubId)}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="truncate">{team.name}</CardTitle>
                      <Badge className={team.active ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-800 text-slate-300"}>
                        {team.active ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                    <CardDescription className="mt-1">
                      {team.short_name ? `${team.short_name} - ` : ""}{rosterOptions.rosterPlayers.length} jugadores. Usa el escudo del club.
                    </CardDescription>
                  </div>
                </div>
                <Link
                  className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                  href={`/admin/clubs/${clubId}?tab=teams&teamId=${team.id}`}
                >
                  Gestionar plantel
                </Link>
              </div>
            </Card>
          );
        })}
      </section>
    </div>
  );
}

function TeamRosterTab({
  clubId,
  filters,
  players,
  team,
  teamPlayers
}: {
  clubId: string;
  filters: TeamRosterFilters;
  players: ClubPlayerRecord[];
  team: ClubTeamRecord;
  teamPlayers: ClubTeamPlayerRecord[];
}) {
  const rosterOptions = buildClubTeamRosterOptions({
    players,
    teamId: team.id,
    teamPlayers
  });
  const filteredRosterPlayers = filterClubPlayersForRosterManagement(rosterOptions.rosterPlayers, {
    position: filters.rosterPosition,
    search: filters.rosterSearch
  });
  const filteredAvailablePlayers = filterClubPlayersForRosterManagement(rosterOptions.availablePlayers, {
    position: filters.availablePosition,
    search: filters.availableSearch
  });
  const hasAvailablePlayers = filteredAvailablePlayers.length > 0;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <LeagueLogo
              alt={`Escudo de ${team.name}`}
              src={getClubLogoUrl(clubId)}
            />
            <div>
              <CardTitle>{team.name}</CardTitle>
              <CardDescription className="mt-1">
                {team.short_name ? `${team.short_name} - ` : ""}{rosterOptions.rosterPlayers.length} jugadores en el plantel.
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className={team.active ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-800 text-slate-300"}>
              {team.active ? "Activo" : "Inactivo"}
            </Badge>
            <Link
              className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-semibold text-slate-100 transition hover:border-emerald-400/60 hover:text-emerald-300"
              href={`/admin/clubs/${clubId}?tab=teams`}
            >
              Volver a equipos
            </Link>
          </div>
        </div>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Plantel actual</CardTitle>
              <CardDescription className="mt-1">
                Quita jugadores solo desde el plantel de este equipo.
              </CardDescription>
            </div>
            <p className="text-sm font-semibold text-slate-400">
              {filteredRosterPlayers.length}/{rosterOptions.rosterPlayers.length}
            </p>
          </div>
          <div className="mt-4 space-y-3">
            <RosterSearchForm
              fieldName="rosterSearch"
              filters={filters}
              placeholder="Buscar en este plantel"
              teamId={team.id}
            />
            <PositionFilterLinks
              clubId={clubId}
              filters={filters}
              selectedPosition={filters.rosterPosition}
              target="roster"
              teamId={team.id}
            />
          </div>
          <div className="mt-4 max-h-[560px] space-y-2 overflow-y-auto pr-1">
            {filteredRosterPlayers.length ? (
              filteredRosterPlayers.map((player) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2"
                  key={player.id}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-100">{player.full_name}</p>
                    <p className="truncate text-xs text-slate-400">{formatPlayerMeta(player) || "Sin detalle"}</p>
                  </div>
                  <form action={removeClubTeamPlayerAction.bind(null, clubId)}>
                    <input name="teamId" type="hidden" value={team.id} />
                    <input name="playerId" type="hidden" value={player.id} />
                    <Button className="h-8 px-3 text-xs" type="submit" variant="ghost">
                      Quitar
                    </Button>
                  </form>
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-slate-800 bg-slate-950/50 px-3 py-2 text-sm text-slate-400">
                No hay jugadores que coincidan con el filtro.
              </p>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Agregar jugadores</CardTitle>
              <CardDescription className="mt-1">
                Solo aparecen jugadores activos del club que todavia no estan en este equipo.
              </CardDescription>
            </div>
            <p className="text-sm font-semibold text-slate-400">
              {filteredAvailablePlayers.length}/{rosterOptions.availablePlayers.length}
            </p>
          </div>
          <div className="mt-4 space-y-3">
            <RosterSearchForm
              fieldName="availableSearch"
              filters={filters}
              placeholder="Buscar para agregar"
              teamId={team.id}
            />
            <PositionFilterLinks
              clubId={clubId}
              filters={filters}
              selectedPosition={filters.availablePosition}
              target="available"
              teamId={team.id}
            />
          </div>
          <form action={addClubTeamPlayersAction.bind(null, clubId)} className="mt-4 space-y-4">
            <input name="teamId" type="hidden" value={team.id} />
            <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
              {filteredAvailablePlayers.length ? (
                filteredAvailablePlayers.map((player) => (
                  <label
                    className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-200"
                    key={player.id}
                  >
                    <input
                      className="mt-0.5 h-4 w-4 accent-emerald-400"
                      name="playerIds"
                      type="checkbox"
                      value={player.id}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{player.full_name}</span>
                      <span className="block truncate text-xs text-slate-500">{formatPlayerMeta(player) || "Sin detalle"}</span>
                    </span>
                  </label>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-slate-800 bg-slate-950/50 px-3 py-2 text-sm text-slate-400">
                  No hay jugadores disponibles que coincidan con el filtro.
                </p>
              )}
            </div>
            <Button disabled={!hasAvailablePlayers} type="submit" variant="secondary">
              Agregar seleccionados
            </Button>
          </form>
        </Card>
      </section>
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
      <details className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <div>
            <CardTitle>Torneos del club</CardTitle>
            <CardDescription className="mt-1">
              Usa estos torneos para clasificar partidos como Copa Premier, LAFAB o amistosos.
            </CardDescription>
          </div>
          <span className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white">
            Nuevo torneo
          </span>
        </summary>
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
      </details>

      <Card>
        <CardTitle>Actuales</CardTitle>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <THead>
              <tr>
                <TH>Torneo</TH>
                <TH>Notas</TH>
                <TH>Accion</TH>
              </tr>
            </THead>
            <TBody>
              {competitions.map((competition) => (
                <tr key={competition.id}>
                  <TD>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{competition.name}</span>
                      {!competition.active ? (
                        <Badge className="bg-slate-800 text-slate-300">Inactivo</Badge>
                      ) : null}
                    </div>
                  </TD>
                  <TD className="text-slate-300">{competition.notes?.trim() || "-"}</TD>
                  <TD>
                    <form action={toggleClubCompetitionAction.bind(null, clubId)}>
                      <input name="competitionId" type="hidden" value={competition.id} />
                      <input name="active" type="hidden" value={competition.active ? "false" : "true"} />
                      {competition.active ? (
                        <ConfirmSubmitButton
                          className="h-8 px-3 text-xs"
                          confirmMessage={`Seguro que quieres dar de baja ${competition.name}? No se borra el historial, pero no aparecera para nuevos partidos.`}
                          label="Dar de baja"
                          variant="ghost"
                        />
                      ) : (
                        <Button className="h-8 px-3 text-xs" type="submit" variant="secondary">
                          Reactivar
                        </Button>
                      )}
                    </form>
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
  const defaultPlayedDate = getCurrentMatchDateInput();

  return (
    <div className="space-y-4">
      <details className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <div>
            <CardTitle>Nuevo partido jugado</CardTitle>
            <CardDescription className="mt-1">
              Carga resultado, jugadores, invitados y estadisticas del partido.
            </CardDescription>
          </div>
          <span className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white">
            Agregar partido
          </span>
        </summary>
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
            <MatchDateTimeFields
              dateName="playedDate"
              defaultDate={defaultPlayedDate}
              requiredTime
              timeName="playedTime"
            />
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

          <MatchGuestFields />

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200">Notas</label>
            <Textarea name="notes" rows={3} />
          </div>

          <Button type="submit">Guardar partido</Button>
        </form>
      </details>

      <details className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <div>
            <CardTitle>Partidos cargados</CardTitle>
            <CardDescription className="mt-1">
              Revisa los partidos existentes antes de hacer cambios.
            </CardDescription>
          </div>
          <span className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200">
            Editar partidos
          </span>
        </summary>
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
      </details>
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
  searchParams: Promise<{
    availablePosition?: string;
    availableSearch?: string;
    error?: string;
    position?: string;
    rosterPosition?: string;
    rosterSearch?: string;
    success?: string;
    tab?: string;
    teamId?: string;
  }>;
}) {
  const [{ clubId }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  await requireAdminClub(clubId);
  const details = await getAdminClubDetails(clubId);

  if (!details) notFound();

  const selectedTab = resolvedSearchParams.tab ?? "summary";
  const selectedPosition = normalizeClubPlayerPosition(resolvedSearchParams.position);
  const selectedTeam = selectedTab === "teams" && resolvedSearchParams.teamId
    ? details.teams.find((team) => team.id === resolvedSearchParams.teamId)
    : null;
  if (selectedTab === "teams" && resolvedSearchParams.teamId && !selectedTeam) notFound();
  const teamRosterFilters: TeamRosterFilters = {
    availablePosition: normalizeClubPlayerPosition(resolvedSearchParams.availablePosition),
    availableSearch: resolvedSearchParams.availableSearch ?? "",
    rosterPosition: normalizeClubPlayerPosition(resolvedSearchParams.rosterPosition),
    rosterSearch: resolvedSearchParams.rosterSearch ?? ""
  };
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
            <CardTitle>{details.club.name}</CardTitle>
            <CardDescription className="mt-2">
              Gestion privada del club para admins autorizados.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="text-sm font-semibold text-slate-300 hover:underline" href="/admin">
              Menu admin
            </Link>
            <Link className="text-sm font-semibold text-sky-300 hover:underline" href={`/clubs/${details.club.slug}`}>
              Vista del club
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
      {selectedTab === "players" ? (
        <PlayersTab clubId={clubId} players={details.players} selectedPosition={selectedPosition} />
      ) : null}
      {selectedTab === "teams" && selectedTeam ? (
        <TeamRosterTab
          clubId={clubId}
          filters={teamRosterFilters}
          players={details.players}
          team={selectedTeam}
          teamPlayers={details.teamPlayers}
        />
      ) : null}
      {selectedTab === "teams" && !selectedTeam ? (
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
