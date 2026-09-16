"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { MatchStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { MatchDateTime } from "@/components/matches/match-date-time";
import { buildMatchHistoryHref, parseMatchHistoryPage } from "@/lib/match-history-navigation";
import { useOrganizationMatchesQuery } from "@/lib/query/hooks";
import type { OrganizationMatchesResponse } from "@/lib/query/types";
import { QueryFeedback } from "@/components/ui/query-feedback";
import { resolveMatchTeamLabels } from "@/lib/team-labels";

type MatchesHistoryQueryTableProps = {
  organizationId: string | null;
  organizationSlug?: string | null;
  initialPage?: number;
  pageSize?: number;
  initialData?: OrganizationMatchesResponse;
  season?: string;
};

export function MatchesHistoryQueryTable(params: MatchesHistoryQueryTableProps) {
  const { organizationId, organizationSlug, initialData } = params;
  const pageSize = params.pageSize ?? 10;
  const season = params.season ?? "current";
  const searchParams = useSearchParams();
  const page = parseMatchHistoryPage(searchParams.get("page"));
  const initialPage = params.initialPage ?? initialData?.pagination.page ?? 1;

  const { data, isFetching, isError, refetch } = useOrganizationMatchesQuery({
    organizationId,
    page,
    pageSize,
    season,
    initialData: page === initialPage && initialData?.organizationId === organizationId ? initialData : undefined
  });

  const matches = data?.matches ?? [];
  const pagination = data?.pagination;
  const outsideRange = Boolean(pagination && pagination.page === page && page > Math.max(1, pagination.totalPages));
  const goToPage = (nextPage: number) => {
    const search = new URLSearchParams(searchParams.toString());
    if (nextPage === 1) search.delete("page");
    else search.set("page", String(nextPage));
    const query = search.toString();
    window.history.pushState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  };
  const detailHref = (matchId: string) => buildMatchHistoryHref({
    matchId, organizationSlug, season, page: pagination?.page ?? page
  });

  return (
    <Card>
      <QueryFeedback error={isError} fetching={isFetching} hasData={Boolean(matches.length)} onRetry={refetch} />

      <div className="grid gap-3 md:hidden">
        {matches.map((match) => {
          const teamLabels = resolveMatchTeamLabels(match);
          const hasResult = match.scoreA !== null && match.scoreB !== null;
          return (
          <article className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/70 p-4" key={match.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <MatchDateTime className="text-sm font-medium text-slate-300" value={match.scheduledAt} />
                <p className="mt-1 text-xs text-slate-400">{match.modality}</p>
              </div>
              <MatchStatusBadge status={match.status} />
            </div>

            <div aria-label={hasResult ? `${teamLabels.teamA} ${match.scoreA}, ${teamLabels.teamB} ${match.scoreB}` : `${teamLabels.teamA} contra ${teamLabels.teamB}`} className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 text-center" role="group">
              <p className="break-words text-sm font-semibold text-slate-100">{teamLabels.teamA}</p>
              <p className="whitespace-nowrap text-2xl font-black tabular-nums text-slate-100">{hasResult ? `${match.scoreA} – ${match.scoreB}` : <span className="text-sm font-medium text-slate-400">vs.</span>}</p>
              <p className="break-words text-sm font-semibold text-slate-100">{teamLabels.teamB}</p>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <div className="min-w-0 flex-1 basis-40">{match.mvpDisplayName ? <p className="break-words text-xs text-amber-200">Figura: {match.mvpDisplayName}</p> : null}</div>
              <Link
                className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-emerald-300 hover:underline"
                href={detailHref(match.id)}
              >
                Ver detalle
              </Link>
            </div>
          </article>
        );})}

        {!matches.length && !isError ? (
          <p className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-6 text-sm text-slate-400">
            {isFetching ? "Cargando historial..." : outsideRange ? "No hay partidos en esta página." : "No hay partidos para este grupo."}
          </p>
        ) : null}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <Table>
          <THead>
            <tr>
              <TH>Fecha</TH>
              <TH>Modalidad</TH>
              <TH>Resultado</TH>
              <TH>Figura</TH>
              <TH>Estado</TH>
              <TH></TH>
            </tr>
          </THead>
          <TBody>
            {matches.map((match) => {
              const teamLabels = resolveMatchTeamLabels(match);
              return (
              <tr className="transition-colors hover:bg-slate-800/70" key={match.id}>
                <TD><MatchDateTime value={match.scheduledAt} /></TD>
                <TD>{match.modality}</TD>
                <TD><span className="font-medium text-slate-100">{teamLabels.teamA} <strong className="whitespace-nowrap px-1 tabular-nums">{match.scoreA !== null && match.scoreB !== null ? `${match.scoreA} – ${match.scoreB}` : "vs."}</strong> {teamLabels.teamB}</span></TD>
                <TD>{match.mvpDisplayName ?? "-"}</TD>
                <TD>
                  <MatchStatusBadge status={match.status} />
                </TD>
                <TD>
                  <Link
                    className="font-semibold text-emerald-300 hover:underline"
                    href={detailHref(match.id)}
                  >
                    Ver detalle
                  </Link>
                </TD>
              </tr>
            );})}

            {!matches.length && !isError ? (
              <tr>
                <TD className="py-6 text-sm text-slate-400" colSpan={6}>
                  {isFetching ? "Cargando historial..." : outsideRange ? "No hay partidos en esta página." : "No hay partidos para este grupo."}
                </TD>
              </tr>
            ) : null}
          </TBody>
        </Table>
      </div>

      {(pagination?.totalPages ?? 0) > 1 || page > 1 ? (
        <div className="mt-4 flex flex-col gap-3 border-t border-slate-800 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-400">
            {pagination
              ? outsideRange
                ? `Página ${page} · ${pagination.totalCount} partidos`
                : `Página ${pagination.page} de ${Math.max(1, pagination.totalPages)} · ${pagination.totalCount} partidos`
              : `Página ${page}`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {outsideRange ? <Button disabled={isFetching} onClick={() => goToPage(1)} type="button" variant="secondary">Volver al inicio del historial</Button> : null}
            <Button
              disabled={page <= 1 || isFetching}
              onClick={() => goToPage(Math.max(1, page - 1))}
              type="button"
              variant="ghost"
            >
              Anterior
            </Button>
            <Button
              disabled={!pagination?.hasNextPage || pagination.page !== page || isFetching}
              onClick={() => goToPage(page + 1)}
              type="button"
              variant="ghost"
            >
              Siguiente
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
