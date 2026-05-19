"use client";

import { Button } from "@/components/ui/button";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { GROWTH_EVENTS } from "@/lib/growth";
import {
  buildGroupWhatsAppMessage,
  buildRankingWhatsAppMessage,
  buildWhatsAppUrlFromMessage,
  getWhatsAppShareTarget
} from "@/lib/share";

type GroupShareActionsProps = {
  groupName: string;
  groupUrl?: string;
  rankingUrl?: string;
  source: string;
};

function openWhatsApp(message: string) {
  const target = getWhatsAppShareTarget(window.navigator.userAgent);
  window.open(
    buildWhatsAppUrlFromMessage(message, target),
    "_blank",
    "noopener,noreferrer"
  );
}

export function GroupShareActions({
  groupName,
  groupUrl,
  rankingUrl,
  source
}: GroupShareActionsProps) {
  if (!groupUrl && !rankingUrl) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {rankingUrl ? (
        <Button
          onClick={() => {
            trackAnalyticsEvent(GROWTH_EVENTS.rankingShared, { source });
            openWhatsApp(buildRankingWhatsAppMessage({ groupName, rankingUrl }));
          }}
          type="button"
          variant="secondary"
        >
          Compartir ranking
        </Button>
      ) : null}
      {groupUrl ? (
        <Button
          onClick={() => {
            trackAnalyticsEvent(GROWTH_EVENTS.groupShared, { source });
            openWhatsApp(buildGroupWhatsAppMessage({ groupName, groupUrl }));
          }}
          type="button"
          variant="ghost"
        >
          Compartir grupo
        </Button>
      ) : null}
    </div>
  );
}
