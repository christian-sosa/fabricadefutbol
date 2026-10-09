"use client";

import { useId, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

export function PlayerRosterActions({ children, initiallyOpen = false, playerName }: {
  children: ReactNode;
  initiallyOpen?: boolean;
  playerName: string;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const panelId = useId();

  return (
    <>
      <div className="min-w-0">
        <span aria-hidden="true" className="mb-1 hidden text-xs leading-4 text-slate-300 lg:block">Opciones</span>
        <Button
          aria-controls={panelId}
          aria-expanded={open}
          aria-label={`Acciones de ${playerName}`}
          className="w-full lg:w-auto"
          onClick={() => setOpen((current) => !current)}
          variant="secondary"
        >
          Acciones
          <svg aria-hidden="true" className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 20 20">
            <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
          </svg>
        </Button>
      </div>
      <div
        aria-label={`Acciones de ${playerName}`}
        className={`col-span-full min-w-0 border-t border-slate-800 pt-3 ${open ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.55fr)] lg:items-start" : "hidden"}`}
        hidden={!open}
        id={panelId}
        role="region"
      >
        {children}
      </div>
    </>
  );
}
