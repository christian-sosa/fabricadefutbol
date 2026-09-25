import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MatchStatusBadge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { WhatsAppShareButton } from "@/components/matches/whatsapp-share-button";
import { PublicGroupGrowthCta } from "@/components/groups/public-group-growth-cta";
import { OrganizationPublicNav } from "@/components/layout/organization-public-nav";
import { MatchDateTime } from "@/components/matches/match-date-time";
import { MatchSubstitutesList } from "@/components/matches/match-substitutes-list";
import { formatMatchDateTime } from "@/lib/match-datetime";
import { buildMatchHistoryHref, parseMatchHistoryPage, parseMatchHistorySeason } from "@/lib/match-history-navigation";
import { withShareTracking } from "@/lib/growth";
import { withOrgQuery } from "@/lib/org";
import { buildAbsolutePublicUrl } from "@/lib/public-url";
import { getMatchDetails, type PublicMatchSubstitute } from "@/lib/queries/public";
import { resolveMatchTeamLabels } from "@/lib/team-labels";
import { formatRendimiento } from "@/lib/utils";
import { FormationPitch } from "@/components/matches/formation-pitch";
import { readMatchFormation, toFormationPlayers } from "@/lib/domain/match-formation";

export async function generateMetadata({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ org?: string }>;
}): Promise<Metadata> {
  try {
    const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
    const details = await getMatchDetails(id, resolvedSearchParams.org);
    if (!details) return { title: "Partido no encontrado" };
    const title = `Partido ${formatMatchDateTime(details.match.scheduled_at)}`;
    const description = `Detalle del partido ${details.match.modality} en Fabrica de Futbol.`;
    return {
      title,
      description,
      openGraph: { title, description },
      twitter: { title, description }
    };
  } catch {
    return { title: "Partido" };
  }
}

