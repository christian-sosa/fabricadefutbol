import Link from "next/link";

import { createOrganizationAction } from "@/app/admin/(panel)/actions";
import { TrackedButton } from "@/components/analytics/tracked-button";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getAdminOrganizationContext,
  getAdminOrganizationCreationAccess
} from "@/lib/auth/admin";
import { GROWTH_EVENTS } from "@/lib/growth";
import { withOrgQuery } from "@/lib/org";

export default async function NewOrganizationPage({
  searchParams
}: {
  searchParams: Promise<{ org?: string; error?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const { admin, organizations, selectedOrganization } = await getAdminOrganizationContext(
    resolvedSearchParams.org
  );
  const creationAccess = await getAdminOrganizationCreationAccess(admin);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Nuevo grupo</CardTitle>
            <CardDescription className="mt-2">
              Crea un espacio separado para otros jugadores, partidos, rendimiento e historial.
            </CardDescription>
          </div>
          <Link
            className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:border-emerald-400/60 hover:text-emerald-300"
            href={withOrgQuery("/admin", selectedOrganization?.slug)}
          >
            Volver
          </Link>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <CardTitle>Datos del grupo</CardTitle>
        <CardDescription className="mt-2">
          Creá tu grupo gratis y empezá a cargar jugadores, partidos e historial. Si administrás más de un grupo,
          escribinos y lo habilitamos.
        </CardDescription>

        {!creationAccess.canCreateOrganization && organizations.length > 1 ? (
          <div className="mt-4">
            <OrganizationSwitcher
              basePath="/admin/new"
              currentOrganizationSlug={selectedOrganization?.slug}
              label="Grupo de referencia"
              organizations={organizations}
            />
          </div>
        ) : null}

        <form
          action={createOrganizationAction}
          className="mt-4 flex flex-col gap-3 md:flex-row"
        >
          {selectedOrganization ? (
            <input name="organizationId" type="hidden" value={selectedOrganization.id} />
          ) : null}
          <Input name="name" placeholder="Nombre del grupo" required />
          <TrackedButton
            disabled={!creationAccess.canCreateOrganization}
            eventName={GROWTH_EVENTS.ctaClicked}
            eventProperties={{
              cta: "create_group_submit",
              source: "admin_new_group"
            }}
            type="submit"
          >
            Crear grupo
          </TrackedButton>
        </form>

        {!creationAccess.canCreateOrganization ? (
          <p className="mt-2 text-xs font-semibold text-amber-300">
            {creationAccess.reason ??
              "Si querés sumar otro grupo, escribinos y lo habilitamos manualmente."}
          </p>
        ) : null}
        {resolvedSearchParams.error ? (
          <p className="mt-3 text-sm font-semibold text-danger">{resolvedSearchParams.error}</p>
        ) : null}
      </Card>
    </div>
  );
}
