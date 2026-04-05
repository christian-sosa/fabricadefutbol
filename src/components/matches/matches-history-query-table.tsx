"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { MatchStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { useOrganizationMatchesQuery } from "@/lib/query/hooks";
import type { OrganizationMatchesResponse } from "@/lib/query/types";
import { withOrgQuery } from "@/lib/org";
import { formatDateTime } from "@/lib/utils";

type MatchesHistoryQueryTableProps = {
  organizationId: string | null;
  organizationSlug?: string | null;
  initialPage?: number;
  pageSize?: number;
  initialData?: OrganizationMatchesResponse;
};

export function MatchesHistoryQueryTable(params: MatchesHistoryQueryTableProps) {
  const { organizationId, organizationSlug, initialData } = params;
  const pageSize = params.pageSize ?? 10;
  const [page, setPage] = useState(params.initialPage ?? initialData?.pagination.page ?? 1);
  const initialPage = params.initialPage ?? initialData?.pagination.page ?? 1;

  useEffect(() => {
    setPage(initialPage);
  }, [initialPage, organizationId]);

  const { data, isFetching } = useOrganizationMatchesQuery({
    organizationId,
    page,
    pageSize,
    initialData: page === initialPage ? initialData : undefined
  });

  const matches = useMemo(() => data?.matches ?? initialData?.matches ?? [], [data, initialData]);
  const pagination = data?.pagination ?? initialData?.pagination;

  return (
    <Card>
      <div className="mb-2 text-xs text-slate-400">{isFetching ? "Actualizando historial..." : "Historial estable"}</div>
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
                <TD>{match.scoreA !== null && match.scoreB !== null ? `${match.scoreA} - ${match.scoreB}` : "Pendiente"}</TD>
                <TD>
                  <MatchStatusBadge status={match.status} />
                </TD>
                <TD>
                  <Link
                    className="font-semibold text-emerald-300 hover:underline"
                    href={withOrgQuery(`/matches/${match.id}`, organizationSlug)}
                  >
                    Ver detalle
                  </Link>
                </TD>
              </tr>
            ))}
            {!matches.length ? (
              <tr>
                <TD className="py-6 text-sm text-slate-400" colSpan={5}>
                  {isFetching ? "Cargando historial..." : "No hay partidos para esta organizacion."}
                </TD>
              </tr>
            ) : null}
          </TBody>
        </Table>
      </div>
      {pagination ? (
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-800 pt-3">
          <p className="text-xs text-slate-400">
            Pagina {pagination.page} de {Math.max(1, pagination.totalPages)} · {pagination.totalCount} partidos
          </p>
          <div className="flex items-center gap-2">
            <Button
              disabled={!pagination.hasPreviousPage || isFetching}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              type="button"
              variant="ghost"
            >
              Anterior
            </Button>
            <Button
              disabled={!pagination.hasNextPage || isFetching}
              onClick={() => setPage((current) => current + 1)}
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