export default async function MatchDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ org?: string; season?: string; page?: string; view?: string }>;
}) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const details = await getMatchDetails(id, resolvedSearchParams.org);
  if (!details) notFound();
  const publicMatchPath = withOrgQuery(`/matches/${id}`, resolvedSearchParams.org);
  const publicMatchUrl = buildAbsolutePublicUrl(withShareTracking(publicMatchPath, "match"));
  const teamLabels = resolveMatchTeamLabels(details.match);
  const showCurrentRendimiento = details.match.status !== "finished" && !details.result;
  const formationTeams = {
    teamA: toFormationPlayers(details.teamAPlayers, details.match.goalkeeper_player_ids),
    teamB: toFormationPlayers(details.teamBPlayers, details.match.goalkeeper_player_ids)
  };
  const formation = readMatchFormation(details.match.formation_data, details.match.modality, formationTeams);
  const substitutes = details.substitutes ?? [];
  // A pitch shows only the starting positions; keep every additional participant visible.
  const formationExtras: PublicMatchSubstitute[] = formation ? (["A", "B"] as const).flatMap((side) => {
    const key = side === "A" ? "teamA" : "teamB";
    const onPitch = new Set(formation[key].slots.map((slot) => slot.participantId));
    return (side === "A" ? details.teamAPlayers : details.teamBPlayers)
      .filter((player) => !onPitch.has(toFormationPlayers([player])[0].participantId))
      .map((player) => ({ ...player, team: side }));
  }) : [];

  return (
    <div className="space-y-4">
      <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-300 hover:underline" href={buildMatchHistoryHref({
        organizationSlug: resolvedSearchParams.org,
        season: resolvedSearchParams.season,
        page: parseMatchHistoryPage(resolvedSearchParams.page),
        view: resolvedSearchParams.view
      })}>
        {resolvedSearchParams.view === "calendar" ? "Volver al calendario" : "Volver al historial"}
      </Link>
      {resolvedSearchParams.org ? <OrganizationPublicNav className="lg:hidden" currentPath="/matches" organizationKey={resolvedSearchParams.org} season={parseMatchHistorySeason(resolvedSearchParams.season)} /> : null}
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-slate-100 sm:text-2xl">{details.result ? "Resultado del partido" : "Detalle del partido"}</h1>
              <MatchStatusBadge status={details.match.status} />
            </div>
            <p className="mt-2 text-sm text-slate-400"><MatchDateTime value={details.match.scheduled_at} /> · {details.match.modality}</p>
            {details.match.location ? <p className="mt-1 text-sm text-slate-400">{details.match.location}</p> : null}
          </div>
          {details.match.status === "confirmed" ? (
            <WhatsAppShareButton
              className="w-full sm:w-auto"
              matchUrl={publicMatchUrl}
              teamAName={teamLabels.teamA}
              teamBName={teamLabels.teamB}
              substitutes={[...substitutes, ...formationExtras].map((player) => ({ name: player.full_name, team: player.team }))}
            />
          ) : null}
        </div>
        <div aria-label={details.result ? `${teamLabels.teamA} ${details.result.score_a}, ${teamLabels.teamB} ${details.result.score_b}` : `${teamLabels.teamA} contra ${teamLabels.teamB}`} className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 text-center sm:gap-6" role="group">
          <p className="break-words text-base font-bold text-slate-100 sm:text-xl">{teamLabels.teamA}</p>
          <p className="whitespace-nowrap text-4xl font-black tabular-nums tracking-tight text-slate-100 sm:text-5xl">
            {details.result ? <>{details.result.score_a}<span className="px-2 text-slate-500">–</span>{details.result.score_b}</> : <span className="text-xl font-semibold text-slate-400">vs.</span>}
          </p>
          <p className="break-words text-base font-bold text-slate-100 sm:text-xl">{teamLabels.teamB}</p>
        </div>
        <p className="mt-3 text-center text-sm text-slate-400">
          {details.result
            ? details.result.winner_team === "DRAW" ? "Empate" : `Ganó ${details.result.winner_team === "A" ? teamLabels.teamA : teamLabels.teamB}`
            : details.match.status === "cancelled" ? "Partido cancelado" : "Resultado pendiente."}
        </p>
        {details.result?.mvp_display_name ? (
          <div className="mt-4 border-t border-slate-800 pt-3 text-center">
            <p className="text-sm font-semibold text-amber-200">Figura del partido: {details.result.mvp_display_name}</p>
            <p className="mt-1 text-xs text-slate-400">Distinción opcional. No suma puntos.</p>
          </div>
        ) : null}
        {details.result?.notes ? <p className="mt-4 whitespace-pre-line border-t border-slate-800 pt-3 text-sm text-slate-300">{details.result.notes}</p> : null}
      </Card>

      <Card>
        <CardTitle>Equipos confirmados</CardTitle>
        {formation ? (
          <div className="mt-3 grid min-w-0 gap-5 lg:grid-cols-2">
            <FormationPitch formation={formation.teamA} players={formationTeams.teamA} side="A" teamLabel={teamLabels.teamA} />
            <FormationPitch formation={formation.teamB} players={formationTeams.teamB} side="B" teamLabel={teamLabels.teamB} />
          </div>
        ) : (
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <p className="mb-2 text-sm font-semibold text-slate-300">{teamLabels.teamA}</p>
            <ul className="space-y-2 text-sm">
              {details.teamAPlayers.map((player) => (
                <li className="flex items-center justify-between gap-3" key={player.id}>
                  <span className="flex items-center gap-2">
                    <PlayerAvatar hasPhoto={Boolean(player.photo_path)} name={player.full_name} photoUpdatedAt={player.photo_updated_at} playerId={player.is_guest ? undefined : player.id} size="sm" />
                    {player.full_name}
                    {player.is_guest ? (
                      <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-300">
                        Invitado
                      </span>
                    ) : null}
                    {details.match.goalkeeper_player_ids?.includes(player.id) ? <span className="text-xs text-slate-400">Arquero</span> : null}
                  </span>
                  {showCurrentRendimiento && !player.is_guest ? <span className="font-semibold text-emerald-300">{formatRendimiento(player.current_rating)}</span> : null}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <p className="mb-2 text-sm font-semibold text-slate-300">{teamLabels.teamB}</p>
            <ul className="space-y-2 text-sm">
              {details.teamBPlayers.map((player) => (
                <li className="flex items-center justify-between gap-3" key={player.id}>
                  <span className="flex items-center gap-2">
                    <PlayerAvatar hasPhoto={Boolean(player.photo_path)} name={player.full_name} photoUpdatedAt={player.photo_updated_at} playerId={player.is_guest ? undefined : player.id} size="sm" />
                    {player.full_name}
                    {player.is_guest ? (
                      <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-300">
                        Invitado
                      </span>
                    ) : null}
                    {details.match.goalkeeper_player_ids?.includes(player.id) ? <span className="text-xs text-slate-400">Arquero</span> : null}
                  </span>
                  {showCurrentRendimiento && !player.is_guest ? <span className="font-semibold text-emerald-300">{formatRendimiento(player.current_rating)}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
        )}
        <MatchSubstitutesList players={formationExtras} teamLabels={teamLabels} title={details.result ? "También jugaron" : "Suplentes con equipo"} />
        <MatchSubstitutesList players={substitutes} teamLabels={teamLabels} />
      </Card>

      <PublicGroupGrowthCta source="match_detail" />
    </div>
  );
}
