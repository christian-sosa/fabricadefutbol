import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteLeagueAction } from "@/app/admin/(panel)/tournaments/actions";
import {
  addLeagueTeamAction,
  createCompetitionAction,
  deleteLeagueTeamAction,
  inviteLeagueAdminAction,
  removeLeagueAdminAction,
  revokeLeagueAdminInviteAction,
  updateLeagueAction,
  updateLeagueTeamAction,
  uploadLeagueLogoAction
} from "@/app/admin/(panel)/tournaments/[id]/actions";
import { LeagueLogo } from "@/components/tournaments/league-logo";
import { TOURNAMENT_STATUS_LABELS, TournamentStatusBadge } from "@/components/tournaments/tournament-badges";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { requireAdminLeague } from "@/lib/auth/tournaments";
import { getAdminLeagueDetails } from "@/lib/queries/tournaments";

function buildAdminInviteUrl(inviteToken: string) {
  const pathname = `/admin/tournaments/invite/${inviteToken}`;
  const appUrl = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) return pathname;
  return new URL(pathname, appUrl.replace(/\/+$/, "")).toString();
}

function getCompetitionTypeLabel(type: "league" | "cup" | "league_and_cup") {
  switch (type) {
    case "cup":
      return "Copa";
    case "league_and_cup":
      return "Liga + copa";
    default:
      return "Liga";
  }
}

