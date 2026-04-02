import Link from "next/link";

import { MatchStatusBadge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getAdminDashboardData } from "@/lib/queries/admin";
import { formatDateTime } from "@/lib/utils";

export default async function AdminDashboardPage() {
  const data = await getAdminDashboardData();

  return (
    <div className="space-y-4">
      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardDescription>Partidos en borrador</CardDescription>
          <CardTitle className="mt-1 text-3xl">{data.draftsCount}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Partidos confirmados</CardDescription>
          <CardTitle className="mt-1 text-3xl">{data.confirmedCount}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Partidos finalizados</CardDescription>
          <CardTitle className="mt-1 text-3xl">{data.finishedCount}</CardTitle>
        </Card>
      </section>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <CardTitle>Ultimos partidos</CardTitle>
          <Link className="text-sm font-semibold text-emerald-300 hover:underline" href="/admin/matches/new">
            Crear nuevo partido
          </Link>
        </div>
        <div className="space-y-2">
          {data.latestMatches.map((match) => (
            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm" key={match.id}>
              <span>
                {formatDateTime(match.scheduled_at)} - {match.modality}
              </span>
              <div className="flex items-center gap-3">
                <MatchStatusBadge status={match.status} />
                <Link className="font-semibold text-emerald-300 hover:underline" href={`/admin/matches/${match.id}`}>
                  Gestionar
                </Link>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
