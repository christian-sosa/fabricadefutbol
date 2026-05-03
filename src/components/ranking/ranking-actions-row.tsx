import { GroupShareActions } from "@/components/groups/group-share-actions";
import { SeasonFilterLinks } from "@/components/groups/season-filter-links";
import type { OrganizationSeasonOption } from "@/lib/query/types";

type RankingActionsRowProps = {
  currentSeason: string;
  groupName: string;
  organizationSlug: string;
  rankingShareUrl?: string | null;
  seasons: OrganizationSeasonOption[];
};

export function RankingActionsRow({
  currentSeason,
  groupName,
  organizationSlug,
  rankingShareUrl,
  seasons
}: RankingActionsRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SeasonFilterLinks
        basePath="/ranking"
        currentSeason={currentSeason}
        organizationSlug={organizationSlug}
        seasons={seasons}
      />
      <GroupShareActions
        groupName={groupName}
        rankingUrl={rankingShareUrl ?? undefined}
        source="ranking_page"
      />
    </div>
  );
}
