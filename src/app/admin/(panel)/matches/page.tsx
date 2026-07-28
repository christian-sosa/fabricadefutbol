import Link from "next/link";

import { AdminCurrentGroupCard } from "@/components/admin/admin-current-group-card";
import { MatchStatusBadge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getAdminMatchListActions } from "@/lib/admin-match-actions";
import { getOrganizationWriteAccess, requireAdminOrganization } from "@/lib/auth/admin";
import { formatMatchDateTime } from "@/lib/match-datetime";
import { withOrgQuery } from "@/lib/org";
import { getAdminMatches } from "@/lib/queries/admin";

export default async function AdminMatchesPage({
  searchParams
}: {
  searchParams: Promise<{ org?: string; view?: string; success?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const { admin, selectedOrganization } = await requireAdminOrganization(resolvedSearchParams.org);
  const writeAccess = await getOrganizationWriteAccess(admin, selectedOrganization.id);
  const matches = await getAdminMatches(selectedOrganization.id);
  const createHref = withOrgQuery("/admin/matches/new", selectedOrganization.slug);
  const pendingResultMatch = matches.find((match) => getAdminMatchListActions(match.status).canLoadResult) ?? null;
  const pendingResultHref = pendingResultMatch
    ? withOrgQuery(`/admin/matches/${pendingResultMatch.id}/result`, selectedOrganization.slug)
    : null;
  const showLoadedMatches = resolvedSearchParams.view === "edit";
  const editExistingHref = withOrgQuery("/admin/matches?view=edit", selectedOrganization.slug);
  const matchStatusCounts = {
    draft: matches.filter((match) => match.status === "draft").length,
    confirmed: matches.filter((match) => match.status === "confirmed").length,
    finished: matches.filter((match) => match.status === "finished").length,
    cancelled: matches.filter((match) => match.status === "cancelled").length
  };

  return (
    <div className="space-y-4">
      <AdminCurrentGroupCard admin={admin} organization={selectedOrganization} />

      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Partidos</CardTitle>
            <CardDescription className="mt-1">
              Gestiona altas, resultados y cambios sobre los partidos del grupo.
            </CardDescription>
          </div>
          {writeAccess.canWrite ? (
            <div className="flex flex-wrap gap-2">
              <Link
                className="inline-flex items-center justify-center rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                href={createHref}
              >
                Crear partido
              </Link>
              {pendingResultHref && pendingResultMatch ? (
                <Link
                  className="inline-flex items-center justify-center rounded-md border border-emerald-400/50 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/15"
                  href={pendingResultHref}
                >
                  Cargar resultado pendiente
                </Link>
              ) : null}
              {matches.length ? (
                <Link
                  className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-emerald-400/60 hover:text-emerald-300"
                  href={editExistingHref}
                >
                  Editar existentes
                </Link>
              ) : null}
            </div>
          ) : (
            <span className="w-fit rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Solo lectura
            </span>
          )}
        </div>

        {pendingResultMatch ? (
          <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
            <span className="font-semibold">Pendiente de resultado:</span>{" "}
            {formatMatchDateTime(pendingResultMatch.scheduled_at)} - {pendingResultMatch.modality}
          </div>
        ) : null}

        {resolvedSearchParams.success ? (
          <div className="mt-4 rounded-md border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100">
            {resolvedSearchParams.success}
          </div>
        ) : null}
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardDescription>Borradores</CardDescription>
          <CardTitle className="mt-1 text-3xl">{matchStatusCounts.draft}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Confirmados</CardDescription>
          <CardTitle className="mt-1 text-3xl">{matchStatusCounts.confirmed}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Finalizados</CardDescription>
          <CardTitle className="mt-1 text-3xl">{matchStatusCounts.finished}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Cancelados</CardDescription>
          <CardTitle className="mt-1 text-3xl">{matchStatusCounts.cancelled}</CardTitle>
        </Card>
      </section>

      {showLoadedMatches ? (
        <Card>
          <CardTitle id="partidos-cargados">Partidos cargados</CardTitle>
          <CardDescription>
            Revisa partidos en borrador, confirmados o finalizados y entra a cada uno para editarlo.
          </CardDescription>

          <div className="mt-4 space-y-3">
            {matches.length ? (
              matches.map((match) => {
                const editHref = withOrgQuery(`/admin/matches/${match.id}`, selectedOrganization.slug);
                const resultHref = withOrgQuery(`/admin/matches/${match.id}/result`, selectedOrganization.slug);
                const { canCorrectResult, canLoadResult } = getAdminMatchListActions(match.status);

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
                              href={resultHref}
                            >
                              Cargar resultado
                            </Link>
                          ) : null}
                          {canCorrectResult ? (
                            <Link
                              className="inline-flex items-center justify-center rounded-md border border-emerald-400/50 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/15"
                              href={resultHref}
                            >
                              Corregir resultado
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
      ) : null}
    </div>
  );
}
