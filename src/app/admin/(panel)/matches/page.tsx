import Link from "next/link";

import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { MatchStatusBadge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getOrganizationWriteAccess, requireAdminOrganization } from "@/lib/auth/admin";
import { withOrgQuery } from "@/lib/org";
import { getAdminMatches } from "@/lib/queries/admin";
import { formatDateTime } from "@/lib/utils";

export default async function AdminMatchesPage({
  searchParams
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const { admin, organizations, selectedOrganization } = await requireAdminOrganization(resolvedSearchParams.org);
  const writeAccess = await getOrganizationWriteAccess(admin, selectedOrganization.id);
  const matches = await getAdminMatches(selectedOrganization.id);

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Organizacion activa: {selectedOrganization.name}</CardTitle>
        <div className="mt-3">
          <OrganizationSwitcher
            basePath="/admin/matches"
            currentOrganizationSlug={selectedOrganization.slug}
            label="Cambiar organizacion"
            organizations={organizations}
          />
        </div>
      </Card>

      <Card>
        <CardTitle>Gestionar partidos</CardTitle>
        <CardDescription>
          Revisa partidos en borrador, confirmados o finalizados y entra a cada uno para editarlo.
        </CardDescription>

        <div className="mt-4 space-y-3">
          {matches.length ? (
            matches.map((match) => (
              <div
                className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 md:flex-row md:items-center md:justify-between"
                key={match.id}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-100">
                    {formatDateTime(match.scheduled_at)} - {match.modality}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {match.location?.trim() ? match.location : "Sin ubicacion cargada"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <MatchStatusBadge status={match.status} />
                  {writeAccess.canWrite ? (
                    <Link
                      className="text-sm font-semibold text-emerald-300 hover:underline"
                      href={withOrgQuery(`/admin/matches/${match.id}`, selectedOrganization.slug)}
                    >
                      Gestionar
                    </Link>
                  ) : (
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Solo lectura
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400">Todavia no hay partidos cargados para esta organizacion.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
