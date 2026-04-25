"use client";

import { useEffect, useMemo, useState } from "react";

import { createMatchAction } from "@/app/admin/(panel)/matches/new/actions";
import { Button } from "@/components/ui/button";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { Input } from "@/components/ui/input";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { Select } from "@/components/ui/select";
import { TEAM_SIZE_BY_MODALITY } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { MatchModality, TeamSide } from "@/types/domain";

type SelectablePlayer = {
  id: string;
  full_name: string;
  current_rating: number;
  initial_rank: number;
  skill_level: number;
  display_order?: number;
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
  source: "player" | "guest";
};

// Mapa derivado del unico source of truth en `@/lib/constants` para evitar
// tener dos tablas de modalidades que se desincronicen en el futuro.
const EXPECTED_PLAYERS: Record<MatchModality, number> = Object.fromEntries(
  Object.entries(TEAM_SIZE_BY_MODALITY).map(([modality, teamSize]) => [modality, teamSize * 2])
) as Record<MatchModality, number>;

const SKILL_LEVEL_OPTIONS = [1, 2, 3, 4, 5] as const;

function parseGuestSkillLevel(rawValue: string) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5) return null;
  return Math.trunc(parsed);
}

export function NewMatchForm({
  organizationId,
  players,
  error
}: {
  organizationId: string;
  players: SelectablePlayer[];
  error?: string;
}) {
  const [modality, setModality] = useState<MatchModality>("6v6");
  const [selectedPlayers, setSelectedPlayers] = useState<Record<string, boolean>>({});
  const [goalkeeperPlayers, setGoalkeeperPlayers] = useState<Record<string, boolean>>({});
  const [guestRows, setGuestRows] = useState<GuestRow[]>([]);
  const [showManualBuilder, setShowManualBuilder] = useState(false);
  const [manualAssignments, setManualAssignments] = useState<Record<string, TeamSide>>({});

  const expected = EXPECTED_PLAYERS[modality];
  const teamSize = expected / 2;

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
          const skillLevel = parseGuestSkillLevel(guest.rating.trim());
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
        source: "player" as const
      })),
      ...validGuests.map((guest) => ({
        participantId: `guest:${guest.key}`,
        fullName: guest.name,
        rating: guest.rating,
        source: "guest" as const
      }))
    ],
    [selectedRosterPlayers, validGuests]
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
    <form action={createMatchAction} className="mt-4 space-y-4">
      <input name="organizationId" type="hidden" value={organizationId} />
      <input name="manualAssignmentsPayload" type="hidden" value={manualAssignmentsPayload} />
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="scheduledAt">
            Fecha y hora
          </label>
          <Input id="scheduledAt" name="scheduledAt" required type="datetime-local" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="modality">
            Modalidad
          </label>
          <Select id="modality" name="modality" onChange={(event) => setModality(event.target.value as MatchModality)} value={modality}>
            <option value="5v5">5 vs 5 (10 jugadores)</option>
            <option value="6v6">6 vs 6 (12 jugadores)</option>
            <option value="7v7">7 vs 7 (14 jugadores)</option>
            <option value="9v9">9 vs 9 (18 jugadores)</option>
            <option value="11v11">11 vs 11 (22 jugadores)</option>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="location">
            Ubicacion
          </label>
          <Input id="location" name="location" placeholder="Cancha / barrio" />
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-100">Jugadores registrados</p>
            <p className="text-xs text-slate-400">
              Selecciona jugadores fijos y completa invitados para llegar a {expected} convocados.
            </p>
          </div>
          <p className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">
            Actual: {totalCurrent}/{expected}
          </p>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Si marcas arqueros, deben ser exactamente 2 y se reparten uno por equipo.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {players.map((player) => (
            <label
              className={cn(
                "flex items-center justify-between rounded-lg border bg-slate-950 px-3 py-2 text-sm transition hover:border-slate-600",
                selectedPlayers[player.id] ? "border-emerald-500/50" : "border-slate-800"
              )}
              key={player.id}
            >
              <span className="flex items-center gap-3">
                <PlayerAvatar name={player.full_name} playerId={player.id} size="sm" />
                <span>
                  {player.full_name} <span className="text-xs text-slate-500">(Nivel {player.skill_level})</span>
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className="text-xs font-semibold text-emerald-300">{Number(player.current_rating).toFixed(2)}</span>
                <span className="flex items-center gap-1 rounded border border-slate-700 px-2 py-1">
                  <span className="text-[11px] font-semibold uppercase text-slate-300">Juega</span>
                  <input
                    checked={Boolean(selectedPlayers[player.id])}
                    name="playerIds"
                    onChange={(event) => togglePlayerSelection(player.id, event.target.checked)}
                    type="checkbox"
                    value={player.id}
                  />
                </span>
                <span className="flex items-center gap-1 rounded border border-cyan-500/30 px-2 py-1">
                  <span className="text-[11px] font-semibold uppercase text-cyan-200">Arquero</span>
                  <input
                    checked={Boolean(goalkeeperPlayers[player.id]) && Boolean(selectedPlayers[player.id])}
                    disabled={
                      !selectedPlayers[player.id] ||
                      (!goalkeeperPlayers[player.id] && selectedGoalkeeperIds.length >= 2)
                    }
                    name="goalkeeperPlayerIds"
                    onChange={(event) => toggleGoalkeeperSelection(player.id, event.target.checked)}
                    type="checkbox"
                    value={player.id}
                  />
                </span>
              </span>
            </label>
          ))}
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
              No se guardan como jugadores del club, pero si quedan en el historial del partido. El nivel equivalente
              usa 1 como mas fuerte y 5 como mas bajo.
            </p>
          </div>
          <Button onClick={addGuest} type="button" variant="ghost">
            Agregar invitado
          </Button>
        </div>

        {guestRows.length ? (
          <div className="mt-3 space-y-2">
            {guestRows.map((guest, index) => (
              <div className="grid gap-2 rounded-lg border border-slate-800 bg-slate-950 p-3 md:grid-cols-[1.2fr_0.6fr_auto]" key={guest.key}>
                <input name="guestKeys" type="hidden" value={String(guest.key)} />
                <Input
                  name="guestNames"
                  onChange={(event) => updateGuest(guest.key, "name", event.target.value)}
                  placeholder={`Nombre invitado #${index + 1}`}
                  value={guest.name}
                />
                <Select
                  name="guestRatings"
                  onChange={(event) => updateGuest(guest.key, "rating", event.target.value)}
                  value={guest.rating}
                >
                  <option value="">Nivel equivalente</option>
                  {SKILL_LEVEL_OPTIONS.map((level) => (
                    <option key={level} value={level}>
                      Nivel {level}
                    </option>
                  ))}
                </Select>
                <Button onClick={() => removeGuest(guest.key)} type="button" variant="danger">
                  Quitar
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-400">Aun no agregaste invitados.</p>
        )}
      </div>

      {showManualBuilder ? (
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-100">Armado manual de equipos</p>
              <p className="text-xs text-slate-400">
                Asigna cada convocado al equipo A o B. Deben quedar {teamSize} por lado.
              </p>
            </div>
            <p className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">
              Equipo A: {manualTeamACount}/{teamSize} | Equipo B: {manualTeamBCount}/{teamSize}
            </p>
          </div>

          {manualParticipants.length ? (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {manualParticipants.map((participant, index) => {
                const assignedTeam = manualAssignments[participant.participantId] ?? (index < teamSize ? "A" : "B");
                return (
                  <div
                    className="grid gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 md:grid-cols-[1fr_130px]"
                    key={participant.participantId}
                  >
                    <div className="text-sm text-slate-100">
                      <span>{participant.fullName}</span>
                      <span className="ml-2 text-xs text-slate-400">
                        {participant.source === "guest"
                          ? `Invitado | Nivel ${participant.rating}`
                          : `Jugador | rating ${participant.rating.toFixed(2)}`}
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
                      <option value="A">Equipo A</option>
                      <option value="B">Equipo B</option>
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

      {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <FormSubmitButton name="creationMode" pendingLabel="Generando equipos..." value="auto">
          Crear partido y generar equipos
        </FormSubmitButton>
        <Button onClick={() => setShowManualBuilder((current) => !current)} type="button" variant="secondary">
          {showManualBuilder ? "Ocultar armado manual" : "Armar equipos yo mismo"}
        </Button>
      </div>
    </form>
  );
}
