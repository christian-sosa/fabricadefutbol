import Link from "next/link";

import {
  inviteOrganizationAdminAction,
  removeOrganizationAdminAction,
  revokeOrganizationInviteAction
} from "@/app/admin/(panel)/actions";
import { AdminCurrentGroupCard } from "@/components/admin/admin-current-group-card";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Input } from "@/components/ui/input";
import { getOrganizationWriteAccess, requireAdminOrganization } from "@/lib/auth/admin";
import { buildAbsolutePublicUrl } from "@/lib/public-url";
import { getOrganizationAdminData } from "@/lib/queries/admin";

function AdminsFeedback({ error }: { error?: string }) {
  if (!error) return null;

  return (
    <Card>
      <p className="text-sm font-semibold text-danger">{error}</p>
    </Card>
  );
}

export default async function AdminOrganizationAdminsPage({
  searchParams
}: {
  searchParams: Promise<{ org?: string; error?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const { admin, selectedOrganization } = await requireAdminOrganization(resolvedSearchParams.org);
  const [writeAccess, organizationAdmins] = await Promise.all([
    getOrganizationWriteAccess(admin, selectedOrganization.id),
    getOrganizationAdminData(selectedOrganization.id)
  ]);
  const canWriteSelectedOrganization = writeAccess.canWrite;

  return (
    <div className="space-y-4">
      <AdminsFeedback error={resolvedSearchParams.error} />

      <AdminCurrentGroupCard admin={admin} organization={selectedOrganization} />

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
                    <p className="text-xs text-slate-400">
                      Desde {new Date(member.createdAt).toLocaleDateString("es-AR")}
                    </p>
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
                organizationAdmins.pendingInvites.map((invite) => {
                  const inviteUrl = buildAbsolutePublicUrl(`/invite/${invite.inviteToken}`);

                  return (
                    <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm" key={invite.id}>
                      <p className="font-semibold text-slate-100">{invite.email}</p>
                      <p className="text-xs text-slate-400">
                        Enviada {new Date(invite.createdAt).toLocaleDateString("es-AR")}
                      </p>
                      <p className="mt-2 text-xs text-slate-400">
                        Enviale este link a {invite.email}. La persona debe registrarse o iniciar sesion con ese email,
                        abrir el link y aceptar la invitacion.
                      </p>
                      <Link
                        className="mt-1 block break-all text-xs font-semibold text-emerald-300 hover:underline"
                        href={inviteUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {inviteUrl}
                      </Link>
                      <form action={revokeOrganizationInviteAction} className="mt-2">
                        <input name="organizationId" type="hidden" value={selectedOrganization.id} />
                        <input name="inviteId" type="hidden" value={invite.id} />
                        <Button disabled={!canWriteSelectedOrganization} type="submit" variant="ghost">
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
          </div>
        </div>
      </Card>
    </div>
  );
}
