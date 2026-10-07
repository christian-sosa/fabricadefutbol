"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FormationPitch } from "@/components/matches/formation-pitch";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import {
  FORMATION_PRESETS, assignFormationPlayer, changeFormationPreset, createTeamFormation, describeFormation,
  getFormationPositions, validateMatchFormation,
  getFormationSlotPosition, reassignFormationByPreferences, swapFormationPlayer,
  type FormationModality, type FormationPlayer, type FormationSaveResult, type MatchFormation, type TeamFormation
} from "@/lib/domain/match-formation";
import { PLAYER_POSITION_OPTIONS, getPlayerPositionFit, supportsPositionBalancing } from "@/lib/domain/player-positions";

type Props = {
  modality: FormationModality;
  teams: { teamA: FormationPlayer[]; teamB: FormationPlayer[] };
  teamLabels: { teamA: string; teamB: string };
  initialFormation: MatchFormation | null;
  initialVersion: number;
  action: (expectedVersion: number, payload: string) => Promise<FormationSaveResult>;
};

const fitOrder = { preferred: 0, secondary: 1, flexible: 2, fallback: 3 };

function positionSummary(player: FormationPlayer) {
  if (player.isGoalkeeper) return "Arquero de este partido";
  const preferred = PLAYER_POSITION_OPTIONS.find((option) => option.value === player.preferredPosition)?.label;
  const secondary = PLAYER_POSITION_OPTIONS.find((option) => option.value === player.secondaryPosition)?.label;
  return preferred ? `Prefiere ${preferred.toLocaleLowerCase("es")}${secondary ? ` · También ${secondary.toLocaleLowerCase("es")}` : ""}` : "Sin preferencia guardada";
}

