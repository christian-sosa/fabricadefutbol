import Link from "next/link";

import { PublicGroupGrowthCta } from "@/components/groups/public-group-growth-cta";
import { SeasonFilterLinks } from "@/components/groups/season-filter-links";
import { OrganizationPublicNav } from "@/components/layout/organization-public-nav";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { MatchesHistoryQueryTable } from "@/components/matches/matches-history-query-table";
import { MatchActivityCalendar } from "@/components/matches/match-activity-calendar";
import { secondaryActionClass } from "@/components/ui/styles";
import { getCurrentMatchDateInput } from "@/lib/match-datetime";
import { buildMatchHistoryHref, parseMatchHistoryPage, parseMatchHistorySeason } from "@/lib/match-history-navigation";
import {
  getMatchCalendarActivity,
  getMatchHistoryCardsPage,
  getOrganizationSeasons,
  getViewerAdminOrganizations,
  resolvePublicOrganization
} from "@/lib/queries/public";

export default async function MatchesPage({
  searchParams
}: {
  searchParams: Promise<{ org?: string; season?: string; page?: string; view?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const selectedSeason = parseMatchHistorySeason(resolvedSearchParams.season);
  const selectedPage = parseMatchHistoryPage(resolvedSearchParams.page);
  const showCalendar = resolvedSearchParams.view === "calendar";
  const [{ organizations, selectedOrganization }, viewerAdminOrganizations] = await Promise.all([
    resolvePublicOrganization(resolvedSearchParams.org),
    getViewerAdminOrganizations()
  ]);
  const [initialMatchesData, calendarData, seasons] = await Promise.all([
    showCalendar && selectedOrganization ? Promise.resolve(undefined) : getMatchHistoryCardsPage(selectedOrganization?.id ?? null, {
      page: selectedPage,
      pageSize: 10,
      season: selectedSeason
    }),
    showCalendar && selectedOrganization ? getMatchCalendarActivity(selectedOrganization.id, selectedSeason) : Promise.resolve(null),
    getOrganizationSeasons(selectedOrganization?.id ?? null)
  ]);
  const groupSwitcher = <OrganizationSwitcher
    basePath={showCalendar ? "/matches?view=calendar" : "/matches"}
    currentOrganizationSlug={selectedOrganization?.slug}
    label="Elegir grupo"
    organizations={organizations}
    pickerOnly={Boolean(selectedOrganization)}
    quickOrganizations={viewerAdminOrganizations}
  />;

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-black text-slate-100 sm:text-3xl">Historial de partidos</h1>
          {selectedOrganization ? <Link className={secondaryActionClass} href={buildMatchHistoryHref({
            organizationSlug: selectedOrganization.slug, season: selectedSeason, page: selectedPage,
            view: showCalendar ? undefined : "calendar"
          })} prefetch={false}>
            {showCalendar ? "Volver a la lista" : <><svg aria-hidden="true" className="mr-2 h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24"><rect height="17" rx="2" width="18" x="3" y="5" /><path d="M16 3v4M8 3v4M3 11h18M8 16h2M14 16h2" /></svg>Ver calendario</>}
          </Link> : null}
        </div>
        {selectedOrganization ? (
          <details className="rounded-xl border border-slate-800 px-3">
            <summary className="min-h-11 cursor-pointer content-center text-sm text-slate-300"><span className="font-semibold text-slate-100">{selectedOrganization.name}</span> · Cambiar grupo</summary>
            <div className="pb-3 pt-1">{groupSwitcher}</div>
          </details>
        ) : groupSwitcher}
        {selectedOrganization ? <OrganizationPublicNav className="lg:hidden" currentPath="/matches" organizationKey={selectedOrganization.slug} season={selectedSeason} /> : null}
      </header>

      {selectedOrganization ? (
        <SeasonFilterLinks
          basePath="/matches"
          currentSeason={selectedSeason}
          organizationSlug={selectedOrganization.slug}
          seasons={seasons}
          view={showCalendar ? "calendar" : undefined}
        />
      ) : null}

      {calendarData && selectedOrganization ? <MatchActivityCalendar
        historyPage={selectedPage}
        key={`${selectedOrganization.id}:${selectedSeason}`}
        matches={calendarData.matches}
        organizationSlug={selectedOrganization.slug}
        season={selectedSeason}
        seasonStartsAt={calendarData.season?.startsAt}
        seasonEndsAt={calendarData.season?.endsAt}
        today={getCurrentMatchDateInput()}
      /> : <MatchesHistoryQueryTable
        initialData={initialMatchesData}
        initialPage={selectedPage}
        organizationId={selectedOrganization?.id ?? null}
        organizationSlug={selectedOrganization?.slug}
        pageSize={10}
        season={selectedSeason}
      />}

      <PublicGroupGrowthCta source="matches_page" />
    </div>
  );
}
