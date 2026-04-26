import Link from "next/link";
import { redirect } from "next/navigation";

import {
  createOrganizationAction,
  deleteOrganizationAction,
  inviteOrganizationAdminAction,
  removeOrganizationAdminAction,
  revokeOrganizationInviteAction,
  startOrganizationCreationCheckoutAction,
  uploadOrganizationImageAction
} from "@/app/admin/(panel)/actions";
import { OrganizationImage } from "@/components/groups/organization-image";
import { TournamentStatusBadge } from "@/components/tournaments/tournament-badges";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Input } from "@/components/ui/input";
import {
  getAdminOrganizationContext,
  getAdminOrganizationCreationAccess,
  getOrganizationQueryKeyById,
  getOrganizationWriteAccess
} from "@/lib/auth/admin";
import { syncOrganizationBillingPaymentFromMercadoPago } from "@/lib/domain/billing-workflow";
import { getOrganizationImageUrl } from "@/lib/organization-images";
import { withOrgQuery } from "@/lib/org";
import { getAdminDashboardData, getOrganizationAdminData } from "@/lib/queries/admin";
import { getAdminLeagueList } from "@/lib/queries/tournaments";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type OrganizationEntry = {
  id: string;
  name: string;
  slug: string;
  is_public: boolean;
  created_at: string;
};

type LeagueEntry = Awaited<ReturnType<typeof getAdminLeagueList>>[number];

function findOrganizationByKey(organizations: OrganizationEntry[], organizationKey?: string | null) {
  if (!organizationKey) return null;
  const normalizedKey = organizationKey.trim().toLowerCase();
  if (!normalizedKey) return null;

  return (
    organizations.find(
      (organization) => organization.slug.toLowerCase() === normalizedKey || organization.id === organizationKey
    ) ?? null
  );
}

function AdminFeedback({
  checkout,
  error
}: {
  checkout?: string;
  error?: string;
}) {
  if (!checkout && !error) return null;

  return (
    <Card>
      {checkout === "created-org" ? (
        <p className="text-sm font-semibold text-emerald-300">
          Pago confirmado. El nuevo grupo ya fue creado y seleccionado.
        </p>
      ) : null}
      {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}
    </Card>
  );
}

