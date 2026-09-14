"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";
import { getPlayerPhotoSrc, PlayerAvatar } from "@/components/ui/player-avatar";

type PlayerPhotoModalTriggerProps = {
  playerId?: string;
  hasPhoto?: boolean;
  photoUpdatedAt?: string | null;
  playerName: string;
  triggerClassName?: string;
  nameClassName?: string;
  avatarSize?: "sm" | "md" | "lg";
};

export function PlayerPhotoModalTrigger({
  playerId,
  hasPhoto,
  photoUpdatedAt,
  playerName,
  triggerClassName,
  nameClassName,
  avatarSize = "sm"
}: PlayerPhotoModalTriggerProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const imageSrc = getPlayerPhotoSrc(playerId, hasPhoto, photoUpdatedAt);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const trigger = triggerRef.current;
    const focusables = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'));
    focusables()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;
      const items = focusables();
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) { event.preventDefault(); dialog.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    const background = Array.from(document.body.children).filter((element): element is HTMLElement => element instanceof HTMLElement && !element.contains(dialog));
    const previousInert = background.map((element) => element.inert);
    background.forEach((element) => { element.inert = true; });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      background.forEach((element, index) => { element.inert = previousInert[index]; });
      trigger?.focus();
    };
  }, [open, mounted]);

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
            <button aria-label="Cerrar foto" className="absolute inset-0" onClick={() => setOpen(false)} tabIndex={-1} type="button" />
            <div aria-labelledby={titleId} aria-modal="true" className="relative z-10 w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl" ref={dialogRef} role="dialog" tabIndex={-1}>
              <button
                aria-label="Cerrar"
                className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-sm font-bold text-slate-200 transition hover:border-slate-500"
                onClick={() => setOpen(false)}
                type="button"
              >
                X
              </button>
              <div className="mx-auto mt-10 aspect-square w-full max-w-72 overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
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
              <p className="mt-3 text-center text-lg font-bold text-slate-100" id={titleId}>Foto de {playerName}</p>
            </div>
          </div>,
          document.body
        )
      : null;

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
        <span className={cn("font-semibold text-emerald-300 transition hover:text-emerald-200 hover:underline", nameClassName)}>
          {playerName}
        </span>
      </button>

      {modal}
    </>
  );
}
