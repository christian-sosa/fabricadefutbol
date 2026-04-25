import Link from "next/link";
import { notFound } from "next/navigation";

import { saveCompetitionMatchSheetAction } from "@/app/admin/(panel)/tournaments/[id]/competitions/[competitionId]/actions";
import { TournamentMatchSheetEditor } from "@/components/admin/tournament-match-sheet-editor";
import { TournamentMatchStatusBadge } from "@/components/tournaments/tournament-badges";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireAdminCompetition } from "@/lib/auth/tournaments";
import { getAdminCompetitionMatchSheetData } from "@/lib/queries/tournaments";
import { formatDateTime } from "@/lib/utils";
import type { TournamentMatchStatus } from "@/types/domain";

function formatScheduledAt(value: string | null) {
  return value ? formatDateTime(value) : "Sin horario cargado";
}

function getPhaseLabel(phase: "league" | "cup") {
  return phase === "cup" ? "Fase copa" : "Fase liga";
}

export default async function AdminCompetitionMatchSheetPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string; competitionId: string; matchId: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const [{ id, competitionId, matchId }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  await requireAdminCompetition({ leagueId: id, competitionId });
  const data = await getAdminCompetitionMatchSheetData({
    leagueId: id,
    competitionId,
    matchId
  });

  if (!data) notFound();

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>
              {data.match.homeTeamName} vs {data.match.awayTeamName}
            </CardTitle>
            <CardDescription className="mt-1">
              {data.competition.name} · {data.league.name}
            </CardDescription>
            <div className="mt-2 space-y-1 text-sm text-slate-400">
              <p>
                {formatScheduledAt(data.match.scheduledAt)} ·{" "}
                {data.match.venue || data.competition.venueOverride || data.league.venueName || "Sin sede"}
              </p>
              <p>
                {getPhaseLabel(data.match.phase)} · {data.match.stageLabel}
              </p>
            </div>
          </div>
          <TournamentMatchStatusBadge status={data.match.status as TournamentMatchStatus} />
        </div>
        {resolvedSearchParams.error ? <p className="mt-3 text-sm font-semibold text-danger">{resolvedSearchParams.error}</p> : null}
        {resolvedSearchParams.success ? <p className="mt-3 text-sm font-semibold text-emerald-300">{resolvedSearchParams.success}</p> : null}
      </Card>

      <Card>
        <CardTitle>Acta del partido</CardTitle>
        <CardDescription>
          {data.competition.coverageMode === "results_only"
            ? "Carga marcador y notas. Esta competencia esta configurada para trabajar solo con resultados."
            : "Carga marcador, notas y estadisticas si las tienes. La figura del partido es opcional y puedes agregar nombres libres si el jugador no estaba cargado."}
        </CardDescription>
        <div className="mt-4">
          <TournamentMatchSheetEditor
            action={saveCompetitionMatchSheetAction.bind(null, id, competitionId, matchId)}
            allowDetailedStats={data.competition.coverageMode !== "results_only"}
            awayTeam={{ id: data.match.awayTeamId!, name: data.match.awayTeamName! }}
            defaultAwayScore={data.result?.away_score ?? data.match.awayScore ?? 0}
            defaultHomeScore={data.result?.home_score ?? data.match.homeScore ?? 0}
            defaultNotes={data.result?.notes ?? ""}
            defaultPenaltyAwayScore={data.result?.penalty_away_score ?? null}
            defaultPenaltyHomeScore={data.result?.penalty_home_score ?? null}
            extraStats={data.extraStats}
            homeTeam={{ id: data.match.homeTeamId!, name: data.match.homeTeamName! }}
            registeredPlayers={data.registeredPlayers}
            requiresShootout={data.match.phase === "cup"}
          />
        </div>
      </Card>

      <div className="flex flex-wrap gap-4">
        <Link className="text-sm font-semibold text-slate-300 hover:underline" href={`/admin/tournaments/${id}/competitions/${competitionId}?tab=results`}>
          Volver a resultados
        </Link>
        <Link className="text-sm font-semibold text-emerald-300 hover:underline" href={`/tournaments/${data.league.slug}/${data.competition.slug}/matches/${matchId}`}>
          Ver pagina publica del partido
        </Link>
      </div>
    </div>
  );
}
