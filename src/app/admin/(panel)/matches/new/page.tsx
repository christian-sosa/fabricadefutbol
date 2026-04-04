import { NewMatchForm } from "@/components/admin/new-match-form";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireAdminOrganization } from "@/lib/auth/admin";
import { getSelectablePlayers } from "@/lib/queries/admin";

export default async function NewMatchPage({
  searchParams
}: {
  searchParams: { org?: string; error?: string };
}) {
  const { organizations, selectedOrganization } = await requireAdminOrganization(searchParams.org);
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
          1) Elige modalidad, 2) selecciona jugadores fijos e invitados, 3) el sistema genera opciones balanceadas.
        </CardDescription>

        <NewMatchForm error={error} organizationId={selectedOrganization.id} players={players} />
      </Card>
    </div>
  );
}
