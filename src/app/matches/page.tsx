import Link from "next/link";

import { AdPlaceholder } from "@/components/layout/ad-placeholder";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { MatchStatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { withOrgQuery } from "@/lib/org";
import { getMatchHistoryCards, getViewerAdminOrganizations, resolvePublicOrganization } from "@/lib/queries/public";
import { formatDateTime } from "@/lib/utils";

export default async function MatchesPage({
  searchParams
}: {
  searchParams: { org?: string };
}) {
  const [{ organizations, selectedOrganization }, viewerAdminOrganizations] = await Promise.all([
    resolvePublicOrganization(searchParams.org),
    getViewerAdminOrganizations()
  ]);
  const matches = await getMatchHistoryCards(selectedOrganization?.id ?? null);

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black text-slate-100">
        Historial de Partidos {selectedOrganization ? `- ${selectedOrganization.name}` : ""}
      </h1>

      <OrganizationSwitcher
        basePath="/matches"
        currentOrganizationSlug={selectedOrganization?.slug}
        label="Elegir organizacion"
        organizations={organizations}
        quickOrganizations={viewerAdminOrganizations}
      />

      <AdPlaceholder slot="matches-top" />

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <tr>
                <TH>Fecha</TH>
                <TH>Modalidad</TH>
                <TH>Resultado</TH>
                <TH>Estado</TH>
                <TH></TH>
              </tr>
            </THead>
            <TBody>
              {matches.map((match) => (
                <tr className="transition-colors hover:bg-slate-800/70" key={match.id}>
                  <TD>{formatDateTime(match.scheduledAt)}</TD>
                  <TD>{match.modality}</TD>
                  <TD>
                    {match.scoreA !== null && match.scoreB !== null ? `${match.scoreA} - ${match.scoreB}` : "Pendiente"}
                  </TD>
                  <TD>
                    <MatchStatusBadge status={match.status} />
                  </TD>
                  <TD>
                    <Link
                      className="font-semibold text-emerald-300 hover:underline"
                      href={withOrgQuery(`/matches/${match.id}`, selectedOrganization?.slug)}
                    >
                      Ver detalle
                    </Link>
                  </TD>
                </tr>
              ))}
            </TBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
