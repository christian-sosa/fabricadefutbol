"use client";

import Link from "next/link";
import { useMemo } from "react";

import { MatchStatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { useOrganizationMatchesQuery } from "@/lib/query/hooks";
import type { MatchHistoryItem } from "@/lib/query/types";
import { withOrgQuery } from "@/lib/org";
import { formatDateTime } from "@/lib/utils";

type MatchesHistoryQueryTableProps = {
  organizationId: string | null;
  organizationSlug?: string | null;
  initialMatches?: MatchHistoryItem[];
};

export function MatchesHistoryQueryTable(params: MatchesHistoryQueryTableProps) {
  const { organizationId, organizationSlug, initialMatches } = params;
  const { data, isFetching } = useOrganizationMatchesQuery({
    organizationId,
    initialData: initialMatches
  });

  const matches = useMemo(() => data ?? initialMatches ?? [], [data, initialMatches]);

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
    </Card>
  );
}
