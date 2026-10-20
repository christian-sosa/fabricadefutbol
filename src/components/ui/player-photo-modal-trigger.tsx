"use client";

import { memo, useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";

import { cn } from "@/lib/utils";
import { getPlayerPhotoSrc, PlayerAvatar } from "@/components/ui/player-avatar";

const PlayerPhotoModal = dynamic(() => import("@/components/ui/player-photo-modal").then((module) => module.PlayerPhotoModal), { ssr: false });

type PlayerPhotoModalTriggerProps = {
  playerId?: string;
  hasPhoto?: boolean;
  photoUpdatedAt?: string | null;
  playerName: string;
  triggerClassName?: string;
  nameClassName?: string;
  avatarSize?: "sm" | "md" | "lg";
  showPhotoLabel?: boolean;
};

export const PlayerPhotoModalTrigger = memo(function PlayerPhotoModalTrigger({
  playerId,
  hasPhoto,
  photoUpdatedAt,
  playerName,
  triggerClassName,
  nameClassName,
  avatarSize = "sm",
  showPhotoLabel = false
}: PlayerPhotoModalTriggerProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        className={cn("flex items-center gap-3 text-left", triggerClassName)}
        aria-haspopup="dialog"
        aria-label={`Ver foto de ${playerName}`}
        ref={triggerRef}
        onClick={() => setOpen(true)}
        type="button"
      >
        <PlayerAvatar hasPhoto={hasPhoto} name={playerName} photoUpdatedAt={photoUpdatedAt} playerId={playerId} size={avatarSize} />
        <span className={cn("min-w-0 font-semibold text-slate-100", nameClassName)}>
          <span className="block break-words">{playerName}</span>
          {showPhotoLabel ? <span className="block text-xs font-normal text-muted">Ver foto</span> : null}
        </span>
      </button>

      {open ? <PlayerPhotoModal imageSrc={getPlayerPhotoSrc(playerId, hasPhoto, photoUpdatedAt)} onClose={close} playerName={playerName} triggerRef={triggerRef} /> : null}
    </>
  );
});
