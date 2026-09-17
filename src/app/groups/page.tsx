import Link from "next/link";

import { GroupShareActions } from "@/components/groups/group-share-actions";
import { OrganizationImage } from "@/components/groups/organization-image";
import { PublicGroupGrowthCta } from "@/components/groups/public-group-growth-cta";
import { OrganizationPublicNav } from "@/components/layout/organization-public-nav";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { MatchDateTime } from "@/components/matches/match-date-time";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { withShareTracking } from "@/lib/growth";
import { buildMatchHistoryHref, parseMatchHistorySeason } from "@/lib/match-history-navigation";
import { getOrganizationImageUrl } from "@/lib/organization-images";
import { withOrgQuery } from "@/lib/org";
import { buildAbsolutePublicUrl } from "@/lib/public-url";
import { getHomeSummary, getViewerAdminOrganizations, resolvePublicOrganization } from "@/lib/queries/public";
import { formatRendimiento } from "@/lib/utils";

export default async function GroupsPage({ searchParams }: {
  searchParams: Promise<{ org?: string; season?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const selectedSeason = parseMatchHistorySeason(resolvedSearchParams.season);
  const [{ organizations, selectedOrganization }, viewerAdminOrganizations] = await Promise.all([
    resolvePublicOrganization(resolvedSearchParams.org, { defaultContext: "home" }),
    getViewerAdminOrganizations()
  ]);
  const summary = await getHomeSummary(selectedOrganization?.id ?? null);
  const groupShareUrl = selectedOrganization
    ? buildAbsolutePublicUrl(withShareTracking(withOrgQuery("/groups", selectedOrganization.slug), "group"))
    : null;
  const rankingShareUrl = selectedOrganization
    ? buildAbsolutePublicUrl(withShareTracking(withOrgQuery("/ranking", selectedOrganization.slug), "ranking"))
    : null;
  const groupSwitcher = (
    <OrganizationSwitcher
      basePath="/groups"
      currentOrganizationSlug={selectedOrganization?.slug}
      label="Grupos públicos"
      organizations={organizations}
      pickerOnly={Boolean(selectedOrganization)}
      quickOrganizations={viewerAdminOrganizations}
    />
  );

  return (
    <div className="space-y-5">
      {selectedOrganization ? (
        <>
          <header className="space-y-4">
            <div className="flex items-center gap-4">
              <OrganizationImage
                alt={`Imagen de ${selectedOrganization.name}`}
                className="h-20 w-20 shrink-0 rounded-2xl sm:h-24 sm:w-24"
                priority
                src={getOrganizationImageUrl(selectedOrganization.id)}
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tu grupo</p>
                <h1 className="mt-1 break-words text-2xl font-black text-slate-100 sm:text-3xl">{selectedOrganization.name}</h1>
                <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
                  <div className="flex gap-1"><dt>jugadores</dt><dd className="order-first font-semibold text-slate-100">{summary.totalPlayers}</dd></div>
                  <div className="flex gap-1"><dt>partidos jugados</dt><dd className="order-first font-semibold text-slate-100">{summary.totalFinishedMatches}</dd></div>
                </dl>
              </div>
            </div>
            <details className="rounded-xl border border-slate-800 px-3">
              <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-slate-300">Cambiar grupo</summary>
              <div className="pb-3 pt-1">{groupSwitcher}</div>
            </details>
            <OrganizationPublicNav className="lg:hidden" currentPath="/groups" organizationKey={selectedOrganization.slug} season={selectedSeason} />
          </header>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Próximos partidos</CardTitle>
                <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-300 hover:underline" href={withOrgQuery(`/upcoming${selectedSeason !== "current" ? `?season=${encodeURIComponent(selectedSeason)}` : ""}`, selectedOrganization.slug)}>Ver todos</Link>
              </div>
              <div className="mt-2 space-y-2">
                {summary.upcomingMatches.length ? summary.upcomingMatches.map((match) => (
                  <Link
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 px-3 py-3 transition hover:border-slate-600 hover:bg-slate-800"
                    href={buildMatchHistoryHref({ matchId: match.id, organizationSlug: selectedOrganization.slug, season: selectedSeason })}
                    key={match.id}
                  >
                    <span className="min-w-0">
                      <MatchDateTime className="block text-sm font-semibold text-slate-100" value={match.scheduled_at} />
                      <span className="mt-1 block text-xs text-slate-400">{match.modality} · Equipos confirmados</span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-emerald-300">Ver partido</span>
                  </Link>
                )) : (
                  <div className="py-2">
                    <p className="text-sm text-slate-400">Todavía no hay un próximo partido confirmado.</p>
                    <Link className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-emerald-300 hover:underline" href={buildMatchHistoryHref({ organizationSlug: selectedOrganization.slug, season: selectedSeason })}>Ver últimos resultados</Link>
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Ranking actual</CardTitle>
                  <CardDescription className="mt-1">Los primeros del grupo.</CardDescription>
                </div>
                <Link className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-emerald-300 hover:underline" href={withOrgQuery("/ranking", selectedOrganization.slug)}>Ver ranking</Link>
              </div>
              <ol className="mt-3 divide-y divide-slate-800">
                {summary.topPlayers.map((player, index) => (
                  <li key={player.id}>
                    <Link aria-label={`Ver ranking de ${player.full_name}`} className="grid min-h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg py-2 text-sm transition hover:bg-slate-800 lg:pr-3" href={withOrgQuery("/ranking", selectedOrganization.slug)}>
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="w-4 shrink-0 text-center text-xs text-slate-400">{index + 1}</span>
                        <PlayerAvatar hasPhoto={player.photo_path === undefined ? undefined : Boolean(player.photo_path)} name={player.full_name} photoUpdatedAt={player.photo_updated_at} playerId={player.id} size="sm" />
                        <span className="truncate font-medium">{player.full_name}</span>
                      </span>
                      <span className="min-w-12 text-right font-semibold tabular-nums text-emerald-300">{formatRendimiento(player.current_rating)}</span>
                    </Link>
                  </li>
                ))}
              </ol>
              {!summary.topPlayers.length ? <p className="mt-3 text-sm text-slate-400">Todavía no hay jugadores activos cargados.</p> : null}
            </Card>
          </section>

          <GroupShareActions groupName={selectedOrganization.name} groupUrl={groupShareUrl ?? undefined} rankingUrl={rankingShareUrl ?? undefined} source="groups_page" />
        </>
      ) : (
        <section className="space-y-4">
          <h1 className="text-3xl font-black text-slate-100">Grupos</h1>
          <p className="text-sm text-slate-400">Elegí tu grupo para ver el ranking, los resultados y el próximo partido.</p>
          {groupSwitcher}
          <Card><CardTitle>No hay grupos públicos cargados</CardTitle><CardDescription className="mt-2">Cuando haya un grupo público, vas a encontrarlo acá.</CardDescription></Card>
        </section>
      )}
      <PublicGroupGrowthCta source="groups_page" />
    </div>
  );
}
