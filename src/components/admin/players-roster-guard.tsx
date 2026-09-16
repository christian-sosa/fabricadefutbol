"use client";

import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

type Player = { id: string; full_name: string; skill_level: number };
type Draft = { name: string; level: string; originalName: string; originalLevel: string };

const RosterPendingContext = createContext<((pending: boolean) => void) | null>(null);

// The roster fields belong to this form through `form`, but live outside its DOM subtree.
// Report pending only after React has collected the submitted FormData.
export function PlayersRosterPendingStatus() {
  const { pending } = useFormStatus();
  const setPending = useContext(RosterPendingContext);
  useLayoutEffect(() => { setPending?.(pending); }, [pending, setPending]);
  return null;
}

export function PlayersRosterGuard({ children, formId, organizationId, players }: {
  children: ReactNode;
  formId: string;
  organizationId: string;
  players: Player[];
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);
  const [changedCount, setChangedCount] = useState(0);
  const [blockedAction, setBlockedAction] = useState(false);
  const [pending, setPending] = useState(false);
  const messageId = useId();
  const storageKey = `fdf:players-draft:v1:${organizationId}`;

  const fieldsFor = useCallback((id: string) => {
    const row = rootRef.current?.querySelector<HTMLElement>(`[data-roster-player="${id}"]`);
    return {
      name: row?.querySelector<HTMLInputElement>('input[name="fullName"]'),
      level: row?.querySelector<HTMLSelectElement>('select[name="skillLevel"]')
    };
  }, []);

  const recordChanges = useCallback(() => {
    const draft: Record<string, Draft> = {};
    for (const player of players) {
      const { name, level } = fieldsFor(player.id);
      if (!name || !level || (name.value === player.full_name && level.value === String(player.skill_level))) continue;
      draft[player.id] = { name: name.value, level: level.value, originalName: player.full_name, originalLevel: String(player.skill_level) };
    }
    const count = Object.keys(draft).length;
    setChangedCount(count);
    if (!count) setBlockedAction(false);
    try {
      if (count) window.sessionStorage.setItem(storageKey, JSON.stringify(draft));
      else window.sessionStorage.removeItem(storageKey);
    } catch { /* Navigation protection remains available when storage is unavailable. */ }
  }, [fieldsFor, players, storageKey]);

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(window.sessionStorage.getItem(storageKey) ?? "{}");
      if (saved && typeof saved === "object") {
        for (const player of players) {
          const draft = (saved as Record<string, Partial<Draft>>)[player.id];
          // Never restore an older draft over a newly saved or concurrently edited row.
          if (!draft || draft.originalName !== player.full_name || draft.originalLevel !== String(player.skill_level)) continue;
          const { name, level } = fieldsFor(player.id);
          if (name && typeof draft.name === "string") name.value = draft.name;
          if (level && typeof draft.level === "string" && Array.from(level.options).some((option) => option.value === draft.level)) level.value = draft.level;
        }
      }
    } catch { /* A missing or invalid draft must not prevent editing. */ }
    recordChanges();
  }, [fieldsFor, players, recordChanges, storageKey]);

  useEffect(() => {
    if (!changedCount) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const beforeNavigate = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.pathname === window.location.pathname && destination.search === window.location.search && destination.hash) return;
      if (!window.confirm("Tenés cambios en la planilla sin guardar. ¿Querés salir de esta pantalla?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", beforeNavigate, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", beforeNavigate, true);
    };
  }, [changedCount]);

  const discard = () => {
    for (const player of players) {
      const { name, level } = fieldsFor(player.id);
      if (name) name.value = player.full_name;
      if (level) level.value = String(player.skill_level);
    }
    recordChanges();
  };

  return <RosterPendingContext.Provider value={setPending}><div ref={rootRef} onChange={recordChanges} onResetCapture={() => queueMicrotask(recordChanges)} onSubmitCapture={(event) => {
    if (pending) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (changedCount && event.target instanceof HTMLFormElement && event.target.id !== formId) {
      event.preventDefault();
      event.stopPropagation();
      setBlockedAction(true);
      messageRef.current?.focus();
    }
  }}>
    <fieldset className="min-w-0" disabled={pending}>
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-700 px-3 py-2">
      <p className="flex-1 text-sm text-slate-200" id={messageId} ref={messageRef} role="status" tabIndex={-1}>
        {pending ? "Guardando planilla. Esperá a que termine para seguir editando." : changedCount ? `${changedCount} ${changedCount === 1 ? "jugador con cambios" : "jugadores con cambios"} sin guardar.` : "La planilla está guardada."}
        {blockedAction ? " Guardá o descartá la planilla antes de subir fotos o eliminar jugadores." : ""}
      </p>
      {changedCount ? <Button aria-describedby={messageId} onClick={discard} type="button" variant="ghost">Descartar cambios</Button> : null}
    </div>
    {children}
    </fieldset>
  </div></RosterPendingContext.Provider>;
}
