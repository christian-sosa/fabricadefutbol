"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";
import { getPlayerPhotoSrc, PlayerAvatar } from "@/components/ui/player-avatar";

type PlayerPhotoModalTriggerProps = {
  playerId?: string;
  playerName: string;
  triggerClassName?: string;
  nameClassName?: string;
  avatarSize?: "sm" | "md" | "lg";
};

export function PlayerPhotoModalTrigger({
  playerId,
  playerName,
  triggerClassName,
  nameClassName,
  avatarSize = "sm"
}: PlayerPhotoModalTriggerProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const imageSrc = getPlayerPhotoSrc(playerId);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const modal =
    open && mounted
      ? createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 p-4">
            <button aria-label="Cerrar" className="absolute inset-0" onClick={() => setOpen(false)} type="button" />
            <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
              <button
                aria-label="Cerrar"
                className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-sm font-bold text-slate-200 transition hover:border-slate-500"
                onClick={() => setOpen(false)}
                type="button"
              >
                X
              </button>
              <div className="mx-auto mt-4 h-72 w-72 overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
                <Image
                  alt={`Foto de ${playerName}`}
                  className="h-full w-full object-cover"
                  height={288}
                  sizes="(max-width: 768px) 288px, 288px"
                  src={imageSrc}
                  unoptimized
                  width={288}
                />
              </div>
              <p className="mt-3 text-center text-lg font-bold text-slate-100">{playerName}</p>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        className={cn("flex items-center gap-3 text-left", triggerClassName)}
        onClick={() => setOpen(true)}
        type="button"
      >
        <PlayerAvatar name={playerName} playerId={playerId} size={avatarSize} />
        <span className={cn("font-semibold text-emerald-300 transition hover:text-emerald-200 hover:underline", nameClassName)}>
          {playerName}
        </span>
      </button>

      {modal}
    </>
  );
}
