"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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

type MatchLineupEditorProps = {
  action: (formData: FormData) => void | Promise<void>;
  existingParticipants: ExistingParticipant[];
  availablePlayers: ReplacementPlayerOption[];
  submitLabel?: string;
};

function isValidGuest(guest: GuestDraft) {
  const parsedRating = Number(guest.rating);
  return guest.name.trim().length > 0 && Number.isFinite(parsedRating) && parsedRating > 0;
}

export function MatchLineupEditor({
  action,
  existingParticipants,
  availablePlayers,
  submitLabel = "Guardar formacion final"
}: MatchLineupEditorProps) {
  const [assignments, setAssignments] = useState<Record<string, "A" | "B" | "OUT">>(() => {
    const initial: Record<string, "A" | "B" | "OUT"> = {};
    existingParticipants.forEach((participant) => {
      initial[participant.participantId] = participant.initialTeam;
    });
    return initial;
  });
  const [replacementPlayers, setReplacementPlayers] = useState<ReplacementPlayerDraft[]>([]);
  const [selectedReplacementPlayerId, setSelectedReplacementPlayerId] = useState("");
  const [selectedReplacementTeam, setSelectedReplacementTeam] = useState<TeamSide>("A");
  const [guestSequence, setGuestSequence] = useState(1);
  const [newGuests, setNewGuests] = useState<GuestDraft[]>([]);

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
  const teamACount = useMemo(() => {
    const fromParticipants = existingParticipants.filter(
      (participant) => assignments[participant.participantId] === "A"
    ).length;
    const fromReplacementPlayers = replacementPlayers.filter((player) => player.team === "A").length;
    const fromGuests = validNewGuests.filter((guest) => guest.team === "A").length;
    return fromParticipants + fromReplacementPlayers + fromGuests;
  }, [assignments, existingParticipants, replacementPlayers, validNewGuests]);
  const teamBCount = useMemo(() => {
    const fromParticipants = existingParticipants.filter(
      (participant) => assignments[participant.participantId] === "B"
    ).length;
    const fromReplacementPlayers = replacementPlayers.filter((player) => player.team === "B").length;
    const fromGuests = validNewGuests.filter((guest) => guest.team === "B").length;
    return fromParticipants + fromReplacementPlayers + fromGuests;
  }, [assignments, existingParticipants, replacementPlayers, validNewGuests]);

  const lineupPayload = useMemo(
    () =>
      JSON.stringify({
        assignments: existingParticipants.map((participant) => ({
          participantId: participant.participantId,
          team: assignments[participant.participantId] ?? "OUT"
        })),
        newPlayers: replacementPlayers.map((player) => ({
          playerId: player.playerId,
          team: player.team
        })),
        newGuests: validNewGuests.map((guest) => ({
          name: guest.name.trim(),
          rating: Number(guest.rating),
          team: guest.team
        }))
      }),
    [assignments, existingParticipants, replacementPlayers, validNewGuests]
  );

  return (
    <form action={action} className="mt-4 space-y-4">
      <input name="lineupPayload" type="hidden" value={lineupPayload} />

      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <p className="text-sm font-semibold text-slate-100">Formacion final</p>
        <p className="mt-1 text-xs text-slate-400">
          Equipo A: {teamACount} | Equipo B: {teamBCount}
        </p>
        <div className="mt-3 space-y-2">
          {existingParticipants.map((participant) => (
            <div
              className="grid gap-2 rounded-lg border border-slate-800 bg-slate-900/80 p-2 md:grid-cols-[1fr_170px]"
              key={participant.participantId}
            >
              <div className="text-sm text-slate-200">
                {participant.fullName}
                <span className="ml-2 text-xs text-slate-400">
                  {participant.source === "guest" ? "Invitado" : participant.rating.toFixed(2)}
                </span>
              </div>
              <Select
                onChange={(event) =>
                  setAssignments((current) => ({
                    ...current,
                    [participant.participantId]: event.target.value as "A" | "B" | "OUT"
                  }))
                }
                value={assignments[participant.participantId] ?? "OUT"}
              >
                <option value="A">Equipo A</option>
                <option value="B">Equipo B</option>
                <option value="OUT">No juega</option>
              </Select>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <p className="text-sm font-semibold text-slate-100">Subir jugador de la plantilla</p>
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_130px_auto]">
          <Select
            disabled={!availableReplacementPlayers.length}
            onChange={(event) => setSelectedReplacementPlayerId(event.target.value)}
            value={selectedReplacementPlayerId}
          >
            {!availableReplacementPlayers.length ? (
              <option value="">No hay jugadores disponibles</option>
            ) : null}
            {availableReplacementPlayers.map((player) => (
              <option key={player.id} value={player.id}>
                {player.fullName} ({player.rating.toFixed(2)})
              </option>
            ))}
          </Select>
          <Select
            onChange={(event) => setSelectedReplacementTeam(event.target.value as TeamSide)}
            value={selectedReplacementTeam}
          >
            <option value="A">Equipo A</option>
            <option value="B">Equipo B</option>
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
                    {playerData ? playerData.rating.toFixed(2) : "-"}
                  </span>
                </div>
                <Select
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
                  <option value="A">Equipo A</option>
                  <option value="B">Equipo B</option>
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
            <p className="text-xs text-slate-500">No hay jugadores agregados desde plantilla.</p>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-100">Invitados de reemplazo</p>
          <Button
            onClick={() => {
              setNewGuests((current) => [
                ...current,
                {
                  id: guestSequence,
                  name: "",
                  rating: "10",
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
              className="grid gap-2 rounded-lg border border-slate-800 bg-slate-900/80 p-2 md:grid-cols-[1fr_120px_130px_96px]"
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
              <Input
                min={0.01}
                onChange={(event) =>
                  setNewGuests((current) =>
                    current.map((item) =>
                      item.id === guest.id ? { ...item, rating: event.target.value } : item
                    )
                  )
                }
                placeholder="Rating"
                step={0.01}
                type="number"
                value={guest.rating}
              />
              <Select
                onChange={(event) =>
                  setNewGuests((current) =>
                    current.map((item) =>
                      item.id === guest.id ? { ...item, team: event.target.value as TeamSide } : item
                    )
                  )
                }
                value={guest.team}
              >
                <option value="A">Equipo A</option>
                <option value="B">Equipo B</option>
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

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
