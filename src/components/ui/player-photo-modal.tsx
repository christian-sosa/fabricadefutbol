"use client";

import { useEffect, useId, useRef, type RefObject } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";

export function PlayerPhotoModal({ imageSrc, onClose, playerName, triggerRef }: {
  imageSrc: string;
  onClose: () => void;
  playerName: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = triggerRef.current;
    const focusables = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'));
    focusables()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
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
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      background.forEach((element, index) => { element.inert = previousInert[index]; });
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [onClose, triggerRef]);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 p-4">
      <button aria-label="Cerrar foto" className="absolute inset-0" onClick={onClose} tabIndex={-1} type="button" />
      <div aria-labelledby={titleId} aria-modal="true" className="relative z-10 w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl" ref={dialogRef} role="dialog" tabIndex={-1}>
        <button
          aria-label="Cerrar"
          className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-sm font-bold text-slate-200 transition hover:border-slate-500"
          onClick={onClose}
          type="button"
        >
          X
        </button>
        <div className="mx-auto mt-10 aspect-square w-full max-w-72 overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
          <Image
            alt={`Foto de ${playerName}`}
            className="h-full w-full object-cover"
            height={288}
            loading="eager"
            sizes="288px"
            src={imageSrc}
            unoptimized
            width={288}
          />
        </div>
        <p className="mt-3 text-center text-lg font-bold text-slate-100" id={titleId}>Foto de {playerName}</p>
      </div>
    </div>,
    document.body
  );
}
