"use client";

import { useEffect, useId, useMemo, useState } from "react";

import { createMatchFormAction } from "@/app/admin/(panel)/form-actions";
import { ActionForm } from "@/components/ui/action-form";
import { MatchDateTimeFields } from "@/components/admin/match-date-time-fields";
import { Button } from "@/components/ui/button";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { Input } from "@/components/ui/input";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { Select } from "@/components/ui/select";
import { MATCH_MODALITIES, MATCH_MODALITY_LABELS, TEAM_SIZE_BY_MODALITY } from "@/lib/constants";
import {
  formatGuestSkillLevelLabel,
  formatRatingTrendBadgeLabel,
  formatRatingTrendLabel,
  formatSkillLevelLabel,
  GUEST_SKILL_LEVEL_HELP_TEXT,
  GUEST_SKILL_LEVEL_OPTIONS,
  parseGuestSkillLevelValue
} from "@/lib/domain/skill-level";
import { DEFAULT_TEAM_A_LABEL, DEFAULT_TEAM_B_LABEL, TEAM_LABEL_MAX_LENGTH } from "@/lib/team-labels";
import { cn } from "@/lib/utils";
import type { MatchModality, SubstituteAssignment, TeamSide } from "@/types/domain";

type SelectablePlayer = {
  id: string;
  full_name: string;
  current_rating: number;
  initial_rank: number;
  skill_level: number;
  display_order?: number;
  photo_path?: string | null;
  photo_updated_at?: string | null;
};

type GuestRow = {
  key: number;
  name: string;
  rating: string;
};

type ManualParticipant = {
  participantId: string;
  fullName: string;
  rating: number;
  skillLevel?: number;
  source: "player" | "guest";
};

// Mapa derivado del unico source of truth en `@/lib/constants` para evitar
// tener dos tablas de modalidades que se desincronicen en el futuro.
const EXPECTED_PLAYERS: Record<MatchModality, number> = Object.fromEntries(
  Object.entries(TEAM_SIZE_BY_MODALITY).map(([modality, teamSize]) => [modality, teamSize * 2])
) as Record<MatchModality, number>;

export type NewMatchDefaults = {
  modality: MatchModality;
  location?: string;
  scheduledTime?: string;
  playerIds: string[];
  goalkeeperPlayerIds: string[];
  guests: Array<{ name: string; rating: number }>;
  substituteAssignments?: SubstituteAssignment[];
};