export default async function AdminLeagueDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; error?: string; success?: string }>;
}) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  await requireAdminLeague(id);
  const details = await getAdminLeagueDetails(id);

  if (!details) notFound();

  const selectedTab = resolvedSearchParams.tab ?? "summary";

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <LeagueLogo alt={`Logo de ${details.league.name}`} size={88} src={details.league.logoUrl} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{details.league.name}</CardTitle>
                <TournamentStatusBadge status={details.league.status} />
              </div>
              <CardDescription className="mt-2">
                Gestiona la liga, sus equipos maestros, las competencias que cuelgan de ella y el equipo administrador.
              </CardDescription>
              <div className="mt-3 space-y-1 text-xs text-slate-400">
                <p>
                  {details.league.isPublic
                    ? "Marcada como publica. Se muestra afuera solo si esta activa o finalizada."
                    : "Solo visible en admin por ahora."}
                </p>
                <p>{details.league.venueName ? `Sede: ${details.league.venueName}` : "Sede general pendiente"}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link className="text-sm font-semibold text-slate-300 hover:underline" href="/admin/tournaments">
              Volver a ligas
            </Link>
            <Link className="text-sm font-semibold text-emerald-300 hover:underline" href={`/tournaments/${details.league.slug}`}>
              Ver publica
            </Link>
            <form action={deleteLeagueAction}>
              <input name="leagueId" type="hidden" value={id} />
              <ConfirmSubmitButton
                className="h-8 px-3 text-xs"
                confirmMessage={`Seguro que quieres borrar ${details.league.name}?`}
                label="Borrar"
                variant="ghost"
              />
            </form>
          </div>
        </div>
        {resolvedSearchParams.error ? <p className="mt-3 text-sm font-semibold text-danger">{resolvedSearchParams.error}</p> : null}
        {resolvedSearchParams.success ? <p className="mt-3 text-sm font-semibold text-emerald-300">{resolvedSearchParams.success}</p> : null}
      </Card>

      {selectedTab === "summary" ? (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardDescription>Equipos maestros</CardDescription>
              <CardTitle className="mt-1 text-3xl">{details.league.teamCount}</CardTitle>
            </Card>
            <Card>
              <CardDescription>Competencias</CardDescription>
              <CardTitle className="mt-1 text-3xl">{details.league.competitionCount}</CardTitle>
            </Card>
            <Card>
              <CardDescription>Admins activos</CardDescription>
              <CardTitle className="mt-1 text-3xl">{details.leagueAdmins.admins.length}</CardTitle>
            </Card>
            <Card>
              <CardDescription>Invitaciones pendientes</CardDescription>
              <CardTitle className="mt-1 text-3xl">{details.leagueAdmins.pendingInvites.length}</CardTitle>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardTitle>Configuracion general</CardTitle>
              <CardDescription className="mt-2">
                La liga define la sede base, la visibilidad publica y el contexto comun para todas sus competencias.
              </CardDescription>
              <form action={updateLeagueAction.bind(null, id)} className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="name">
                    Nombre
                  </label>
                  <Input defaultValue={details.league.name} id="name" name="name" required />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="status">
                    Estado
                  </label>
                  <Select defaultValue={details.league.status} id="status" name="status">
                    {(["draft", "active", "finished", "archived"] as const).map((status) => (
                      <option key={status} value={status}>
                        {TOURNAMENT_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="venueName">
                    Sede
                  </label>
                  <Input defaultValue={details.league.venueName ?? ""} id="venueName" name="venueName" placeholder="Ej: Complejo LAFAB" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="locationNotes">
                    Notas de ubicacion
                  </label>
                  <Input defaultValue={details.league.locationNotes ?? ""} id="locationNotes" name="locationNotes" placeholder="Ej: Caballito, CABA" />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="description">
                    Descripcion
                  </label>
                  <Textarea defaultValue={details.league.description ?? ""} id="description" name="description" rows={4} />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-slate-200">
                    <input className="h-4 w-4 accent-emerald-400" defaultChecked={details.league.isPublic} name="isPublic" type="checkbox" />
                    Liga publica
                  </label>
                </div>
                <div className="md:col-span-2">
                  <Button type="submit">Guardar resumen</Button>
                </div>
              </form>
            </Card>

            <Card>
              <CardTitle>Logo de la liga</CardTitle>
              <CardDescription className="mt-2">
                Se usa en home, en /tournaments y en la ficha publica de la liga. Si no subes nada, mostramos un placeholder.
              </CardDescription>
              <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start">
                <LeagueLogo alt={`Logo de ${details.league.name}`} size={120} src={details.league.logoUrl} />
                <form
                  action={uploadLeagueLogoAction.bind(null, id)}
                  className="flex-1 space-y-3"
                  encType="multipart/form-data"
                >
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="logo">
                      Archivo
                    </label>
                    <Input
                      accept=".jpg,.jpeg,.png,.webp,.svg,image/jpeg,image/png,image/webp,image/svg+xml"
                      id="logo"
                      name="logo"
                      required
                      type="file"
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      Recomendado: fondo transparente o cuadrado. Lo optimizamos a WEBP automaticamente.
                    </p>
                  </div>
                  <Button type="submit" variant="secondary">
                    Guardar logo
                  </Button>
                </form>
              </div>
            </Card>
          </section>
        </>
      ) : null}

      {selectedTab === "teams" ? (
        <div className="space-y-4">
          <Card>
            <CardTitle>Nuevo equipo maestro</CardTitle>
            <CardDescription className="mt-2">
              Aqui cargas el catalogo base de equipos de la liga. Luego eliges cuales se inscriben en cada competencia.
            </CardDescription>
            <form action={addLeagueTeamAction.bind(null, id)} className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200">Nombre</label>
                <Input name="name" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200">Nombre corto</label>
                <Input maxLength={20} name="shortName" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-slate-200">Notas</label>
                <Textarea name="notes" rows={3} />
              </div>
              <div className="md:col-span-2">
                <Button type="submit">Agregar equipo</Button>
              </div>
            </form>
          </Card>

          <div className="space-y-4">
            {details.leagueTeams.length ? (
              details.leagueTeams.map((team) => (
                <Card key={team.id}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <CardTitle>{team.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {team.shortName ? `${team.shortName} · ` : ""}catalogo base de la liga
                      </CardDescription>
                    </div>
                    <form action={deleteLeagueTeamAction.bind(null, id)}>
                      <input name="teamId" type="hidden" value={team.id} />
                      <ConfirmSubmitButton
                        className="h-8 px-3 text-xs"
                        confirmMessage={`Seguro que quieres borrar ${team.name}?`}
                        label="Borrar"
                        variant="ghost"
                      />
                    </form>
                  </div>

                  <form action={updateLeagueTeamAction.bind(null, id)} className="mt-4 grid gap-3 md:grid-cols-2">
                    <input name="teamId" type="hidden" value={team.id} />
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-200">Nombre</label>
                      <Input defaultValue={team.name} name="name" required />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-200">Nombre corto</label>
                      <Input defaultValue={team.shortName ?? ""} name="shortName" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-sm font-semibold text-slate-200">Notas</label>
                      <Textarea defaultValue={team.notes ?? ""} name="notes" rows={3} />
                    </div>
                    <div className="md:col-span-2">
                      <Button type="submit" variant="secondary">
                        Guardar equipo
                      </Button>
                    </div>
                  </form>
                </Card>
              ))
            ) : (
              <Card>
                <CardDescription>Todavia no hay equipos cargados para esta liga.</CardDescription>
              </Card>
            )}
          </div>
        </div>
      ) : null}

      {selectedTab === "competitions" ? (
        <div className="space-y-4">
          <Card>
            <CardTitle>Nueva competencia</CardTitle>
            <CardDescription className="mt-2">
              Crea una competencia con sus datos base, el formato y los equipos inscriptos iniciales. Luego podras sumar planteles, capitanes y fixture.
            </CardDescription>
            <form action={createCompetitionAction.bind(null, id)} className="mt-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-200">Nombre</label>
                  <Input name="name" placeholder="Ej: Viernes A" required />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-200">Temporada</label>
                  <Input defaultValue={String(new Date().getFullYear())} name="seasonLabel" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-200">Formato</label>
                  <Select defaultValue="league" name="type">
                    <option value="league">Liga</option>
                    <option value="cup">Copa</option>
                    <option value="league_and_cup">Liga + copa</option>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-200">Playoff</label>
                  <Select defaultValue="" name="playoffSize">
                    <option value="">No aplica</option>
                    <option value="4">Top 4</option>
                    <option value="8">Top 8</option>
                  </Select>
                  <p className="mt-1 text-xs text-slate-500">Solo se usa en competencias Liga + copa.</p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-200">Sede especifica</label>
                  <Input name="venueOverride" placeholder="Opcional" />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-slate-200">
                    <input className="h-4 w-4 accent-emerald-400" name="isPublic" type="checkbox" />
                    Competencia publica
                  </label>
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-semibold text-slate-200">Descripcion</label>
                  <Textarea name="description" rows={3} />
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-200">Equipos inscriptos</p>
                <p className="mt-1 text-xs text-slate-400">
                  Selecciona los equipos que arrancan esta competencia. Si prefieres, puedes dejarla vacia y definirlos despues.
                </p>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {details.leagueTeams.map((team) => (
                    <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3 text-sm text-slate-200" key={team.id}>
                      <input className="h-4 w-4 accent-emerald-400" name="leagueTeamIds" type="checkbox" value={team.id} />
                      <span>
                        {team.name}
                        {team.shortName ? ` (${team.shortName})` : ""}
                      </span>
                    </label>
                  ))}
                  {!details.leagueTeams.length ? (
                    <p className="text-sm text-slate-400">Primero necesitas cargar equipos maestros en la liga.</p>
                  ) : null}
                </div>
              </div>

              <Button type="submit">Crear competencia</Button>
            </form>
          </Card>

          <div className="space-y-3">
            {details.competitions.length ? (
              details.competitions.map((competition) => (
                <Card key={competition.id}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle>{competition.name}</CardTitle>
                        <TournamentStatusBadge status={competition.status} />
                      </div>
                      <CardDescription className="mt-1">
                        {getCompetitionTypeLabel(competition.type)} · Temporada {competition.seasonLabel} · {competition.teamCount} inscriptos
                      </CardDescription>
                      <div className="mt-1 space-y-1 text-xs text-slate-400">
                        <p>{competition.venueOverride ? `Sede: ${competition.venueOverride}` : "Usa la sede general de la liga"}</p>
                        {competition.playoffSize ? <p>Playoff configurado: top {competition.playoffSize}</p> : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Link
                        className="text-sm font-semibold text-emerald-300 hover:underline"
                        href={`/admin/tournaments/${id}/competitions/${competition.id}`}
                      >
                        Gestionar
                      </Link>
                      <Link
                        className="text-sm font-semibold text-sky-300 hover:underline"
                        href={`/tournaments/${details.league.slug}/${competition.slug}`}
                      >
                        Ver publica
                      </Link>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <Card>
                <CardDescription>Todavia no hay competencias creadas dentro de esta liga.</CardDescription>
              </Card>
            )}
          </div>
        </div>
      ) : null}

      {selectedTab === "admins" ? (
        <div className="space-y-4">
          <Card>
            <CardTitle>Equipo administrador</CardTitle>
            <CardDescription className="mt-2">
              Puedes sumar hasta 4 administradores por liga. Todos tendran acceso a las competencias que cuelgan de ella.
            </CardDescription>

            <form action={inviteLeagueAdminAction.bind(null, id)} className="mt-4 flex flex-col gap-3 md:flex-row">
              <Input name="email" placeholder="email@dominio.com" required type="email" />
              <Button type="submit" variant="secondary">
                Invitar admin
              </Button>
            </form>
          </Card>

          <section className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardTitle>Admins activos</CardTitle>
              <div className="mt-4 space-y-2">
                {details.leagueAdmins.admins.length ? (
                  details.leagueAdmins.admins.map((member) => (
                    <div className="flex items-start justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm" key={member.membershipId}>
                      <div>
                        <p className="font-semibold text-slate-100">{member.email ?? member.displayName}</p>
                        <p className="text-xs text-slate-400">
                          {member.role === "owner" ? "Owner" : "Editor"} desde {new Date(member.createdAt).toLocaleDateString("es-AR")}
                        </p>
                      </div>
                      <form action={removeLeagueAdminAction.bind(null, id)}>
                        <input name="adminId" type="hidden" value={member.id} />
                        <ConfirmSubmitButton
                          className="h-7 min-w-7 px-2 text-xs"
                          confirmMessage={`Seguro que quieres quitar a ${member.email ?? member.displayName} como admin de ${details.league.name}?`}
                          label="Quitar"
                          variant="ghost"
                        />
                      </form>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">No hay admins cargados para esta liga.</p>
                )}
              </div>
            </Card>

            <Card>
              <CardTitle>Invitaciones pendientes</CardTitle>
              <div className="mt-4 space-y-2">
                {details.leagueAdmins.pendingInvites.length ? (
                  details.leagueAdmins.pendingInvites.map((invite) => {
                    const inviteUrl = buildAdminInviteUrl(invite.inviteToken);
                    return (
                      <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm" key={invite.id}>
                        <p className="font-semibold text-slate-100">{invite.email}</p>
                        <p className="text-xs text-slate-400">
                          Enviada {new Date(invite.createdAt).toLocaleDateString("es-AR")}
                        </p>
                        <Link
                          className="mt-2 block break-all text-xs font-semibold text-emerald-300 hover:underline"
                          href={inviteUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {inviteUrl}
                        </Link>
                        <form action={revokeLeagueAdminInviteAction.bind(null, id)} className="mt-2">
                          <input name="inviteId" type="hidden" value={invite.id} />
                          <Button type="submit" variant="ghost">
                            Cancelar invitacion
                          </Button>
                        </form>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-400">No hay invitaciones pendientes.</p>
                )}
              </div>
            </Card>
          </section>
        </div>
      ) : null}
    </div>
  );
}
