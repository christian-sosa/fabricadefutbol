import Link from "next/link";

import {
  createOrganizationAction,
  startOrganizationCreationCheckoutAction
} from "@/app/admin/(panel)/actions";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getAdminOrganizationContext,
  getAdminOrganizationCreationAccess
} from "@/lib/auth/admin";
import { ORGANIZATION_MONTHLY_PRICE_ARS } from "@/lib/constants";
import { withOrgQuery } from "@/lib/org";

function formatAmountArs(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

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
          1 mes de prueba gratis por organizacion. Despues, $
          {formatAmountArs(ORGANIZATION_MONTHLY_PRICE_ARS)}/mes para seguir creando.
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
          action={
            creationAccess.canCreateOrganization
              ? createOrganizationAction
              : startOrganizationCreationCheckoutAction
          }
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
        {resolvedSearchParams.error ? (
          <p className="mt-3 text-sm font-semibold text-danger">{resolvedSearchParams.error}</p>
        ) : null}
      </Card>
    </div>
  );
}
