"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  formatGuestSkillLevelLabel,
  GUEST_SKILL_LEVEL_HELP_TEXT,
  GUEST_SKILL_LEVEL_OPTIONS,
  parseGuestSkillLevelValue
} from "@/lib/domain/skill-level";
import { DEFAULT_TEAM_A_LABEL, DEFAULT_TEAM_B_LABEL } from "@/lib/team-labels";
import { formatRendimiento } from "@/lib/utils";
import type { TeamSide } from "@/types/domain";

type ExistingParticipant = {
  participantId: string;
  fullName: string;
  rating: number;
  source: "player" | "guest";
  initialTeam: TeamSide;
};

type ReplacementPlayerOption = {
  id: string;
  fullName: string;
  rating: number;
};

type ReplacementPlayerDraft = {
  playerId: string;
  team: TeamSide;
};

type GuestDraft = {
  id: number;
  name: string;
  rating: string;
  team: TeamSide;
};

type MatchResultEditorProps = {
  action?: (formData: FormData) => void | Promise<void>;
  onSubmit?: (payload: {
    scoreA: number;
    scoreB: number;
      notes?: string;
      mvpParticipantId?: string | null;
      lineup?: {
        assignments: Array<{
          participantId: string;
          team: "A" | "B" | "OUT";
        }>;
        absencePenaltyParticipantIds?: string[];
        newGuests?: Array<{
          clientId?: string;
          name: string;
        rating: number;
        team: "A" | "B";
      }>;
      newPlayers?: Array<{
        playerId: string;
        team: "A" | "B";
      }>;
      handicapTeam?: TeamSide | null;
    };
  }) => Promise<void>;
  existingParticipants: ExistingParticipant[];
  availablePlayers?: ReplacementPlayerOption[];
  defaultScoreA: number;
  defaultScoreB: number;
  defaultMvpParticipantId?: string | null;
  defaultNotes?: string | null;
  submitLabel: string;
  teamALabel?: string;
  teamBLabel?: string;
};

function isValidGuest(guest: GuestDraft) {
  return guest.name.trim().length > 0 && parseGuestSkillLevelValue(guest.rating) !== null;
}

