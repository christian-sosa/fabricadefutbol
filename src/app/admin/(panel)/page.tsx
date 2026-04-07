import Link from "next/link";
import { redirect } from "next/navigation";

import {
  createOrganizationAction,
  deleteOrganizationAction,
  inviteOrganizationAdminAction,
  removeOrganizationAdminAction,
  revokeOrganizationInviteAction,
  startOrganizationCreationCheckoutAction
} from "@/app/admin/(panel)/actions";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { MatchStatusBadge } from "@/components/ui/badge";
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
import { ORGANIZATION_BILLING_CURRENCY, ORGANIZATION_MONTHLY_PRICE_ARS } from "@/lib/constants";
import { syncOrganizationBillingPaymentFromMercadoPago } from "@/lib/domain/billing-workflow";
import { withOrgQuery } from "@/lib/org";
import { getAdminDashboardData, getOrganizationAdminData } from "@/lib/queries/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/utils";

function formatCurrencyArs(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: ORGANIZATION_BILLING_CURRENCY,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

export default async function AdminDashboardPage({
  searchParams
}: {
  searchParams: { org?: string; error?: string; checkout?: string; flow?: string; payment_id?: string };
}) {
  const { admin, organizations, selectedOrganization } = await getAdminOrganizationContext(searchParams.org);

  if (searchParams.flow === "create-org" && searchParams.payment_id) {
    const supabaseAdmin = createSupabaseAdminClient();
    if (supabaseAdmin) {
      try {
        const syncResult = await syncOrganizationBillingPaymentFromMercadoPago({
          supabase: supabaseAdmin,
          mercadopagoPaymentId: searchParams.payment_id
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
        <CardDescription>
          Proba 1 mes gratis por organizacion. Despues, {formatCurrencyArs(ORGANIZATION_MONTHLY_PRICE_ARS)} por mes por
          organizacion para mantener edicion y crear nuevas.
        </CardDescription>
        <form
          action={creationAccess.canCreateOrganization ? createOrganizationAction : startOrganizationCreationCheckoutAction}
          className="mt-4 flex flex-col gap-3 md:flex-row"
        >
          {selectedOrganization ? (
            <input name="organizationId" type="hidden" value={selectedOrganization.id} />
          ) : null}
          <Input name="name" placeholder="Nombre de la organizacion" required />
          <Button disabled={!creationAccess.canCreateOrganization && !selectedOrganization} type="submit">
            {creationAccess.canCreateOrganization ? "Crear organizacion" : "Pagar y crear organizacion"}
          </Button>
        </form>
        {!creationAccess.canCreateOrganization ? (
          <p className="mt-2 text-xs font-semibold text-amber-300">
            {creationAccess.reason ?? "Para crear una nueva organizacion necesitas activar el plan pago."}{" "}
            El alta se realiza automaticamente cuando Mercado Pago confirma el pago.
          </p>
        ) : null}
        {searchParams.checkout === "created-org" ? (
          <p className="mt-2 text-xs font-semibold text-emerald-300">
            Pago confirmado. La nueva organizacion ya fue creada y seleccionada.
          </p>
        ) : null}
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
          {!canWriteSelectedOrganization ? (
            <Card className="border-amber-500/40 bg-amber-500/10">
              <CardTitle className="text-amber-100">Organizacion en modo solo lectura</CardTitle>
              <CardDescription className="mt-1 text-amber-200/90">
                {organizationWriteAccess?.reason ??
                  "Esta organizacion no tiene escritura habilitada en el plan actual."}
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
                <CardTitle>Panel operativo: {selectedOrganization.name}</CardTitle>
                <CardDescription>Control de jugadores, partidos y equipo administrador.</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canWriteSelectedOrganization ? (
                  <>
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
                    <Link
                      className="text-sm font-semibold text-emerald-300 hover:underline"
                      href={withOrgQuery("/admin/billing", selectedOrganization.slug)}
                    >
                      Facturacion
                    </Link>
                  </>
                ) : (
                  <Link
                    className="text-xs font-semibold uppercase tracking-wide text-amber-200 underline underline-offset-4"
                    href={withOrgQuery("/admin/billing", selectedOrganization.slug)}
                  >
                    Edicion bloqueada: activar plan pago
                  </Link>
                )}
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
                      className={`font-semibold ${canWriteSelectedOrganization ? "text-emerald-300 hover:underline" : "text-slate-500 pointer-events-none cursor-not-allowed"}`}
                      href={canWriteSelectedOrganization ? withOrgQuery(`/admin/matches/${match.id}`, selectedOrganization.slug) : "#"}
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
            Todavia no administras ninguna organizacion. Crea una desde el formulario superior.
          </CardDescription>
        </Card>
      )}
    </div>
  );
}
