"use client";

import { Button } from "@/components/ui/button";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { GROWTH_EVENTS } from "@/lib/growth";
import { buildWhatsAppShareUrl, getWhatsAppShareTarget } from "@/lib/share";

type WhatsAppShareButtonProps = {
  matchUrl: string;
  teamAName?: string;
  teamBName?: string;
  className?: string;
};

export function WhatsAppShareButton({
  matchUrl,
  teamAName,
  teamBName,
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
          teamBName
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
