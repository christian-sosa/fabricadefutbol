import Link from "next/link";
import { notFound } from "next/navigation";

import { CreateCompetitionCard } from "@/components/admin/create-competition-card";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireAdminLeague } from "@/lib/auth/tournaments";
import { getAdminLeagueDetails } from "@/lib/queries/tournaments";

export default async function NewCompetitionPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdminLeague(id);
  const details = await getAdminLeagueDetails(id);

  if (!details) notFound();

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Nueva competencia</CardTitle>
            <CardDescription className="mt-2">
              Agrega una competencia dentro de {details.league.name}. Quedara publica para visitantes cuando la liga y la competencia esten activas.
            </CardDescription>
          </div>
          <Link
            className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:border-emerald-400/60 hover:text-emerald-300"
            href={`/admin/tournaments/${id}?tab=competitions`}
          >
            Volver
          </Link>
        </div>
      </Card>

      <CreateCompetitionCard leagueId={id} leagueTeams={details.leagueTeams} title="Datos de la competencia" />
    </div>
  );
}
