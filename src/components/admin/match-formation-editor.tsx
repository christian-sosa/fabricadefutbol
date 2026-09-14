"use client";

import { useId, useRef, useState } from "react";
import { FormationPitch } from "@/components/matches/formation-pitch";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import {
  FORMATION_PRESETS, assignFormationPlayer, changeFormationPreset, createTeamFormation,
  getFormationPositions, validateMatchFormation,
  type FormationModality, type FormationPlayer, type FormationSaveResult, type MatchFormation, type TeamFormation
} from "@/lib/domain/match-formation";

type Props = {
  modality: FormationModality;
  teams: { teamA: FormationPlayer[]; teamB: FormationPlayer[] };
  teamLabels: { teamA: string; teamB: string };
  initialFormation: MatchFormation | null;
  initialVersion: number;
  action: (expectedVersion: number, payload: string) => Promise<FormationSaveResult>;
};

function TeamEditor({ side, label, players, formation, onChange, disabled }: {
  side: "A" | "B"; label: string; players: FormationPlayer[]; formation: TeamFormation;
  onChange: (formation: TeamFormation) => void; disabled: boolean;
}) {
  const [selectedSlotId, setSelectedSlotId] = useState(() => formation.slots.find((slot) => !slot.participantId)?.slotId ?? "gk");
  const [search, setSearch] = useState("");
  const poolId = useId();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const positions = getFormationPositions(formation.formationId);
  const activeSlotId = positions.some((position) => position.slotId === selectedSlotId) ? selectedSlotId : "gk";
  const selected = formation.slots.find((slot) => slot.slotId === activeSlotId);
  const selectedPlayer = players.find((player) => player.participantId === selected?.participantId);
  const lockedGoalkeeper = activeSlotId === "gk" && players.some((player) => player.isGoalkeeper);
  const assigned = new Set(formation.slots.map((slot) => slot.participantId).filter(Boolean));
  const available = players.filter((player) => !assigned.has(player.participantId) && !player.isGoalkeeper)
    .filter((player) => player.name.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  const placePlayer = (participantId: string) => {
    const next = assignFormationPlayer(formation, activeSlotId, participantId);
    onChange(next);
    setSearch("");
    const nextEmpty = positions.find((position) => !next.slots.find((slot) => slot.slotId === position.slotId)?.participantId);
    if (nextEmpty) setSelectedSlotId(nextEmpty.slotId);
    searchInputRef.current?.focus();
  };

  return (
    <section aria-label={`Formación de ${label}`} className="min-w-0 space-y-3">
      <FormationPitch controlsId={poolId} formation={formation} onSelectSlot={disabled ? undefined : setSelectedSlotId} players={players} selectedSlotId={activeSlotId} side={side} teamLabel={label} />
      <div className="rounded-xl border border-slate-700 bg-slate-950 p-3" id={poolId}>
        <p className="text-sm font-semibold text-slate-100" role="status">
          {positions.find((position) => position.slotId === activeSlotId)?.label}: {selectedPlayer?.name ?? "elegí un jugador"}
        </p>
        {lockedGoalkeeper ? <p className="mt-2 text-sm text-slate-400">Este jugador ya fue marcado como arquero al armar los equipos.</p> : (
          <>
            {selectedPlayer ? <Button className="mt-2 w-full" disabled={disabled} onClick={() => { onChange(assignFormationPlayer(formation, activeSlotId, null)); searchInputRef.current?.focus(); }} variant="secondary">Quitar de esta posición</Button> : null}
            <label className="mb-1 mt-3 block text-xs font-semibold text-slate-300" htmlFor={`${poolId}-search`}>Jugadores disponibles de {label}</label>
            <input className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white" disabled={disabled} id={`${poolId}-search`} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre" ref={searchInputRef} type="search" value={search} />
            <div className="mt-2 grid max-h-60 gap-2 overflow-y-auto overscroll-contain sm:grid-cols-2">
              {available.map((player) => <Button className="min-w-0 justify-start break-words text-left" disabled={disabled} key={player.participantId} onClick={() => placePlayer(player.participantId)} variant="secondary">{player.name}</Button>)}
            </div>
            {!available.length ? <p className="mt-2 text-sm text-slate-400">{search ? "No hay jugadores con ese nombre." : assigned.size === players.length ? "Todos ubicados. Tocá una remera para cambiar esa posición." : "No quedan jugadores disponibles para esta posición."}</p> : null}
          </>
        )}
      </div>
    </section>
  );
}

export function MatchFormationEditor({ modality, teams, teamLabels, initialFormation, initialVersion, action }: Props) {
  const [formation, setFormation] = useState<MatchFormation>(() => initialFormation ?? {
    teamA: createTeamFormation(modality, teams.teamA), teamB: createTeamFormation(modality, teams.teamB)
  });
  const [version, setVersion] = useState(initialVersion);
  const [published, setPublished] = useState(Boolean(initialFormation));
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inFlight = useRef(false);
  const id = useId();
  const changeTeam = (key: "teamA" | "teamB", next: TeamFormation) => {
    setFormation((current) => ({ ...current, [key]: next }));
    setDirty(true); setMessage(null); setError(null);
  };
  let validationError: string | null = null;
  try { validateMatchFormation(formation, modality, teams); } catch (cause) { validationError = (cause as Error).message; }
  const save = async (showList = false) => {
    if (inFlight.current || conflict) return;
    if (!showList && validationError) { setError(validationError); return; }
    inFlight.current = true; setPending(true); setError(null); setMessage(null);
    try {
      const result = await action(version, JSON.stringify(showList ? null : formation));
      if (!result.ok) { setError(result.error); setConflict(Boolean(result.conflict)); return; }
      setVersion(result.version); setPublished(!showList); setDirty(false);
      setMessage(showList ? "El enlace vuelve a mostrar la lista de equipos." : "Formaciones guardadas. El enlace compartido ya muestra las canchas.");
    } catch {
      setError("No pudimos guardar. Tu formación sigue acá; revisá la conexión y volvé a intentar.");
    } finally { inFlight.current = false; setPending(false); }
  };

  return (
    <Card>
      <CardTitle>Formaciones en cancha</CardTitle>
      <CardDescription className="mt-1">Elegí un esquema para cada equipo. Tocá una remera y ubicá un jugador del grupo disponible. Se comparten sin números ni niveles.</CardDescription>
      <form className="mt-4 space-y-4" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          {(["teamA", "teamB"] as const).map((key) => (
            <div className="min-w-0 space-y-3" key={key}>
              <label className="block text-sm font-semibold text-slate-200" htmlFor={`${id}-${key}`}>Esquema de {teamLabels[key]}</label>
              <select className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-white" disabled={pending || conflict} id={`${id}-${key}`} onChange={(event) => changeTeam(key, changeFormationPreset(formation[key], event.target.value))} value={formation[key].formationId}>
                {FORMATION_PRESETS[modality].map((preset) => <option key={preset} value={preset}>{preset}</option>)}
              </select>
              <p className="text-xs text-slate-400">{formation[key].slots.filter((slot) => slot.participantId).length} de {teams[key].length} jugadores ubicados</p>
              <TeamEditor disabled={pending || conflict} formation={formation[key]} label={teamLabels[key]} onChange={(next) => changeTeam(key, next)} players={teams[key]} side={key === "teamA" ? "A" : "B"} />
            </div>
          ))}
        </div>
        {error ? <p className="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200" role="alert">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-200" role="status">{message}</p> : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button disabled={pending || conflict || Boolean(validationError)} type="submit">{pending ? "Guardando..." : "Guardar formaciones"}</Button>
          {published ? <Button disabled={pending || conflict} onClick={() => void save(true)} variant="secondary">Mostrar lista en el enlace</Button> : null}
          {conflict ? <Button onClick={() => window.location.reload()} variant="secondary">Recargar formación guardada</Button> : null}
        </div>
        <p className="text-xs text-slate-400">{conflict ? "Tu armado sigue en pantalla. Recargá para ver lo que se guardó desde otra sesión." : validationError ?? (dirty ? "Tenés cambios sin guardar. El enlace conserva la última versión guardada." : published ? "El enlace compartido muestra estas formaciones." : "Hasta guardar ambas formaciones, el enlace muestra la lista habitual.")}</p>
      </form>
    </Card>
  );
}
