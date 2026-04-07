import { redirect } from "next/navigation";

import { NewMatchForm } from "@/components/admin/new-match-form";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getOrganizationWriteAccess, requireAdminOrganization } from "@/lib/auth/admin";
import { withOrgQuery } from "@/lib/org";
import { getSelectablePlayers } from "@/lib/queries/admin";

export default async function NewMatchPage({
  searchParams
}: {
  searchParams: { org?: string; error?: string };
}) {
  const { admin, organizations, selectedOrganization } = await requireAdminOrganization(searchParams.org);
  const writeAccess = await getOrganizationWriteAccess(admin, selectedOrganization.id);
  if (!writeAccess.canWrite) {
    const target = withOrgQuery("/admin", selectedOrganization.slug);
    const separator = target.includes("?") ? "&" : "?";
    redirect(`${target}${separator}error=${encodeURIComponent(writeAccess.reason ?? "No tienes permisos para editar esta organizacion.")}`);
  }
  const players = await getSelectablePlayers(selectedOrganization.id);
  const error = searchParams.error;

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Organizacion activa: {selectedOrganization.name}</CardTitle>
        <div className="mt-3">
          <OrganizationSwitcher
            basePath="/admin/matches/new"
            currentOrganizationSlug={selectedOrganization.slug}
            label="Cambiar organizacion"
            organizations={organizations}
          />
        </div>
      </Card>

      <Card>
        <CardTitle>Crear partido</CardTitle>
        <CardDescription>
          1) Elige modalidad, 2) selecciona convocados (y opcionalmente 2 arqueros), 3) genera equipos automáticos o
          arma equipos manuales.
        </CardDescription>

        <NewMatchForm error={error} organizationId={selectedOrganization.id} players={players} />
      </Card>
    </div>
  );
}
