"use client";

import { useId, useState } from "react";

import { TeamOptionCard, type TeamOptionCardProps } from "@/components/matches/team-option-card";
import { Button } from "@/components/ui/button";

type TeamOptionsListProps = {
  options: Array<Omit<TeamOptionCardProps, "hideLevels" | "confirmAction">>;
  confirmAction?: (formData: FormData) => void;
};

export function TeamOptionsList({ options, confirmAction }: TeamOptionsListProps) {
  const [hideLevels, setHideLevels] = useState(false);
  const listId = useId();

  if (!options.length) {
    return <p className="text-sm text-slate-400">No hay opciones generadas para este partido.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-400" role="status">
          {hideLevels
            ? "Niveles ocultos. Jugadores ordenados por nombre."
            : "Ocultá los niveles antes de mostrar o capturar esta pantalla."}
        </p>
        <Button
          aria-controls={listId}
          aria-pressed={hideLevels}
          className="shrink-0"
          onClick={() => setHideLevels((hidden) => !hidden)}
          variant="secondary"
        >
          {hideLevels ? "Mostrar niveles" : "Ocultar niveles"}
        </Button>
      </div>
      <div className="space-y-3" id={listId}>
        {options.map((option) => (
          <TeamOptionCard
            {...option}
            confirmAction={confirmAction}
            hideLevels={hideLevels}
            key={option.optionId}
          />
        ))}
      </div>
    </div>
  );
}