export function MatchResultEditor({
  action,
  onSubmit,
  existingParticipants,
  availablePlayers = [],
  defaultScoreA,
  defaultScoreB,
  defaultMvpParticipantId = null,
  defaultNotes,
  submitLabel,
  teamALabel = DEFAULT_TEAM_A_LABEL,
  teamBLabel = DEFAULT_TEAM_B_LABEL
}: MatchResultEditorProps) {
  const [assignments, setAssignments] = useState<Record<string, "A" | "B" | "OUT">>(() => {
    const initial: Record<string, "A" | "B" | "OUT"> = {};
    existingParticipants.forEach((participant) => {
      initial[participant.participantId] = participant.initialTeam;
    });
    return initial;
  });
  const [guestSequence, setGuestSequence] = useState(1);
  const [newGuests, setNewGuests] = useState<GuestDraft[]>([]);
  const [replacementPlayers, setReplacementPlayers] = useState<ReplacementPlayerDraft[]>([]);
  const [absencePenalties, setAbsencePenalties] = useState<Set<string>>(() => new Set());
  const [selectedReplacementPlayerId, setSelectedReplacementPlayerId] = useState("");
  const [selectedReplacementTeam, setSelectedReplacementTeam] = useState<TeamSide>("A");
  const [handicapEnabled, setHandicapEnabled] = useState(false);
  const [handicapTeam, setHandicapTeam] = useState<TeamSide>("A");
  const [selectedMvpParticipantId, setSelectedMvpParticipantId] = useState(defaultMvpParticipantId ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const existingPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const participant of existingParticipants) {
      if (participant.source !== "player") continue;
      if (!participant.participantId.startsWith("player:")) continue;
      ids.add(participant.participantId.slice("player:".length));
    }
    return ids;
  }, [existingParticipants]);

  const replacementPlayerIds = useMemo(
    () => new Set(replacementPlayers.map((player) => player.playerId)),
    [replacementPlayers]
  );

  const availableReplacementPlayers = useMemo(
    () =>
      availablePlayers.filter(
        (player) => !existingPlayerIds.has(player.id) && !replacementPlayerIds.has(player.id)
      ),
    [availablePlayers, existingPlayerIds, replacementPlayerIds]
  );

  useEffect(() => {
    if (
      selectedReplacementPlayerId &&
      availableReplacementPlayers.some((player) => player.id === selectedReplacementPlayerId)
    ) {
      return;
    }
    setSelectedReplacementPlayerId(availableReplacementPlayers[0]?.id ?? "");
  }, [availableReplacementPlayers, selectedReplacementPlayerId]);

  const playersById = useMemo(
    () => new Map(availablePlayers.map((player) => [player.id, player])),
    [availablePlayers]
  );

  const validNewGuests = useMemo(() => newGuests.filter((guest) => isValidGuest(guest)), [newGuests]);
  const mvpOptions = useMemo(() => {
    const existingOptions = existingParticipants
      .filter((participant) => assignments[participant.participantId] !== "OUT")
      .map((participant) => ({
        participantId: participant.participantId,
        label: participant.source === "guest" ? `${participant.fullName} (invitado)` : participant.fullName
      }));
    const replacementOptions = replacementPlayers
      .map((player) => {
        const playerData = playersById.get(player.playerId);
        if (!playerData) return null;
        return {
          participantId: `player:${player.playerId}`,
          label: playerData.fullName
        };
      })
      .filter((value): value is { participantId: string; label: string } => value !== null);
    const newGuestOptions = validNewGuests.map((guest) => ({
      participantId: `newGuest:${guest.id}`,
      label: `${guest.name.trim()} (invitado)`
    }));

    return [...existingOptions, ...replacementOptions, ...newGuestOptions];
  }, [assignments, existingParticipants, playersById, replacementPlayers, validNewGuests]);
  const teamACount = useMemo(() => {
    const fromParticipants = existingParticipants.filter((participant) => assignments[participant.participantId] === "A").length;
    const fromReplacementPlayers = replacementPlayers.filter((player) => player.team === "A").length;
    const fromGuests = validNewGuests.filter((guest) => guest.team === "A").length;
    return fromParticipants + fromReplacementPlayers + fromGuests;
  }, [assignments, existingParticipants, replacementPlayers, validNewGuests]);
  const teamBCount = useMemo(() => {
    const fromParticipants = existingParticipants.filter((participant) => assignments[participant.participantId] === "B").length;
    const fromReplacementPlayers = replacementPlayers.filter((player) => player.team === "B").length;
    const fromGuests = validNewGuests.filter((guest) => guest.team === "B").length;
    return fromParticipants + fromReplacementPlayers + fromGuests;
  }, [assignments, existingParticipants, replacementPlayers, validNewGuests]);
  const teamADisplayNames = useMemo(
    () => [
      ...existingParticipants
        .filter((participant) => assignments[participant.participantId] === "A")
        .map((participant) => participant.fullName),
      ...replacementPlayers
        .filter((player) => player.team === "A")
        .map((player) => playersById.get(player.playerId)?.fullName ?? "Jugador"),
      ...validNewGuests.filter((guest) => guest.team === "A").map((guest) => guest.name.trim())
    ],
    [assignments, existingParticipants, playersById, replacementPlayers, validNewGuests]
  );
  const teamBDisplayNames = useMemo(
    () => [
      ...existingParticipants
        .filter((participant) => assignments[participant.participantId] === "B")
        .map((participant) => participant.fullName),
      ...replacementPlayers
        .filter((player) => player.team === "B")
        .map((player) => playersById.get(player.playerId)?.fullName ?? "Jugador"),
      ...validNewGuests.filter((guest) => guest.team === "B").map((guest) => guest.name.trim())
    ],
    [assignments, existingParticipants, playersById, replacementPlayers, validNewGuests]
  );

  useEffect(() => {
    if (!handicapEnabled) return;
    if (teamACount === teamBCount) return;
    setHandicapTeam(teamACount < teamBCount ? "A" : "B");
  }, [handicapEnabled, teamACount, teamBCount]);

  useEffect(() => {
    setAbsencePenalties((current) => {
      const next = new Set<string>();
      for (const participantId of current) {
        const participant = existingParticipants.find((item) => item.participantId === participantId);
        if (!participant || participant.source !== "player") continue;
        if (assignments[participantId] !== "OUT") continue;
        next.add(participantId);
      }
      return next.size === current.size ? current : next;
    });
  }, [assignments, existingParticipants]);

  useEffect(() => {
    if (!selectedMvpParticipantId) return;
    if (mvpOptions.some((option) => option.participantId === selectedMvpParticipantId)) return;
    setSelectedMvpParticipantId("");
  }, [mvpOptions, selectedMvpParticipantId]);

  const lineupPayload = useMemo(
    () =>
      JSON.stringify({
        assignments: existingParticipants.map((participant) => ({
          participantId: participant.participantId,
          team: assignments[participant.participantId] ?? "OUT"
        })),
        absencePenaltyParticipantIds: Array.from(absencePenalties),
        newGuests: validNewGuests.map((guest) => ({
          clientId: String(guest.id),
          name: guest.name.trim(),
          rating: parseGuestSkillLevelValue(guest.rating) ?? 3,
          team: guest.team
        })),
        newPlayers: replacementPlayers.map((player) => ({
          playerId: player.playerId,
          team: player.team
        })),
        handicapTeam: handicapEnabled ? handicapTeam : null
      }),
    [absencePenalties, assignments, existingParticipants, handicapEnabled, handicapTeam, replacementPlayers, validNewGuests]
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!onSubmit) return;
    event.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      const scoreA = Number(formData.get("scoreA"));
      const scoreB = Number(formData.get("scoreB"));
      const notesRaw = formData.get("notes");
      const notes = typeof notesRaw === "string" ? notesRaw : "";

      if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) {
        throw new Error("Los puntajes deben ser numeros validos.");
      }

      await onSubmit({
        scoreA,
        scoreB,
        notes,
        mvpParticipantId: selectedMvpParticipantId || null,
        lineup: {
          assignments: existingParticipants.map((participant) => ({
            participantId: participant.participantId,
            team: assignments[participant.participantId] ?? "OUT"
          })),
          absencePenaltyParticipantIds: Array.from(absencePenalties),
          newGuests: validNewGuests.map((guest) => ({
            clientId: String(guest.id),
            name: guest.name.trim(),
            rating: parseGuestSkillLevelValue(guest.rating) ?? 3,
            team: guest.team
          })),
          newPlayers: replacementPlayers.map((player) => ({
            playerId: player.playerId,
            team: player.team
          })),
          handicapTeam: handicapEnabled ? handicapTeam : null
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo guardar resultado.";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form action={onSubmit ? undefined : action} className="mt-4 space-y-4" onSubmit={onSubmit ? handleSubmit : undefined}>
      <input name="lineupPayload" type="hidden" value={lineupPayload} />
      <input name="mvpParticipantId" type="hidden" value={selectedMvpParticipantId} />

      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Resultado final
        </p>
        <p className="mt-1 text-xl font-black text-white">
          {teamALabel} vs {teamBLabel}
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Equipo {teamALabel}
          </p>
          <p className="mt-2 text-sm text-slate-200">
            {teamADisplayNames.length ? teamADisplayNames.join(", ") : "Sin jugadores asignados"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Equipo {teamBLabel}
          </p>
          <p className="mt-2 text-sm text-slate-200">
            {teamBDisplayNames.length ? teamBDisplayNames.join(", ") : "Sin jugadores asignados"}
          </p>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-4">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="scoreA">
            Goles de {teamALabel}
          </label>
          <Input defaultValue={defaultScoreA} id="scoreA" min={0} name="scoreA" required type="number" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="scoreB">
            Goles de {teamBLabel}
          </label>
          <Input defaultValue={defaultScoreB} id="scoreB" min={0} name="scoreB" required type="number" />
        </div>
        <Textarea
          className="md:col-span-2"
          defaultValue={defaultNotes ?? ""}
          name="notes"
          placeholder="Notas opcionales"
          rows={3}
        />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="mvpParticipantIdSelect">
          MVP del partido
        </label>
        <Select
          disabled={!mvpOptions.length}
          id="mvpParticipantIdSelect"
          onChange={(event) => setSelectedMvpParticipantId(event.target.value)}
          value={selectedMvpParticipantId}
        >
          <option value="">Sin MVP</option>
          {mvpOptions.map((option) => (
            <option key={option.participantId} value={option.participantId}>
              {option.label}
            </option>
          ))}
        </Select>
        <p className="mt-1 text-xs text-slate-400">
          Si el MVP es jugador registrado suma +5. Si es invitado queda registrado sin bonus.
        </p>
      </div>

      <details className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <summary className="flex cursor-pointer list-none flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>
            <span className="block text-sm font-semibold text-slate-100">Formacion final</span>
            <span className="mt-1 block text-xs text-slate-400">
              Cambia equipos, marca quien no asistio y aplica penalizacion solo si corresponde. {teamALabel}: {teamACount} | {teamBLabel}: {teamBCount}
            </span>
          </span>
          <span className="inline-flex w-fit items-center justify-center rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100">
            Editar formacion
          </span>
        </summary>
        <div className="mt-3 space-y-2">
          {existingParticipants.map((participant) => (
            <div
              className="grid gap-2 rounded-lg border border-slate-800 bg-slate-900/80 p-2 md:grid-cols-[1fr_180px_minmax(190px,auto)]"
              key={participant.participantId}
            >
              <div className="text-sm text-slate-200">
                {participant.fullName}
                <span className="ml-2 text-xs text-slate-400">
                  {participant.source === "guest" ? "Invitado" : `Rendimiento ${formatRendimiento(participant.rating)}`}
                </span>
              </div>
              <Select
                aria-label={`Equipo de ${participant.fullName}`}
                onChange={(event) =>
                  setAssignments((current) => ({
                    ...current,
                    [participant.participantId]: event.target.value as "A" | "B" | "OUT"
                  }))
                }
                value={assignments[participant.participantId] ?? "OUT"}
              >
                <option value="A">{teamALabel}</option>
                <option value="B">{teamBLabel}</option>
                <option value="OUT">No asistio / no juega</option>
              </Select>
              {participant.source === "player" && assignments[participant.participantId] === "OUT" ? (
                <label className="flex items-center gap-2 text-xs font-semibold text-amber-200">
                  <input
                    checked={absencePenalties.has(participant.participantId)}
                    className="h-4 w-4 accent-amber-400"
                    onChange={(event) =>
                      setAbsencePenalties((current) => {
                        const next = new Set(current);
                        if (event.target.checked) {
                          next.add(participant.participantId);
                        } else {
                          next.delete(participant.participantId);
                        }
                        return next;
                      })
                    }
                    type="checkbox"
                  />
                  Restar 20 a {participant.fullName} por ausencia
                </label>
              ) : (
                <span className="text-xs text-slate-500 md:self-center">
                  Sin penalizacion
                </span>
              )}
            </div>
          ))}
        </div>
      </details>

      <details className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <summary className="flex cursor-pointer list-none flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>
            <span className="block text-sm font-semibold text-slate-100">Invitados y reemplazos</span>
            <span className="mt-1 block text-xs text-slate-400">
              Usa reemplazos para jugadores del grupo que entraron al partido; usa invitados para personas que no estan cargadas.
            </span>
          </span>
          <span className="inline-flex w-fit items-center justify-center rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100">
            Agregar cambios
          </span>
        </summary>

        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
        <p className="text-sm font-semibold text-slate-100">Reemplazos de plantilla</p>
        <p className="mt-1 text-xs text-slate-400">
          Agrega jugadores ya cargados en el grupo que reemplazaron a alguien en la formacion confirmada.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_130px_auto]">
          <Select
            aria-label="Jugador de reemplazo"
            disabled={!availableReplacementPlayers.length}
            onChange={(event) => setSelectedReplacementPlayerId(event.target.value)}
            value={selectedReplacementPlayerId}
          >
            {!availableReplacementPlayers.length ? (
              <option value="">No hay jugadores disponibles</option>
            ) : null}
            {availableReplacementPlayers.map((player) => (
              <option key={player.id} value={player.id}>
                {player.fullName} ({formatRendimiento(player.rating)})
              </option>
            ))}
          </Select>
          <Select
            aria-label="Equipo del reemplazo"
            onChange={(event) => setSelectedReplacementTeam(event.target.value as TeamSide)}
            value={selectedReplacementTeam}
          >
            <option value="A">{teamALabel}</option>
            <option value="B">{teamBLabel}</option>
          </Select>
          <Button
            disabled={!selectedReplacementPlayerId}
            onClick={() => {
              if (!selectedReplacementPlayerId) return;
              setReplacementPlayers((current) => [
                ...current,
                { playerId: selectedReplacementPlayerId, team: selectedReplacementTeam }
              ]);
            }}
            type="button"
            variant="ghost"
          >
            Agregar
          </Button>
        </div>
        <div className="mt-3 space-y-2">
          {replacementPlayers.map((player) => {
            const playerData = playersById.get(player.playerId);
            return (
              <div
                className="grid gap-2 rounded-lg border border-slate-800 bg-slate-900/80 p-2 md:grid-cols-[1fr_130px_auto]"
                key={player.playerId}
              >
                <div className="text-sm text-slate-200">
                  {playerData?.fullName ?? "Jugador"}
                  <span className="ml-2 text-xs text-slate-400">
                    {playerData ? formatRendimiento(playerData.rating) : "-"}
                  </span>
                </div>
                <Select
                  aria-label={`Equipo de ${playerData?.fullName ?? "Jugador"}`}
                  onChange={(event) =>
                    setReplacementPlayers((current) =>
                      current.map((item) =>
                        item.playerId === player.playerId
                          ? { ...item, team: event.target.value as TeamSide }
                          : item
                      )
                    )
                  }
                  value={player.team}
                >
                  <option value="A">{teamALabel}</option>
                  <option value="B">{teamBLabel}</option>
                </Select>
                <Button
                  onClick={() =>
                    setReplacementPlayers((current) =>
                      current.filter((item) => item.playerId !== player.playerId)
                    )
                  }
                  type="button"
                  variant="danger"
                >
                  Quitar
                </Button>
              </div>
            );
          })}
          {!replacementPlayers.length ? (
            <p className="text-xs text-slate-500">No hay reemplazos agregados.</p>
          ) : null}
        </div>
        </div>

        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-100">Invitados de reemplazo</p>
            <p className="text-xs text-slate-400">
              Carga aca a quien jugo pero no existe en el pool del grupo. {GUEST_SKILL_LEVEL_HELP_TEXT}
            </p>
          </div>
          <Button
            onClick={() => {
              setNewGuests((current) => [
                ...current,
                {
                  id: guestSequence,
                  name: "",
                  rating: "",
                  team: "A"
                }
              ]);
              setGuestSequence((value) => value + 1);
            }}
            type="button"
            variant="ghost"
          >
            Agregar invitado
          </Button>
        </div>
        <div className="mt-3 space-y-2">
          {newGuests.map((guest) => (
            <div
              className="grid gap-2 rounded-lg border border-slate-800 bg-slate-900/80 p-2 md:grid-cols-[1fr_200px_130px_96px]"
              key={guest.id}
            >
              <Input
                onChange={(event) =>
                  setNewGuests((current) =>
                    current.map((item) =>
                      item.id === guest.id ? { ...item, name: event.target.value } : item
                    )
                  )
                }
                placeholder="Nombre invitado"
                value={guest.name}
              />
              <Select
                aria-label={`Nivel de ${guest.name.trim() || "invitado"}`}
                onChange={(event) =>
                  setNewGuests((current) =>
                    current.map((item) =>
                      item.id === guest.id ? { ...item, rating: event.target.value } : item
                    )
                  )
                }
                value={guest.rating}
              >
                <option value="">Nivel del invitado</option>
                {GUEST_SKILL_LEVEL_OPTIONS.map((level) => (
                  <option key={level} value={level}>
                    {formatGuestSkillLevelLabel(level)}
                  </option>
                ))}
              </Select>
              <Select
                aria-label={`Equipo de ${guest.name.trim() || "invitado"}`}
                onChange={(event) =>
                  setNewGuests((current) =>
                    current.map((item) =>
                      item.id === guest.id ? { ...item, team: event.target.value as TeamSide } : item
                    )
                  )
                }
                value={guest.team}
              >
                <option value="A">{teamALabel}</option>
                <option value="B">{teamBLabel}</option>
              </Select>
              <Button
                onClick={() => setNewGuests((current) => current.filter((item) => item.id !== guest.id))}
                type="button"
                variant="danger"
              >
                Quitar
              </Button>
            </div>
          ))}
          {!newGuests.length ? <p className="text-xs text-slate-500">No hay invitados nuevos.</p> : null}
        </div>
        </div>
      </details>

      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            checked={handicapEnabled}
            className="h-4 w-4 accent-emerald-400"
            onChange={(event) => setHandicapEnabled(event.target.checked)}
            type="checkbox"
          />
          Aplicar regla de desventaja numerica
        </label>
        <p className="mt-2 text-xs text-slate-400">
          Usala solo si un equipo jugo con menos participantes. Si ese equipo gana, el ajuste se duplica (+20/-20). Si pierde, no se lo castiga y el ganador suma normal (+10).
        </p>
        {handicapEnabled ? (
          <div className="mt-3">
            <p className="mb-1 text-xs text-slate-400">
              Si gana el equipo en desventaja: +20 / -20. Si gana el otro: +10 / 0.
            </p>
            <Select
              aria-label="Equipo con desventaja"
              onChange={(event) => setHandicapTeam(event.target.value as TeamSide)}
              value={handicapTeam}
            >
              <option value="A">{teamALabel} juega con menos</option>
              <option value="B">{teamBLabel} juega con menos</option>
            </Select>
          </div>
        ) : null}
      </div>

      <div>
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? "Guardando..." : submitLabel}
        </Button>
        {submitError ? <p className="mt-2 text-sm font-semibold text-danger">{submitError}</p> : null}
      </div>
    </form>
  );
}
