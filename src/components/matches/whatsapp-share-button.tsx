"use client";

import { Button } from "@/components/ui/button";
import { buildWhatsAppShareUrl } from "@/lib/share";

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
    window.open(
      buildWhatsAppShareUrl({
        matchUrl,
        teamAName,
        teamBName
      }),
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
