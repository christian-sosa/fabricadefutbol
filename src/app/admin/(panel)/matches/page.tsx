import Link from "next/link";

import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { MatchStatusBadge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getOrganizationWriteAccess, requireAdminOrganization } from "@/lib/auth/admin";
import { formatMatchDateTime } from "@/lib/match-datetime";
import { withOrgQuery } from "@/lib/org";
import { getAdminMatches } from "@/lib/queries/admin";

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
        <CardTitle>Grupo activo: {selectedOrganization.name}</CardTitle>
        <div className="mt-3">
          <OrganizationSwitcher
            basePath="/admin/matches"
            currentOrganizationSlug={selectedOrganization.slug}
            label="Cambiar grupo"
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
            matches.map((match) => {
              const editHref = withOrgQuery(`/admin/matches/${match.id}`, selectedOrganization.slug);
              const canLoadResult = match.status === "confirmed" || match.status === "finished";

              return (
                <div
                  className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 md:flex-row md:items-center md:justify-between"
                  key={match.id}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-100">
                      {formatMatchDateTime(match.scheduled_at)} - {match.modality}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {match.location?.trim() ? match.location : "Sin ubicacion cargada"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <MatchStatusBadge status={match.status} />
                    {writeAccess.canWrite ? (
                      <>
                        {canLoadResult ? (
                          <Link
                            className="inline-flex items-center justify-center rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                            href={`${editHref}#resultado`}
                          >
                            Cargar resultado
                          </Link>
                        ) : null}
                        <Link
                          className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-emerald-400/60 hover:text-emerald-300"
                          href={editHref}
                        >
                          Editar
                        </Link>
                      </>
                    ) : (
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Solo lectura
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-slate-400">Todavia no hay partidos cargados para este grupo.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
