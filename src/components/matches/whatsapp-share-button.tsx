"use client";

import { Button } from "@/components/ui/button";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { GROWTH_EVENTS } from "@/lib/growth";
import { buildWhatsAppShareUrl, getWhatsAppShareTarget, type MatchWhatsAppShareParams } from "@/lib/share";

type WhatsAppShareButtonProps = {
  matchUrl: string;
  teamAName?: string;
  teamBName?: string;
  className?: string;
  substitutes?: MatchWhatsAppShareParams["substitutes"];
};

export function WhatsAppShareButton({
  matchUrl,
  teamAName,
  teamBName,
  substitutes,
  className
}: WhatsAppShareButtonProps) {
  const handleClick = () => {
    const target = getWhatsAppShareTarget(window.navigator.userAgent);
    trackAnalyticsEvent(GROWTH_EVENTS.matchShared, { source: "match_detail" });

    window.open(
      buildWhatsAppShareUrl(
        {
          matchUrl,
          teamAName,
          teamBName,
          substitutes
        },
        target
      ),
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <Button className={className} onClick={handleClick}>
      Compartir en WhatsApp
    </Button>
  );
}
