"use client";

import { useEffect, useRef } from "react";

import { Select } from "@/components/ui/select";
import { PLAYER_POSITION_OPTIONS } from "@/lib/domain/player-positions";
import type { PlayerPosition } from "@/types/domain";

// Keep the native selects as the source of truth, including roster draft restores.
export function syncPlayerPositionFields(root: ParentNode) {
  for (const fields of root.querySelectorAll<HTMLElement>("[data-position-fields]")) {
    const preferred = fields.querySelector<HTMLSelectElement>('select[name="preferredPosition"]');
    const secondary = fields.querySelector<HTMLSelectElement>('select[name="secondaryPosition"]');
    const emptySecondary = fields.querySelector<HTMLInputElement>('input[name="secondaryPosition"]');
    if (!preferred || !secondary || !emptySecondary) continue;
    if (!preferred.value || secondary.value === preferred.value) secondary.value = "";
    secondary.disabled = !preferred.value;
    emptySecondary.disabled = Boolean(preferred.value);
    for (const option of secondary.options) option.disabled = Boolean(option.value && option.value === preferred.value);
  }
}

export function PlayerPositionFields({ form, playerName, preferredPosition, secondaryPosition, describedBy, className = "" }: {
  form?: string;
  playerName?: string;
  preferredPosition?: PlayerPosition | null;
  secondaryPosition?: PlayerPosition | null;
  describedBy?: string;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const suffix = playerName ? ` de ${playerName}` : "";

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    syncPlayerPositionFields(root.parentNode ?? root);
    const ownerForm = root.querySelector("select")?.form;
    const onReset = () => queueMicrotask(() => syncPlayerPositionFields(root.parentNode ?? root));
    ownerForm?.addEventListener("reset", onReset);
    return () => ownerForm?.removeEventListener("reset", onReset);
  }, []);

  return <div className={`grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,10.5rem),1fr))] gap-2 ${className}`} data-position-fields ref={rootRef} onChange={() => {
    if (rootRef.current?.parentNode) syncPlayerPositionFields(rootRef.current.parentNode);
  }}>
    <label className="grid min-w-0 gap-1 text-xs text-slate-300">
      Posición preferida
      <Select aria-describedby={describedBy} aria-label={`Posición preferida${suffix}`} className="min-w-0" defaultValue={preferredPosition ?? ""} form={form} name="preferredPosition">
        <option value="">Sin preferencia</option>
        {PLAYER_POSITION_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
      </Select>
    </label>
    <label className="grid min-w-0 gap-1 text-xs text-slate-300">
      Posición secundaria
      <Select aria-describedby={describedBy} aria-label={`Posición secundaria${suffix}`} className="min-w-0 disabled:opacity-50" defaultValue={preferredPosition && preferredPosition !== secondaryPosition ? secondaryPosition ?? "" : ""} disabled={!preferredPosition} form={form} name="secondaryPosition">
        <option value="">Sin secundaria</option>
        {PLAYER_POSITION_OPTIONS.map(({ value, label }) => <option disabled={value === preferredPosition} key={value} value={value}>{label}</option>)}
      </Select>
    </label>
    {/* Disabled controls are omitted by FormData: preserve one entry per player. */}
    <input disabled={Boolean(preferredPosition)} form={form} name="secondaryPosition" type="hidden" value="" />
  </div>;
}