function TeamEditor({ side, label, players, formation, onChange, disabled, positionAware }: {
  side: "A" | "B"; label: string; players: FormationPlayer[]; formation: TeamFormation;
  onChange: (formation: TeamFormation) => void; disabled: boolean; positionAware: boolean;
}) {
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const poolId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const positions = getFormationPositions(formation.formationId);
  const activeSlotId = positions.some((position) => position.slotId === selectedSlotId) ? selectedSlotId : null;
  const selected = formation.slots.find((slot) => slot.slotId === activeSlotId);
  const selectedPlayer = players.find((player) => player.participantId === selected?.participantId);
  const lockedGoalkeeper = activeSlotId === "gk" && players.some((player) => player.isGoalkeeper);
  const assigned = new Map(formation.slots.filter((slot) => slot.participantId).map((slot) => [slot.participantId, slot.slotId]));
  const role = activeSlotId ? getFormationSlotPosition(formation.formationId, activeSlotId) : null;
  const available = players.filter((player) => player.participantId !== selected?.participantId && !player.isGoalkeeper)
    .filter((player) => player.name.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")))
    .sort((a, b) => {
      if (!selectedPlayer) {
        const availability = Number(assigned.has(a.participantId)) - Number(assigned.has(b.participantId));
        if (availability) return availability;
      }
      const fit = positionAware && role ? fitOrder[getPlayerPositionFit(a, role)] - fitOrder[getPlayerPositionFit(b, role)] : 0;
      return fit || a.name.localeCompare(b.name, "es");
    });
  const fallbacks = positionAware ? formation.slots.flatMap((slot) => {
    const player = players.find((candidate) => candidate.participantId === slot.participantId);
    const position = getFormationSlotPosition(formation.formationId, slot.slotId);
    return player && position && getPlayerPositionFit(player, position) === "fallback" ? [{ slot, player }] : [];
  }) : [];
  const focusPanel = () => requestAnimationFrame(() => {
    panelRef.current?.scrollIntoView?.({ block: "nearest" });
    (searchInputRef.current ?? panelRef.current)?.focus({ preventScroll: true });
  });
  const selectSlot = (slotId: string) => {
    setSelectedSlotId(slotId); setSearch(""); focusPanel();
  };
  const placePlayer = (participantId: string) => {
    if (!activeSlotId) return;
    const next = swapFormationPlayer(formation, activeSlotId, participantId, players);
    onChange(next);
    setSearch("");
    const nextEmpty = positions.find((position) => !next.slots.find((slot) => slot.slotId === position.slotId)?.participantId);
    if (nextEmpty) setSelectedSlotId(nextEmpty.slotId);
    searchInputRef.current?.focus({ preventScroll: true });
  };

  return (
    <section aria-label={`Formación de ${label}`} className="min-w-0 space-y-3">
      <p className="text-sm text-slate-300">Tocá un jugador para cambiarlo de puesto. Si elegís a otro que ya está en cancha, intercambian sus lugares.</p>
      {fallbacks.length ? <details className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-3" open={fallbacks.length <= 3}>
        <summary className="cursor-pointer text-sm font-semibold text-amber-200"><span role="status">{fallbacks.length} {fallbacks.length === 1 ? "jugador fuera" : "jugadores fuera"} de sus posiciones habituales</span></summary>
        <p className="mt-2 text-xs text-slate-300">Podés dejarlos así o revisar cada puesto.</p>
        <ul className="mt-2 space-y-2">
          {fallbacks.map(({ slot, player }) => <li className="flex min-w-0 items-center justify-between gap-2" key={slot.slotId}>
            <div className="min-w-0 text-xs"><p className="break-words font-semibold text-white">{player.name} · {positions.find((position) => position.slotId === slot.slotId)?.label}</p><p className="text-slate-300">{positionSummary(player)}</p></div>
            <Button aria-label={`Revisar a ${player.name}`} className="shrink-0 px-2 text-xs" disabled={disabled} onClick={() => selectSlot(slot.slotId)} variant="secondary">Revisar</Button>
          </li>)}
        </ul>
      </details> : null}
      <FormationPitch controlsId={poolId} formation={formation} onSelectSlot={disabled ? undefined : selectSlot} players={players} selectedSlotId={activeSlotId ?? undefined} showPositionHints={positionAware} side={side} teamLabel={label} />
      <div className="scroll-mb-40 rounded-xl border border-slate-700 bg-slate-950 p-3 focus:outline-none" id={poolId} ref={panelRef} tabIndex={-1}>
        {!activeSlotId ? <p className="text-sm text-slate-300">Elegí una remera en la cancha para ver a quién podés ubicar ahí.</p> : <>
        <p className="text-sm font-semibold text-slate-100" role="status">
          {positions.find((position) => position.slotId === activeSlotId)?.label}: {selectedPlayer?.name ?? "elegí un jugador"}
        </p>
        {selectedPlayer && positionAware ? <p className="mt-1 text-xs text-slate-400">{positionSummary(selectedPlayer)}</p> : null}
        {lockedGoalkeeper ? <p className="mt-2 text-sm text-slate-400">Este jugador ya fue marcado como arquero al armar los equipos.</p> : (
          <>
            <div>
            <label className="mb-1 mt-3 block text-xs font-semibold text-slate-300" htmlFor={`${poolId}-search`}>Jugadores disponibles de {label}</label>
            <input className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white" disabled={disabled} id={`${poolId}-search`} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre" ref={searchInputRef} type="search" value={search} />
            <div className="mt-2 grid max-h-64 gap-2 overflow-y-auto overscroll-contain sm:grid-cols-2">
              {available.map((player) => {
                const currentSlot = assigned.get(player.participantId);
                const currentPosition = positions.find((position) => position.slotId === currentSlot)?.label;
                const hint = currentPosition ? `${selectedPlayer ? "Intercambia con" : "Mover desde"} ${currentPosition}` : selectedPlayer ? `Sin ubicar · Reemplaza a ${selectedPlayer.name}` : "Sin ubicar";
                const descriptionId = `${poolId}-${player.participantId}`;
                return <div className="min-w-0 rounded-lg border border-slate-800 p-2" key={player.participantId}>
                  <Button aria-describedby={descriptionId} aria-label={player.name} className="w-full min-w-0 justify-start break-words px-2 text-left" data-formation-candidate disabled={disabled} onClick={() => placePlayer(player.participantId)} variant="secondary">{player.name}</Button>
                  <p className="mt-1 px-2 text-xs text-slate-400" id={descriptionId}>{hint}{positionAware ? <><br />{" "}{positionSummary(player)}</> : null}</p>
                </div>;
              })}
            </div>
            {!available.length ? <p className="mt-2 text-sm text-slate-400">{search ? "No hay jugadores con ese nombre." : "No hay otros jugadores para elegir."}</p> : null}
            </div>
            {selectedPlayer ? <Button className="mt-3 w-full text-xs" disabled={disabled} onClick={() => { onChange(assignFormationPlayer(formation, activeSlotId, null)); searchInputRef.current?.focus({ preventScroll: true }); }} variant="ghost">Quitar de esta posición</Button> : null}
          </>
        )}
        </>}
      </div>
    </section>
  );
}

export function MatchFormationEditor({ modality, teams, teamLabels, initialFormation, initialVersion, action }: Props) {
  const [formation, setFormation] = useState<MatchFormation>(() => initialFormation ?? {
    teamA: createTeamFormation(modality, teams.teamA), teamB: createTeamFormation(modality, teams.teamB)
  });
  const [savedFormation, setSavedFormation] = useState(formation);
  const [previousFormation, setPreviousFormation] = useState<MatchFormation | null>(null);
  const [version, setVersion] = useState(initialVersion);
  const [published, setPublished] = useState(Boolean(initialFormation));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inFlight = useRef(false);
  const id = useId();
  const positionAware = supportsPositionBalancing(modality);
  const dirty = JSON.stringify(formation) !== JSON.stringify(savedFormation);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const beforeNavigate = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.pathname === window.location.pathname && destination.search === window.location.search && destination.hash) return;
      if (!window.confirm("Tenés cambios en la formación sin guardar. ¿Querés salir de esta pantalla?")) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", beforeNavigate, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", beforeNavigate, true); };
  }, [dirty]);
  const changeTeam = (key: "teamA" | "teamB", next: TeamFormation) => {
    if (JSON.stringify(formation[key]) === JSON.stringify(next)) return;
    setPreviousFormation(formation);
    setFormation({ ...formation, [key]: next });
    setMessage(null); setError(null);
  };
  const undo = () => {
    if (!previousFormation) return;
    setFormation(previousFormation); setPreviousFormation(null); setMessage(null); setError(null);
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
      setVersion(result.version); setPublished(!showList);
      if (!showList) { setSavedFormation(formation); setPreviousFormation(null); }
      setMessage(showList ? "El enlace vuelve a mostrar la lista de equipos." : "Formaciones guardadas. El enlace compartido ya muestra las canchas.");
    } catch {
      setError("No pudimos guardar. Tu formación sigue acá; revisá la conexión y volvé a intentar.");
    } finally { inFlight.current = false; setPending(false); }
  };
  const publicationStatus = dirty ? `Tenés cambios sin guardar. ${published ? "El enlace conserva la última versión guardada." : "El enlace muestra la lista de equipos."}` : published ? "El enlace compartido muestra estas formaciones." : "Esta es una propuesta. Guardá ambas formaciones para mostrarlas en el enlace.";

  return (
    <Card>
      <CardTitle>Formaciones en cancha</CardTitle>
      <CardDescription className="mt-1">{positionAware ? "Te proponemos los puestos según las preferencias de cada jugador. Podés cambiar el esquema o intercambiar jugadores antes de guardar." : "Elegí un esquema para cada equipo. Tocá una remera y elegí quién ocupa ese puesto."} Se comparten sin números ni niveles.</CardDescription>
      <p className="mt-3 rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200" role="status">{publicationStatus}</p>
      <form className="mt-4 space-y-4" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          {(["teamA", "teamB"] as const).map((key) => {
            const occupied = formation[key].slots.filter((slot) => slot.participantId).length;
            const unplaced = teams[key].length - occupied;
            const substitutes = Math.max(0, teams[key].length - formation[key].slots.length);
            return <div className="min-w-0 space-y-3" key={key}>
              <label className="block text-sm font-semibold text-slate-200" htmlFor={`${id}-${key}`}>Esquema de {teamLabels[key]}</label>
              <select aria-describedby={`${id}-${key}-description`} className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-white" disabled={pending || conflict} id={`${id}-${key}`} onChange={(event) => changeTeam(key, changeFormationPreset(formation[key], event.target.value))} value={formation[key].formationId}>
                {FORMATION_PRESETS[modality].map((preset) => <option key={preset} value={preset}>{preset}</option>)}
              </select>
              <p className="text-xs text-slate-300" id={`${id}-${key}-description`}>{describeFormation(formation[key].formationId)}</p>
              <p className="text-xs text-slate-400">{occupied} de {formation[key].slots.length} puestos completos{substitutes > 0 ? ` · ${substitutes} ${substitutes === 1 ? "suplente" : "suplentes"}` : ""}{occupied < formation[key].slots.length ? ` · ${unplaced} sin ubicar` : ""}</p>
              {positionAware ? <div>
                <Button className="w-full sm:w-auto" disabled={pending || conflict || occupied === 0} onClick={() => changeTeam(key, reassignFormationByPreferences(formation[key], teams[key]))} variant="secondary">Reacomodar según posiciones</Button>
                <p className="mt-1 text-xs text-slate-400">Reubica a quienes están en cancha usando este esquema.</p>
              </div> : null}
              <TeamEditor disabled={pending || conflict} formation={formation[key]} label={teamLabels[key]} onChange={(next) => changeTeam(key, next)} players={teams[key]} positionAware={positionAware} side={key === "teamA" ? "A" : "B"} />
            </div>;
          })}
        </div>
        <div className="sticky bottom-3 z-20 space-y-2 rounded-xl border border-slate-600 bg-slate-950/95 p-3 shadow-lg backdrop-blur">
        {error ? <p className="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200" role="alert">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-200" role="status">{message}</p> : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button disabled={pending || conflict || Boolean(validationError)} type="submit">{pending ? "Guardando..." : "Guardar formaciones"}</Button>
          {previousFormation ? <Button disabled={pending || conflict} onClick={undo} variant="secondary">Deshacer último cambio</Button> : null}
          {published ? <Button disabled={pending || conflict} onClick={() => void save(true)} variant="secondary">Mostrar lista en el enlace</Button> : null}
          {conflict ? <Button onClick={() => window.location.reload()} variant="secondary">Recargar formación guardada</Button> : null}
        </div>
        <p className="text-xs text-slate-400">{conflict ? "Tu armado sigue en pantalla. Recargá para ver lo que se guardó desde otra sesión." : validationError ?? (dirty ? "Guardá para actualizar el enlace compartido." : "Los cambios se publican al guardar ambos equipos.")}</p>
        </div>
      </form>
    </Card>
  );
}