function AdminHomeHub({
  creationAccess,
  checkout,
  error,
  leagues,
  organizations
}: {
  creationAccess: Awaited<ReturnType<typeof getAdminOrganizationCreationAccess>>;
  checkout?: string;
  error?: string;
  leagues: LeagueEntry[];
  organizations: OrganizationEntry[];
}) {
  const hasOrganizations = organizations.length > 0;
  const hasLeagues = leagues.length > 0;
  const referenceOrganization = organizations[0] ?? null;

  return (
    <div className="space-y-4">
      <AdminFeedback checkout={checkout} error={error} />

      <Card className="p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">
          Panel de administracion
        </p>
        <CardTitle className="mt-2 text-3xl">Que queres administrar?</CardTitle>
        <CardDescription className="mt-3 max-w-3xl text-base">
          Elegi un grupo o una liga antes de cargar datos. Asi cada flujo mantiene sus jugadores,
          partidos, competencias y facturacion en el lugar correcto.
        </CardDescription>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Tus grupos</CardTitle>
              <CardDescription className="mt-2">
                Para partidos recurrentes, niveles de habilidad, rendimiento, historial y proximas fechas.
              </CardDescription>
            </div>
            {hasOrganizations ? (
              <Link
                className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:border-emerald-400/60 hover:text-emerald-300"
                href={withOrgQuery("/admin/new", referenceOrganization?.slug)}
              >
                Crear grupo
              </Link>
            ) : null}
          </div>

          <div className="mt-4 space-y-3">
            {hasOrganizations ? (
              organizations.map((organization) => (
                <div
                  className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 sm:flex-row sm:items-center sm:justify-between"
                  key={organization.id}
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-100">{organization.name}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {organization.is_public ? "Publico" : "Privado"} - /{organization.slug}
                    </p>
                  </div>
                  <Link
                    className="inline-flex items-center justify-center rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                    href={withOrgQuery("/admin", organization.slug)}
                  >
                    Entrar al grupo
                  </Link>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-sm font-semibold text-slate-100">Todavia no administras grupos.</p>
                <p className="mt-1 text-sm text-slate-400">
                  Crea el primero para empezar a cargar jugadores y partidos semanales.
                </p>
                <form
                  action={
                    creationAccess.canCreateOrganization
                      ? createOrganizationAction
                      : startOrganizationCreationCheckoutAction
                  }
                  className="mt-4 flex flex-col gap-3 md:flex-row"
                >
                  <Input name="name" placeholder="Nombre del grupo" required />
                  <Button disabled={!creationAccess.canCreateOrganization} type="submit">
                    {creationAccess.canCreateOrganization ? "Crear grupo" : "Pagar y crear grupo"}
                  </Button>
                </form>
                {!creationAccess.canCreateOrganization ? (
                  <p className="mt-2 text-xs font-semibold text-amber-300">
                    {creationAccess.reason ?? "Para crear un nuevo grupo necesitas activar el plan pago."}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Tus ligas</CardTitle>
              <CardDescription className="mt-2">
                Para torneos con equipos maestros, competencias, fixture, tabla y resultados publicos.
              </CardDescription>
            </div>
            <Link
              className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:border-sky-400/60 hover:text-sky-300"
              href="/admin/tournaments/new"
            >
              Crear liga
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {hasLeagues ? (
              leagues.map((league) => (
                <div
                  className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 sm:flex-row sm:items-center sm:justify-between"
                  key={league.id}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-slate-100">{league.name}</p>
                      <TournamentStatusBadge status={league.status} />
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {league.teamCount} equipos - {league.competitionCount} competencias
                    </p>
                  </div>
                  <Link
                    className="inline-flex items-center justify-center rounded-md bg-sky-500 px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                    href={`/admin/tournaments/${league.id}`}
                  >
                    Entrar a la liga
                  </Link>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-sm font-semibold text-slate-100">Todavia no administras ligas.</p>
                <p className="mt-1 text-sm text-slate-400">
                  Crea una liga cuando necesites competencias, equipos inscriptos y tabla publica.
                </p>
                <Link
                  className="mt-4 inline-flex items-center justify-center rounded-md bg-sky-500 px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                  href="/admin/tournaments/new"
                >
                  Crear liga
                </Link>
              </div>
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}

export default async function AdminDashboardPage({
  searchParams
}: {
  searchParams: Promise<{ org?: string; error?: string; checkout?: string; flow?: string; payment_id?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const { admin, organizations } = await getAdminOrganizationContext(resolvedSearchParams.org);

  if (resolvedSearchParams.flow === "create-org" && resolvedSearchParams.payment_id) {
    const supabaseAdmin = createSupabaseAdminClient();
    if (supabaseAdmin) {
      try {
        const syncResult = await syncOrganizationBillingPaymentFromMercadoPago({
          supabase: supabaseAdmin,
          mercadopagoPaymentId: resolvedSearchParams.payment_id
        });

        if (syncResult.updated && syncResult.createdOrganizationId) {
          const createdOrganizationKey = await getOrganizationQueryKeyById(syncResult.createdOrganizationId);
          redirect(withOrgQuery("/admin?checkout=created-org", createdOrganizationKey));
        }
      } catch {
        // Mantiene la pantalla operativa aunque falle la sincronizacion puntual.
      }
    }
  }

  const creationAccess = await getAdminOrganizationCreationAccess(admin);
  const selectedOrganization = findOrganizationByKey(organizations, resolvedSearchParams.org);

  if (!selectedOrganization) {
    const leagues = await getAdminLeagueList();

    return (
      <AdminHomeHub
        checkout={resolvedSearchParams.checkout}
        creationAccess={creationAccess}
        error={resolvedSearchParams.error}
        leagues={leagues}
        organizations={organizations}
      />
    );
  }

  const dashboardData = await getAdminDashboardData(selectedOrganization.id);
  const organizationWriteAccess = await getOrganizationWriteAccess(admin, selectedOrganization.id);
  const canWriteSelectedOrganization = organizationWriteAccess?.canWrite ?? false;
  const organizationAdmins = await getOrganizationAdminData(selectedOrganization.id);

  return (
    <div className="space-y-4">
      <AdminFeedback checkout={resolvedSearchParams.checkout} error={resolvedSearchParams.error} />

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">
              Grupo actual
            </p>
            <CardTitle className="mt-2">{selectedOrganization.name}</CardTitle>
            <CardDescription className="mt-2">
              Estas administrando este grupo. Los jugadores, partidos, rendimiento, imagen y facturacion se guardan aca.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-800"
              href="/admin"
            >
              Cambiar espacio
            </Link>
            <Link
              className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:border-emerald-400/60 hover:text-emerald-300"
              href={withOrgQuery("/admin/new", selectedOrganization.slug)}
            >
              Crear grupo
            </Link>
          </div>
        </div>
      </Card>

      {!canWriteSelectedOrganization ? (
        <Card className="border-amber-500/40 bg-amber-500/10">
          <CardTitle className="text-amber-100">Grupo en modo solo lectura</CardTitle>
          <CardDescription className="mt-1 text-amber-200/90">
            {organizationWriteAccess?.reason ??
              "Este grupo no tiene escritura habilitada en el plan actual."}
          </CardDescription>
          <div className="mt-3">
            <Link
              className="text-sm font-semibold text-amber-100 underline underline-offset-4"
              href={withOrgQuery("/admin/billing", selectedOrganization.slug)}
            >
              Activar plan mensual
            </Link>
          </div>
        </Card>
      ) : null}

      <Card>
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <OrganizationImage
            alt={`Imagen de ${selectedOrganization.name}`}
            className="aspect-[16/9] min-h-[220px]"
            priority
            src={getOrganizationImageUrl(selectedOrganization.id)}
          />

          <div>
            <CardTitle>Imagen del grupo</CardTitle>
            <CardDescription className="mt-2">
              Sube una foto que represente al grupo o una imagen post partido. Se mostrara en la vista publica de grupos.
            </CardDescription>

            <form action={uploadOrganizationImageAction} className="mt-4 space-y-3">
              <input name="organizationId" type="hidden" value={selectedOrganization.id} />
              <Input accept="image/png,image/jpeg,image/webp" name="image" type="file" />
              <Button disabled={!canWriteSelectedOrganization} type="submit">
                Guardar imagen
              </Button>
            </form>
          </div>
        </div>
      </Card>

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

      {admin.isSuperAdmin ? (
        <Card className="border-danger/40 bg-danger/10">
          <CardTitle className="text-danger">Zona super admin</CardTitle>
          <CardDescription className="mt-1 text-slate-200">
            Esta accion elimina el grupo seleccionado y todos sus datos asociados, incluyendo fotos,
            jugadores, partidos, historial, admins e invitaciones.
          </CardDescription>
          <form action={deleteOrganizationAction} className="mt-4">
            <input name="organizationId" type="hidden" value={selectedOrganization.id} />
            <ConfirmSubmitButton
              confirmMessage={`Estas seguro de borrar ${selectedOrganization.name}? Se perderan definitivamente todas las fotos, jugadores, partidos, historial, admins, invitaciones y pagos asociados. Esta accion no se puede deshacer.`}
              label="Borrar grupo"
              variant="danger"
            />
          </form>
        </Card>
      ) : null}

      <Card>
        <CardTitle>Equipo administrador (maximo 4)</CardTitle>
        <CardDescription>
          Invita por email y comparte el link. La persona se registra, abre el link y queda como admin.
        </CardDescription>

        <form action={inviteOrganizationAdminAction} className="mt-4 flex flex-col gap-3 md:flex-row">
          <input name="organizationId" type="hidden" value={selectedOrganization.id} />
          <Input name="email" placeholder="email@dominio.com" required type="email" />
          <Button disabled={!canWriteSelectedOrganization} type="submit" variant="secondary">
            Invitar admin
          </Button>
        </form>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Admins activos</p>
            <div className="space-y-2">
              {organizationAdmins.admins.map((member) => (
                <div
                  className="flex items-start justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
                  key={member.id}
                >
                  <div>
                    <p className="font-semibold text-slate-100">{member.email ?? member.displayName}</p>
                    <p className="text-xs text-slate-400">Desde {new Date(member.createdAt).toLocaleDateString("es-AR")}</p>
                  </div>
                  {member.id === admin.userId ? (
                    <span className="rounded-md border border-slate-700 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                      Tu cuenta
                    </span>
                  ) : (
                    <form action={removeOrganizationAdminAction}>
                      <input name="organizationId" type="hidden" value={selectedOrganization.id} />
                      <input name="adminId" type="hidden" value={member.id} />
                      <ConfirmSubmitButton
                        className="h-7 min-w-7 px-2 text-xs"
                        confirmMessage={`Estas seguro de quitar a ${member.email ?? member.displayName} como admin de ${selectedOrganization.name}?`}
                        disabled={!canWriteSelectedOrganization}
                        label="X"
                        variant="ghost"
                      />
                    </form>
                  )}
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
                      <Button disabled={!canWriteSelectedOrganization} type="submit" variant="ghost">
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
    </div>
  );
}
