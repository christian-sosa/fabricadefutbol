import Link from "next/link";

import { OrganizationPublicNav } from "@/components/layout/organization-public-nav";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { MatchDateTime } from "@/components/matches/match-date-time";
import { MatchSubstitutesList } from "@/components/matches/match-substitutes-list";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { buildMatchHistoryHref, parseMatchHistorySeason } from "@/lib/match-history-navigation";
import { getUpcomingConfirmedMatches, getViewerAdminOrganizations, resolvePublicOrganization } from "@/lib/queries/public";
import { resolveMatchTeamLabels } from "@/lib/team-labels";
import { formatRendimiento } from "@/lib/utils";

export default async function UpcomingPage({
  searchParams
}: {
  searchParams: Promise<{ org?: string; season?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const selectedSeason = parseMatchHistorySeason(resolvedSearchParams.season);
  const [{ organizations, selectedOrganization }, viewerAdminOrganizations] = await Promise.all([
    resolvePublicOrganization(resolvedSearchParams.org),
    getViewerAdminOrganizations()
  ]);
  const upcoming = await getUpcomingConfirmedMatches(selectedOrganization?.id ?? null);
  const groupSwitcher = <OrganizationSwitcher
    basePath="/upcoming"
    currentOrganizationSlug={selectedOrganization?.slug}
    label="Elegir grupo"
    organizations={organizations}
    pickerOnly={Boolean(selectedOrganization)}
    quickOrganizations={viewerAdminOrganizations}
  />;

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <h1 className="text-2xl font-black text-slate-100 sm:text-3xl">Próximos partidos</h1>
        {selectedOrganization ? (
          <details className="rounded-xl border border-slate-800 px-3">
            <summary className="min-h-11 cursor-pointer content-center text-sm text-slate-300"><span className="font-semibold text-slate-100">{selectedOrganization.name}</span> · Cambiar grupo</summary>
            <div className="pb-3 pt-1">{groupSwitcher}</div>
          </details>
        ) : groupSwitcher}
        {selectedOrganization ? <OrganizationPublicNav className="lg:hidden" currentPath="/upcoming" organizationKey={selectedOrganization.slug} season={selectedSeason} /> : null}
      </header>

      {upcoming.length ? (
        <div className="space-y-4">
          {upcoming.map((item) => {
            const teamLabels = resolveMatchTeamLabels(item.match);
            return (
              <Card key={item.match.id}>
                <CardTitle>
                  <MatchDateTime value={item.match.scheduled_at} />
                </CardTitle>
                <CardDescription className="mt-1">{item.match.modality} · {item.match.location || "Cancha por confirmar"}</CardDescription>
                <p className="mt-4 text-lg font-bold text-slate-100">{teamLabels.teamA} <span className="px-1 text-sm font-normal text-slate-400">vs.</span> {teamLabels.teamB}</p>
                <details className="mt-3 border-t border-slate-800">
                  <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-slate-300">Ver jugadores</summary>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                    <p className="mb-2 text-sm font-semibold text-slate-300">{teamLabels.teamA}</p>
                    <ul className="space-y-2 text-sm">
                      {item.teamAPlayers.map((player) => (
                        <li className="flex items-center justify-between gap-3" key={player.id}>
                          <div className="flex items-center gap-2">
                            <PlayerAvatar hasPhoto={Boolean(player.photo_path)} name={player.full_name} photoUpdatedAt={player.photo_updated_at} playerId={player.is_guest ? undefined : player.id} size="sm" />
                            <span className="flex items-center gap-2">
                              {player.full_name}
                              {player.is_guest ? (
                                <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-300">
                                  Invitado
                                </span>
                              ) : null}
                              {item.match.goalkeeper_player_ids?.includes(player.id) ? <span className="text-xs text-slate-400">Arquero</span> : null}
                            </span>
                          </div>
                          {!player.is_guest ? <span className="font-semibold text-emerald-300">{formatRendimiento(player.current_rating)}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                    <p className="mb-2 text-sm font-semibold text-slate-300">{teamLabels.teamB}</p>
                    <ul className="space-y-2 text-sm">
                      {item.teamBPlayers.map((player) => (
                        <li className="flex items-center justify-between gap-3" key={player.id}>
                          <div className="flex items-center gap-2">
                            <PlayerAvatar hasPhoto={Boolean(player.photo_path)} name={player.full_name} photoUpdatedAt={player.photo_updated_at} playerId={player.is_guest ? undefined : player.id} size="sm" />
                            <span className="flex items-center gap-2">
                              {player.full_name}
                              {player.is_guest ? (
                                <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-300">
                                  Invitado
                                </span>
                              ) : null}
                              {item.match.goalkeeper_player_ids?.includes(player.id) ? <span className="text-xs text-slate-400">Arquero</span> : null}
                            </span>
                          </div>
                          {!player.is_guest ? <span className="font-semibold text-emerald-300">{formatRendimiento(player.current_rating)}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <MatchSubstitutesList players={item.substitutes ?? []} teamLabels={teamLabels} />
                </details>
                <Link
                  className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-emerald-300 hover:underline"
                  href={buildMatchHistoryHref({ matchId: item.match.id, organizationSlug: selectedOrganization?.slug, season: selectedSeason })}
                >
                  Ver detalle completo
                </Link>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardTitle>Todavía no hay partidos confirmados</CardTitle>
          <CardDescription className="mt-2">Cuando el organizador confirme los equipos, vas a ver el próximo partido acá.</CardDescription>
        </Card>
      )}
    </div>
  );
}
