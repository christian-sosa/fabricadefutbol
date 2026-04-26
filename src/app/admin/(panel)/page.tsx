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
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
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
import { ORGANIZATION_MONTHLY_PRICE_ARS } from "@/lib/constants";
import { syncOrganizationBillingPaymentFromMercadoPago } from "@/lib/domain/billing-workflow";
import { getOrganizationImageUrl } from "@/lib/organization-images";
import { withOrgQuery } from "@/lib/org";
import { getAdminDashboardData, getOrganizationAdminData } from "@/lib/queries/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function formatAmountArs(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

export default async function AdminDashboardPage({
  searchParams
}: {
  searchParams: Promise<{ org?: string; error?: string; checkout?: string; flow?: string; payment_id?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const { admin, organizations, selectedOrganization } = await getAdminOrganizationContext(resolvedSearchParams.org);

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
  const dashboardData = selectedOrganization ? await getAdminDashboardData(selectedOrganization.id) : null;
  const organizationWriteAccess = selectedOrganization
    ? await getOrganizationWriteAccess(admin, selectedOrganization.id)
    : null;
  const canWriteSelectedOrganization = organizationWriteAccess?.canWrite ?? false;
  const organizationAdmins = selectedOrganization
    ? await getOrganizationAdminData(selectedOrganization.id)
    : { admins: [], pendingInvites: [] };
  const hasOrganizations = organizations.length > 0;

  return (
    <div className="space-y-4">
      {!hasOrganizations ? (
        <Card className="p-5 sm:p-6">
          <CardTitle>Crear grupo</CardTitle>
          <CardDescription>
            1 mes de prueba gratis por organización. Después, $
            {formatAmountArs(ORGANIZATION_MONTHLY_PRICE_ARS)}/mes para seguir creando.
          </CardDescription>
          <form
            action={creationAccess.canCreateOrganization ? createOrganizationAction : startOrganizationCreationCheckoutAction}
            className="mt-4 flex flex-col gap-3 md:flex-row"
          >
            {selectedOrganization ? (
              <input name="organizationId" type="hidden" value={selectedOrganization.id} />
            ) : null}
            <Input name="name" placeholder="Nombre del grupo" required />
            <Button disabled={!creationAccess.canCreateOrganization && !selectedOrganization} type="submit">
              {creationAccess.canCreateOrganization ? "Crear grupo" : "Pagar y crear grupo"}
            </Button>
          </form>
          {!creationAccess.canCreateOrganization ? (
            <p className="mt-2 text-xs font-semibold text-amber-300">
              {creationAccess.reason ?? "Para crear un nuevo grupo necesitas activar el plan pago."}{" "}
              El alta se realiza automaticamente cuando Mercado Pago confirma el pago.
            </p>
          ) : null}
          {resolvedSearchParams.checkout === "created-org" ? (
            <p className="mt-2 text-xs font-semibold text-emerald-300">
              Pago confirmado. El nuevo grupo ya fue creado y seleccionado.
            </p>
          ) : null}
          {resolvedSearchParams.error ? <p className="mt-3 text-sm font-semibold text-danger">{resolvedSearchParams.error}</p> : null}
        </Card>
      ) : null}

      {hasOrganizations && (resolvedSearchParams.checkout === "created-org" || resolvedSearchParams.error) ? (
        <Card>
          {resolvedSearchParams.checkout === "created-org" ? (
            <p className="text-sm font-semibold text-emerald-300">
              Pago confirmado. El nuevo grupo ya fue creado y seleccionado.
            </p>
          ) : null}
          {resolvedSearchParams.error ? (
            <p className="text-sm font-semibold text-danger">{resolvedSearchParams.error}</p>
          ) : null}
        </Card>
      ) : null}

      {hasOrganizations ? (
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Grupos disponibles</CardTitle>
            <Link
              className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:border-emerald-400/60 hover:text-emerald-300"
              href={withOrgQuery("/admin/new", selectedOrganization?.slug)}
            >
              Crear grupo
            </Link>
          </div>
          <div className="mt-3">
            <OrganizationSwitcher
              basePath="/admin"
              currentOrganizationSlug={selectedOrganization?.slug}
              label="Seleccion de grupo"
              organizations={organizations}
            />
          </div>
        </Card>
      ) : null}

      {selectedOrganization ? (
        <>
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
        </>
      ) : (
        <Card>
          <CardTitle>Primer paso</CardTitle>
          <CardDescription>
            Todavia no administras ningun grupo. Crea uno desde el formulario superior.
          </CardDescription>
        </Card>
      )}
    </div>
  );
}