export function NewMatchForm({
  defaultScheduledDate,
  organizationId,
  players,
  initialValues,
  defaultModality = "6v6",
  error
}: {
  defaultScheduledDate: string;
  organizationId: string;
  players: SelectablePlayer[];
  defaultModality?: MatchModality;
  initialValues?: NewMatchDefaults;
  error?: string;
}) {
  const [modality, setModality] = useState<MatchModality>(initialValues?.modality ?? defaultModality);
  const [selectedPlayers, setSelectedPlayers] = useState<Record<string, boolean>>(() => Object.fromEntries((initialValues?.playerIds ?? []).map((id) => [id, true])));
  const [goalkeeperPlayers, setGoalkeeperPlayers] = useState<Record<string, boolean>>(() => Object.fromEntries((initialValues?.goalkeeperPlayerIds ?? []).map((id) => [id, true])));
  const [guestRows, setGuestRows] = useState<GuestRow[]>(() => (initialValues?.guests ?? []).map((guest, index) => ({ key: index + 1, name: guest.name, rating: String(guest.rating) })));
  const [showManualBuilder, setShowManualBuilder] = useState(false);
  const [manualAssignments, setManualAssignments] = useState<Record<string, TeamSide>>({});
  const [substituteAssignments, setSubstituteAssignments] = useState<Record<string, TeamSide | null>>(
    () => Object.fromEntries((initialValues?.substituteAssignments ?? []).map((assignment) => [assignment.participantId, assignment.team]))
  );
  const [incompleteGuestKey, setIncompleteGuestKey] = useState<number | null>(null);
  const [playerSearch, setPlayerSearch] = useState("");
  const [onlySelected, setOnlySelected] = useState(false);
  const formId = useId();
  const normalizedSearch = playerSearch.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
  const visiblePlayerIds = new Set(players.filter((player) =>
    (!onlySelected || selectedPlayers[player.id]) &&
    player.full_name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").includes(normalizedSearch)
  ).map((player) => player.id));

  const expected = EXPECTED_PLAYERS[modality];
  const teamSize = expected / 2;
  const supportsSubstitutes = ["9v9", "10v10", "11v11"].includes(modality);

  const selectedRosterPlayers = useMemo(
    () => players.filter((player) => Boolean(selectedPlayers[player.id])),
    [players, selectedPlayers]
  );

  const selectedCount = selectedRosterPlayers.length;

  const validGuests = useMemo(
    () =>
      guestRows
        .map((guest) => {
          const name = guest.name.trim();
          const skillLevel = parseGuestSkillLevelValue(guest.rating.trim());
          if (!name || skillLevel === null) return null;
          return {
            key: String(guest.key),
            name,
            rating: skillLevel
          };
        })
        .filter((guest): guest is NonNullable<typeof guest> => guest !== null),
    [guestRows]
  );

  const validGuestCount = validGuests.length;
  const totalCurrent = selectedCount + validGuestCount;
  const activeSubstituteAssignments = useMemo<SubstituteAssignment[]>(() => {
    if (!supportsSubstitutes) return [];
    const participantIds = new Set([
      ...selectedRosterPlayers.map((player) => `player:${player.id}`),
      ...validGuests.map((guest) => `guest:${guest.key}`)
    ]);
    return Object.entries(substituteAssignments)
      .filter(([participantId]) => participantIds.has(participantId))
      .map(([participantId, team]) => ({ participantId, team }));
  }, [supportsSubstitutes, selectedRosterPlayers, validGuests, substituteAssignments]);
  const substituteIds = useMemo(
    () => new Set(activeSubstituteAssignments.map((assignment) => assignment.participantId)),
    [activeSubstituteAssignments]
  );
  const starterCount = totalCurrent - substituteIds.size;
  const showSubstitutePicker = supportsSubstitutes && (totalCurrent > expected || substituteIds.size > 0);

  const selectedGoalkeeperIds = useMemo(
    () =>
      Object.keys(goalkeeperPlayers).filter(
        (playerId) => Boolean(goalkeeperPlayers[playerId]) && Boolean(selectedPlayers[playerId])
      ),
    [goalkeeperPlayers, selectedPlayers]
  );

  const manualParticipants = useMemo<ManualParticipant[]>(
    () => [
      ...selectedRosterPlayers.map((player) => ({
        participantId: `player:${player.id}`,
        fullName: player.full_name,
        rating: Number(player.current_rating),
        skillLevel: player.skill_level,
        source: "player" as const
      })),
      ...validGuests.map((guest) => ({
        participantId: `guest:${guest.key}`,
        fullName: guest.name,
        rating: guest.rating,
        source: "guest" as const
      }))
    ].filter((participant) => !substituteIds.has(participant.participantId)),
    [selectedRosterPlayers, validGuests, substituteIds]
  );

  useEffect(() => {
    if (!showManualBuilder) return;

    setManualAssignments((current) => {
      const next: Record<string, TeamSide> = {};
      let changed = false;

      manualParticipants.forEach((participant, index) => {
        const fallbackTeam: TeamSide = index < teamSize ? "A" : "B";
        const currentTeam = current[participant.participantId];
        const normalizedTeam: TeamSide = currentTeam === "A" || currentTeam === "B" ? currentTeam : fallbackTeam;
        next[participant.participantId] = normalizedTeam;
        if (currentTeam !== normalizedTeam) {
          changed = true;
        }
      });

      for (const key of Object.keys(current)) {
        if (!(key in next)) {
          changed = true;
          break;
        }
      }

      return changed ? next : current;
    });
  }, [manualParticipants, showManualBuilder, teamSize]);

  const manualAssignmentsPayload = useMemo(
    () =>
      JSON.stringify(
        manualParticipants.map((participant, index) => ({
          participantId: participant.participantId,
          team: manualAssignments[participant.participantId] ?? (index < teamSize ? "A" : "B")
        }))
      ),
    [manualAssignments, manualParticipants, teamSize]
  );

  const manualTeamACount = useMemo(
    () =>
      manualParticipants.filter((participant, index) => {
        const assignedTeam = manualAssignments[participant.participantId] ?? (index < teamSize ? "A" : "B");
        return assignedTeam === "A";
      }).length,
    [manualAssignments, manualParticipants, teamSize]
  );
  const manualTeamBCount = manualParticipants.length - manualTeamACount;

  const goalkeepersReady = selectedGoalkeeperIds.length === 0 || selectedGoalkeeperIds.length === 2;
  const rosterComplete = starterCount === expected;
  const rosterStatus = (starterCount < expected
    ? `${expected - starterCount === 1 ? "Falta 1 convocado" : `Faltan ${expected - starterCount} convocados`} para completar ${expected}${supportsSubstitutes ? " titulares" : ""}.`
    : starterCount > expected
      ? `${starterCount - expected === 1 ? "Sobra 1 convocado" : `Sobran ${starterCount - expected} convocados`}. ${supportsSubstitutes ? "Marcá suplentes o quitá jugadores." : "Quitá jugadores o cambiá la modalidad."}`
      : `Convocatoria completa: ${starterCount} de ${expected}${supportsSubstitutes ? " titulares" : ""}.`)
    + (substituteIds.size ? ` Más ${substituteIds.size} ${substituteIds.size === 1 ? "suplente" : "suplentes"}.` : "");
  const goalkeepersSeparatedInManual = useMemo(() => {
    if (selectedGoalkeeperIds.length !== 2) return true;
    const first = manualAssignments[`player:${selectedGoalkeeperIds[0]}`];
    const second = manualAssignments[`player:${selectedGoalkeeperIds[1]}`];
    if (!first || !second) return false;
    return first !== second;
  }, [manualAssignments, selectedGoalkeeperIds]);

  const manualParticipantsComplete = manualParticipants.length === expected;
  const manualTeamsBalanced = manualTeamACount === teamSize && manualTeamBCount === teamSize;
  const canSubmitManual =
    showManualBuilder &&
    goalkeepersReady &&
    manualParticipantsComplete &&
    manualTeamsBalanced &&
    goalkeepersSeparatedInManual;

  const addGuest = () => {
    setGuestRows((current) => [
      ...current,
      {
        key: Date.now() + current.length,
        name: "",
        rating: ""
      }
    ]);
  };

  const removeGuest = (guestKey: number) => {
    setGuestRows((current) => current.filter((guest) => guest.key !== guestKey));
    updateParticipantRole(`guest:${guestKey}`, "starter");
  };

  const updateParticipantRole = (participantId: string, value: string) => {
    setSubstituteAssignments((current) => {
      const next = { ...current };
      if (value === "starter") delete next[participantId];
      else next[participantId] = value === "A" || value === "B" ? value : null;
      return next;
    });
  };

  const updateGuest = (guestKey: number, field: "name" | "rating", value: string) => {
    setGuestRows((current) =>
      current.map((guest) => (guest.key === guestKey ? { ...guest, [field]: value } : guest))
    );
  };

  const togglePlayerSelection = (playerId: string, checked: boolean) => {
    setSelectedPlayers((current) => ({
      ...current,
      [playerId]: checked
    }));

    if (!checked) {
      updateParticipantRole(`player:${playerId}`, "starter");
      setGoalkeeperPlayers((current) => {
        if (!current[playerId]) return current;
        const next = { ...current };
        delete next[playerId];
        return next;
      });
    }
  };

  const toggleGoalkeeperSelection = (playerId: string, checked: boolean) => {
    setGoalkeeperPlayers((current) => {
      if (!checked) {
        if (!current[playerId]) return current;
        const next = { ...current };
        delete next[playerId];
        return next;
      }

      const currentGoalkeepers = Object.keys(current).filter(
        (id) => Boolean(current[id]) && Boolean(selectedPlayers[id]) && id !== playerId
      );
      if (currentGoalkeepers.length >= 2) return current;
      return {
        ...current,
        [playerId]: true
      };
    });
  };

  return (
    <ActionForm action={createMatchFormAction} className="mt-4 space-y-4" onSubmit={(event) => {
      const incompleteGuest = guestRows.find((guest) =>
        (guest.name.trim() || guest.rating.trim()) &&
        (!guest.name.trim() || parseGuestSkillLevelValue(guest.rating) === null)
      );
      if (!incompleteGuest) return;
      event.preventDefault();
      setIncompleteGuestKey(incompleteGuest.key);
      const field = incompleteGuest.name.trim() ? "rating" : "name";
      event.currentTarget.querySelector<HTMLElement>(`[data-guest-key="${incompleteGuest.key}"] [data-guest-field="${field}"]`)?.focus();
    }}>
      <input name="organizationId" type="hidden" value={organizationId} />
      <input name="manualAssignmentsPayload" type="hidden" value={manualAssignmentsPayload} />
      <input name="substituteAssignmentsPayload" type="hidden" value={JSON.stringify(activeSubstituteAssignments)} />
      <div className="grid gap-3 md:grid-cols-3">
        <MatchDateTimeFields
          dateName="scheduledDate"
          defaultDate={defaultScheduledDate}
          defaultTime={initialValues?.scheduledTime}
          requiredTime
          timeName="scheduledTime"
        />
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="modality">
            Modalidad
          </label>
          <Select id="modality" name="modality" onChange={(event) => {
            setModality(event.target.value as MatchModality);
            if (!["9v9", "10v10", "11v11"].includes(event.target.value)) setSubstituteAssignments({});
          }} value={modality}>
            {MATCH_MODALITIES.map((modality) => (
              <option key={modality} value={modality}>
                {MATCH_MODALITY_LABELS[modality]} ({TEAM_SIZE_BY_MODALITY[modality] * 2} jugadores)
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="location">
            Ubicacion
          </label>
          <Input defaultValue={initialValues?.location} id="location" name="location" placeholder="Cancha / barrio" />
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-100">Jugadores registrados</p>
            <p className="text-xs text-slate-400">
              Selecciona jugadores fijos y completa invitados para llegar a {expected} {supportsSubstitutes ? "titulares" : "convocados"}.
            </p>
          </div>
          <p className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">
            {supportsSubstitutes ? "Titulares" : "Actual"}: {starterCount}/{expected}{substituteIds.size ? ` · ${substituteIds.size} suplentes` : ""}
          </p>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Si marcas arqueros, deben ser exactamente 2 y se reparten uno por equipo.
        </p>
        {supportsSubstitutes ? <p className="mt-2 rounded-lg border border-indigo-400/20 bg-indigo-500/10 p-3 text-sm text-indigo-200">
          Podés sumar suplentes y dejar su equipo para después. Al cargar la formación final, elegí el equipo de quienes jugaron para que también sumen o pierdan puntos.
        </p> : null}
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-semibold" htmlFor={`${formId}-player-search`}>Buscar jugador</label>
            <Input
              id={`${formId}-player-search`}
              onChange={(event) => setPlayerSearch(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}
              placeholder="Nombre del jugador"
              type="search"
              value={playerSearch}
            />
          </div>
          <div aria-label="Filtrar jugadores" className="flex gap-2" role="group">
            <Button aria-pressed={!onlySelected} onClick={() => setOnlySelected(false)} type="button" variant={!onlySelected ? "primary" : "secondary"}>Todos</Button>
            <Button aria-pressed={onlySelected} onClick={() => setOnlySelected(true)} type="button" variant={onlySelected ? "primary" : "secondary"}>Convocados ({selectedCount})</Button>
          </div>
        </div>
        <p aria-live="polite" className="mt-2 text-xs text-slate-400">{visiblePlayerIds.size ? `${visiblePlayerIds.size} jugadores en esta vista` : "No hay jugadores que coincidan con el filtro."}</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {players.map((player) => {
            const ratingTrendLabel = formatRatingTrendLabel(player.current_rating);
            const shouldShowRatingTrend = ratingTrendLabel !== "Parejo";

            return (
              <div
                className={cn(
                  "flex flex-col gap-3 rounded-lg border bg-slate-950 px-3 py-2 text-sm transition hover:border-slate-600 xl:flex-row xl:items-center xl:justify-between",
                  selectedPlayers[player.id] ? "border-emerald-500/50" : "border-slate-800",
                  !visiblePlayerIds.has(player.id) && "hidden"
                )}
                hidden={!visiblePlayerIds.has(player.id)}
                key={player.id}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <PlayerAvatar name={player.full_name} playerId={player.id} hasPhoto={Boolean(player.photo_path)} photoUpdatedAt={player.photo_updated_at} size="sm" />
                  <span className="min-w-0">
                    <span className="block break-words font-semibold text-slate-100">{player.full_name}</span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      <span className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
                        {formatSkillLevelLabel(player.skill_level)}
                      </span>
                      {shouldShowRatingTrend ? (
                        <span
                          className={cn(
                            "rounded border px-2 py-0.5 text-[11px] font-semibold",
                            ratingTrendLabel === "Viene bien"
                              ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                              : "border-amber-400/40 bg-amber-500/10 text-amber-200"
                          )}
                        >
                          {formatRatingTrendBadgeLabel(player.current_rating)}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2 xl:shrink-0">
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-700 px-2 py-1">
                    <span className="text-[11px] font-semibold uppercase text-slate-300">Juega</span>
                    <input
                      checked={Boolean(selectedPlayers[player.id])}
                      aria-label={`Juega ${player.full_name}`}
                      className="h-4 w-4 accent-emerald-400"
                      name="playerIds"
                      onChange={(event) => togglePlayerSelection(player.id, event.target.checked)}
                      type="checkbox"
                      value={player.id}
                    />
                  </label>
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-cyan-500/30 px-2 py-1">
                    <span className="text-[11px] font-semibold uppercase text-cyan-200">Arquero</span>
                    <input
                      checked={Boolean(goalkeeperPlayers[player.id]) && Boolean(selectedPlayers[player.id])}
                      aria-label={`Arquero ${player.full_name}`}
                      className="h-4 w-4 accent-cyan-400"
                      disabled={
                        !selectedPlayers[player.id] ||
                        substituteIds.has(`player:${player.id}`) ||
                        (!goalkeeperPlayers[player.id] && selectedGoalkeeperIds.length >= 2)
                      }
                      name="goalkeeperPlayerIds"
                      onChange={(event) => toggleGoalkeeperSelection(player.id, event.target.checked)}
                      type="checkbox"
                      value={player.id}
                    />
                  </label>
                </span>
              </div>
            );
          })}
        </div>
        {!goalkeepersReady ? (
          <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200">
            Si activas arqueros, deben ser exactamente 2.
          </p>
        ) : null}
        {selectedGoalkeeperIds.length === 2 ? (
          <p className="mt-3 text-xs text-cyan-200">
            Arqueros seleccionados:{" "}
            {selectedRosterPlayers
              .filter((player) => selectedGoalkeeperIds.includes(player.id))
              .map((player) => player.full_name)
              .join(" y ")}
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-100">Invitados (temporales)</p>
            <p className="text-xs text-slate-400">
              No se guardan como jugadores del grupo, pero si quedan en el historial del partido.
              {` ${GUEST_SKILL_LEVEL_HELP_TEXT}`}
            </p>
          </div>
          <Button onClick={addGuest} type="button" variant="ghost">
            Agregar invitado
          </Button>
        </div>

        {guestRows.length ? (
          <div className="mt-3 space-y-2">
            {guestRows.map((guest, index) => {
              const showGuestError = incompleteGuestKey === guest.key &&
                Boolean(guest.name.trim() || guest.rating.trim()) &&
                (!guest.name.trim() || parseGuestSkillLevelValue(guest.rating) === null);
              const guestErrorId = `${formId}-guest-${guest.key}-error`;
              return (
              <div
                className="grid gap-2 rounded-lg border border-slate-800 bg-slate-950 p-3 md:grid-cols-[minmax(180px,1.2fr)_minmax(180px,0.8fr)_auto]"
                data-guest-key={guest.key}
                key={guest.key}
              >
                <input name="guestKeys" type="hidden" value={String(guest.key)} />
                <Input
                  aria-describedby={showGuestError ? guestErrorId : undefined}
                  aria-invalid={showGuestError && !guest.name.trim() || undefined}
                  aria-label={`Nombre del invitado ${index + 1}`}
                  data-guest-field="name"
                  name="guestNames"
                  onChange={(event) => updateGuest(guest.key, "name", event.target.value)}
                  placeholder={`Nombre invitado #${index + 1}`}
                  value={guest.name}
                />
                <Select
                  aria-describedby={showGuestError ? guestErrorId : undefined}
                  aria-invalid={showGuestError && parseGuestSkillLevelValue(guest.rating) === null || undefined}
                  aria-label={`Nivel de ${guest.name.trim() || `invitado ${index + 1}`}`}
                  data-guest-field="rating"
                  name="guestRatings"
                  onChange={(event) => updateGuest(guest.key, "rating", event.target.value)}
                  value={guest.rating}
                >
                  <option value="">Nivel del invitado</option>
                  {GUEST_SKILL_LEVEL_OPTIONS.map((level) => (
                    <option key={level} value={level}>
                      {formatGuestSkillLevelLabel(level)}
                    </option>
                  ))}
                </Select>
                <Button onClick={() => removeGuest(guest.key)} type="button" variant="danger">
                  Quitar
                </Button>
                {showGuestError ? <p className="text-sm text-danger md:col-span-3" id={guestErrorId} role="alert">Completá el nombre y el nivel del invitado {index + 1}, o quitá la fila.</p> : null}
              </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-400">Aun no agregaste invitados.</p>
        )}
      </div>

      {showSubstitutePicker ? (
        <section aria-labelledby={`${formId}-substitutes-title`} className="rounded-xl border border-amber-500/30 bg-slate-900 p-3">
          <h3 className="text-sm font-semibold text-amber-100" id={`${formId}-substitutes-title`}>Elegí los suplentes</h3>
          <p className="mt-1 text-xs text-slate-300">
            Hay {totalCurrent} convocados para {expected} titulares. Elegí quiénes quedan como suplentes y, si ya lo sabés, su equipo.
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {selectedRosterPlayers.map((player) => {
              const participantId = `player:${player.id}`;
              return (
                <div className="grid min-w-0 gap-2 rounded-lg border border-slate-700 bg-slate-950 p-2 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,auto)] sm:items-center" key={participantId}>
                  <span className="min-w-0 break-words text-sm font-medium text-slate-100">{player.full_name}</span>
                  <Select
                    aria-label={`Rol de ${player.full_name}`}
                    disabled={Boolean(goalkeeperPlayers[player.id])}
                    onChange={(event) => updateParticipantRole(participantId, event.target.value)}
                    value={substituteIds.has(participantId) ? substituteAssignments[participantId] ?? "substitute" : "starter"}
                  >
                    <option value="starter">Titular</option>
                    <option value="substitute">Suplente · sin equipo</option>
                    <option value="A">Suplente · primer equipo</option>
                    <option value="B">Suplente · segundo equipo</option>
                  </Select>
                </div>
              );
            })}
            {validGuests.map((guest) => {
              const participantId = `guest:${guest.key}`;
              return (
                <div className="grid min-w-0 gap-2 rounded-lg border border-slate-700 bg-slate-950 p-2 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,auto)] sm:items-center" key={participantId}>
                  <span className="min-w-0 break-words text-sm font-medium text-slate-100">{guest.name} · invitado</span>
                  <Select
                    aria-label={`Rol de ${guest.name}`}
                    onChange={(event) => updateParticipantRole(participantId, event.target.value)}
                    value={substituteIds.has(participantId) ? substituteAssignments[participantId] ?? "substitute" : "starter"}
                  >
                    <option value="starter">Titular</option>
                    <option value="substitute">Suplente · sin equipo</option>
                    <option value="A">Suplente · primer equipo</option>
                    <option value="B">Suplente · segundo equipo</option>
                  </Select>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {showManualBuilder ? (
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-100">Armado manual de equipos</p>
              <p className="text-xs text-slate-400">
                Asigna cada {supportsSubstitutes ? "titular" : "convocado"} al primer o segundo equipo. Deben quedar {teamSize} por lado.
              </p>
            </div>
            <p className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">
              Primer equipo: {manualTeamACount}/{teamSize} | Segundo equipo: {manualTeamBCount}/{teamSize}
            </p>
          </div>

          {manualParticipants.length ? (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {manualParticipants.map((participant, index) => {
                const assignedTeam = manualAssignments[participant.participantId] ?? (index < teamSize ? "A" : "B");
                const ratingTrendLabel = formatRatingTrendLabel(participant.rating);
                const registeredPlayerDetails = [
                  "Jugador",
                  formatSkillLevelLabel(participant.skillLevel),
                  ...(ratingTrendLabel === "Parejo" ? [] : [formatRatingTrendBadgeLabel(participant.rating)])
                ].join(" | ");

                return (
                  <div
                    className="grid gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 md:grid-cols-[1fr_130px]"
                    key={participant.participantId}
                  >
                    <div className="text-sm text-slate-100">
                      <span>{participant.fullName}</span>
                      <span className="ml-2 text-xs text-slate-400">
                        {participant.source === "guest"
                          ? `Invitado | ${formatGuestSkillLevelLabel(participant.rating)}`
                          : registeredPlayerDetails}
                      </span>
                    </div>
                    <Select
                      aria-label={`Equipo de ${participant.fullName}`}
                      onChange={(event) =>
                        setManualAssignments((current) => ({
                          ...current,
                          [participant.participantId]: event.target.value as TeamSide
                        }))
                      }
                      value={assignedTeam}
                    >
                      <option value="A">Primer equipo</option>
                      <option value="B">Segundo equipo</option>
                    </Select>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-400">Selecciona convocados para empezar el armado manual.</p>
          )}

          {!manualParticipantsComplete ? (
            <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200">
              Para crear el partido manual debes completar exactamente {expected} convocados.
            </p>
          ) : null}
          {!manualTeamsBalanced ? (
            <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200">
              Los equipos manuales deben quedar en {teamSize} vs {teamSize}.
            </p>
          ) : null}
          {selectedGoalkeeperIds.length === 2 && !goalkeepersSeparatedInManual ? (
            <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200">
              Los dos arqueros deben quedar en equipos separados.
            </p>
          ) : null}

          <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950 p-3">
            <p className="text-sm font-semibold text-slate-100">Nombres para compartir</p>
            <p className="text-xs text-slate-400">
              Si los dejas vacios se publican como {DEFAULT_TEAM_A_LABEL} y {DEFAULT_TEAM_B_LABEL}.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="teamALabel">
                  Nombre del primer equipo
                </label>
                <Input
                  id="teamALabel"
                  maxLength={TEAM_LABEL_MAX_LENGTH}
                  name="teamALabel"
                  placeholder={DEFAULT_TEAM_A_LABEL}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="teamBLabel">
                  Nombre del segundo equipo
                </label>
                <Input
                  id="teamBLabel"
                  maxLength={TEAM_LABEL_MAX_LENGTH}
                  name="teamBLabel"
                  placeholder={DEFAULT_TEAM_B_LABEL}
                />
              </div>
            </div>
          </div>

          <div className="mt-3">
            <FormSubmitButton
              disabled={!canSubmitManual}
              name="creationMode"
              pendingLabel="Creando partido..."
              value="manual"
            >
              Crear partido con equipos manuales
            </FormSubmitButton>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm font-semibold text-danger" role="alert">{error}</p> : null}
      <div className="sticky bottom-3 z-20 rounded-xl border border-slate-600 bg-slate-950/95 p-3 shadow-lg backdrop-blur">
      <p className="mb-3 text-sm text-slate-200" id={`${formId}-roster-status`} role="status">
        {rosterStatus}
        {!goalkeepersReady ? " Elegiste un arquero: marcá el segundo o desmarcá el actual." : ""}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <FormSubmitButton aria-describedby={`${formId}-roster-status`} className="w-full sm:w-auto" disabled={!rosterComplete || !goalkeepersReady} name="creationMode" pendingLabel="Generando equipos..." value="auto">
          Crear partido y generar equipos
        </FormSubmitButton>
        <Button onClick={() => setShowManualBuilder((current) => !current)} type="button" variant="secondary">
          {showManualBuilder ? "Ocultar armado manual" : "Armar equipos yo mismo"}
        </Button>
      </div>
      </div>
    </ActionForm>
  );
}
