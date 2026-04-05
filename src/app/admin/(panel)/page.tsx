import Link from "next/link";

import {
  createOrganizationAction,
  deleteOrganizationAction,
  inviteOrganizationAdminAction,
  revokeOrganizationInviteAction
} from "@/app/admin/(panel)/actions";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { MatchStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getAdminOrganizationContext } from "@/lib/auth/admin";
import { withOrgQuery } from "@/lib/org";
import { getAdminDashboardData, getOrganizationAdminData } from "@/lib/queries/admin";
import { formatDateTime } from "@/lib/utils";

export default async function AdminDashboardPage({
  searchParams
}: {
  searchParams: { org?: string; error?: string };
}) {
  const { admin, organizations, selectedOrganization } = await getAdminOrganizationContext(searchParams.org);
  const dashboardData = selectedOrganization ? await getAdminDashboardData(selectedOrganization.id) : null;
  const organizationAdmins = selectedOrganization
    ? await getOrganizationAdminData(selectedOrganization.id)
    : { admins: [], pendingInvites: [] };

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Cuenta administradora</CardTitle>
        <CardDescription>
          {admin.displayName} ({admin.email})
        </CardDescription>
        <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-emerald-300">
          Rol: {admin.isSuperAdmin ? "Super Admin" : "Admin de organizaciones"}
        </p>
      </Card>

      <Card>
        <CardTitle>Crear organizacion</CardTitle>
        <CardDescription>Crea una nueva organizacion publica y conviertete en su primer administrador.</CardDescription>
        <form action={createOrganizationAction} className="mt-4 flex flex-col gap-3 md:flex-row">
          <Input name="name" placeholder="Nombre de la organizacion" required />
          <Button type="submit">Crear organizacion</Button>
        </form>
        {searchParams.error ? <p className="mt-3 text-sm font-semibold text-danger">{searchParams.error}</p> : null}
      </Card>

      <Card>
        <CardTitle>Organizaciones disponibles</CardTitle>
        <div className="mt-3">
          <OrganizationSwitcher
            basePath="/admin"
            currentOrganizationSlug={selectedOrganization?.slug}
            label="Seleccion de organizacion"
            organizations={organizations}
          />
        </div>
      </Card>

      {selectedOrganization ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardDescription>Partidos en borrador</CardDescription>
              <CardTitle className="mt-1 text-3xl">{dashboardData?.draftsCount ?? 0}</CardTitle>
            </Card>
            <Card>
              <CardDescription>Partidos confirmados</CardDescription>
              <CardTitle className="mt-1 text-3xl">{dashboardData?.confirmedCount ?? 0}</CardTitle>
            </Card>
            <Card>
              <CardDescription>Partidos finalizados</CardDescription>
              <CardTitle className="mt-1 text-3xl">{dashboardData?.finishedCount ?? 0}</CardTitle>
            </Card>
          </section>

          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Gestion: {selectedOrganization.name}</CardTitle>
                <CardDescription>Control de jugadores, partidos y equipo administrador.</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  className="text-sm font-semibold text-emerald-300 hover:underline"
                  href={withOrgQuery("/admin/players", selectedOrganization.slug)}
                >
                  Jugadores
                </Link>
                <Link
                  className="text-sm font-semibold text-emerald-300 hover:underline"
                  href={withOrgQuery("/admin/matches/new", selectedOrganization.slug)}
                >
                  Nuevo partido
                </Link>
              </div>
            </div>

            <div className="space-y-2">
              {(dashboardData?.latestMatches ?? []).map((match) => (
                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm" key={match.id}>
                  <span>
                    {formatDateTime(match.scheduled_at)} - {match.modality}
                  </span>
                  <div className="flex items-center gap-3">
                    <MatchStatusBadge status={match.status} />
                    <Link
                      className="font-semibold text-emerald-300 hover:underline"
                      href={withOrgQuery(`/admin/matches/${match.id}`, selectedOrganization.slug)}
                    >
                      Gestionar
                    </Link>
                  </div>
                </div>
              ))}
              {!dashboardData?.latestMatches.length ? (
                <p className="text-sm text-slate-400">No hay partidos todavia para esta organizacion.</p>
              ) : null}
            </div>

            {admin.isSuperAdmin ? (
              <div className="mt-4 rounded-xl border border-danger/40 bg-danger/10 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-danger">Zona super admin</p>
                <p className="mt-1 text-sm text-slate-200">
                  Esta accion elimina la organizacion y todos sus datos asociados.
                </p>
                <form action={deleteOrganizationAction} className="mt-3">
                  <input name="organizationId" type="hidden" value={selectedOrganization.id} />
                  <Button type="submit" variant="danger">
                    Borrar organizacion
                  </Button>
                </form>
              </div>
            ) : null}
          </Card>

          <Card>
            <CardTitle>Equipo administrador (maximo 4)</CardTitle>
            <CardDescription>
              Invita por email y comparte el link. La persona se registra, abre el link y queda como admin.
            </CardDescription>

            <form action={inviteOrganizationAdminAction} className="mt-4 flex flex-col gap-3 md:flex-row">
              <input name="organizationId" type="hidden" value={selectedOrganization.id} />
              <Input name="email" placeholder="email@dominio.com" required type="email" />
              <Button type="submit" variant="secondary">
                Invitar admin
              </Button>
            </form>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Admins activos</p>
                <div className="space-y-2">
                  {organizationAdmins.admins.map((member) => (
                    <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm" key={member.id}>
                      <p className="font-semibold text-slate-100">{member.displayName}</p>
                      <p className="text-xs text-slate-400">Desde {new Date(member.createdAt).toLocaleDateString("es-AR")}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Invitaciones pendientes</p>
                <div className="space-y-2">
                  {organizationAdmins.pendingInvites.length ? (
                    organizationAdmins.pendingInvites.map((invite) => (
                      <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm" key={invite.id}>
                        <p className="font-semibold text-slate-100">{invite.email}</p>
                        <p className="text-xs text-slate-400">
                          Enviada {new Date(invite.createdAt).toLocaleDateString("es-AR")}
                        </p>
                        <p className="mt-2 text-xs text-slate-400">Link de invitacion:</p>
                        <Link
                          className="break-all text-xs font-semibold text-emerald-300 hover:underline"
                          href={`/invite/${invite.inviteToken}`}
                        >
                          /invite/{invite.inviteToken}
                        </Link>
                        <form action={revokeOrganizationInviteAction} className="mt-2">
                          <input name="organizationId" type="hidden" value={selectedOrganization.id} />
                          <input name="inviteId" type="hidden" value={invite.id} />
                          <Button type="submit" variant="ghost">
                            Cancelar invitacion
                          </Button>
                        </form>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">No hay invitaciones pendientes.</p>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </>
      ) : (
        <Card>
          <CardTitle>Primer paso</CardTitle>
          <CardDescription>
            Todavia no administras ninguna organizacion. Crea una desde el formulario superior.
          </CardDescription>
        </Card>
      )}
    </div>
  );
}
