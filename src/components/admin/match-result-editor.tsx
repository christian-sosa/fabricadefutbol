"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
    lineup?: {
      assignments: Array<{
        participantId: string;
        team: "A" | "B" | "OUT";
      }>;
      newGuests?: Array<{
        name: string;
        rating: number;
        team: "A" | "B";
      }>;
      handicapTeam?: TeamSide | null;
    };
  }) => Promise<void>;
  existingParticipants: ExistingParticipant[];
  defaultScoreA: number;
  defaultScoreB: number;
  defaultNotes?: string | null;
  submitLabel: string;
  teamALabel?: string;
  teamBLabel?: string;
};

function isValidGuest(guest: GuestDraft) {
  const parsedRating = Number(guest.rating);
  return guest.name.trim().length > 0 && Number.isFinite(parsedRating) && parsedRating > 0;
}

export function MatchResultEditor({
  action,
  onSubmit,
  existingParticipants,
  defaultScoreA,
  defaultScoreB,
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
  const [handicapEnabled, setHandicapEnabled] = useState(false);
  const [handicapTeam, setHandicapTeam] = useState<TeamSide>("A");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validNewGuests = useMemo(() => newGuests.filter((guest) => isValidGuest(guest)), [newGuests]);
  const teamACount = useMemo(() => {
    const fromParticipants = existingParticipants.filter((participant) => assignments[participant.participantId] === "A").length;
    const fromGuests = validNewGuests.filter((guest) => guest.team === "A").length;
    return fromParticipants + fromGuests;
  }, [assignments, existingParticipants, validNewGuests]);
  const teamBCount = useMemo(() => {
    const fromParticipants = existingParticipants.filter((participant) => assignments[participant.participantId] === "B").length;
    const fromGuests = validNewGuests.filter((guest) => guest.team === "B").length;
    return fromParticipants + fromGuests;
  }, [assignments, existingParticipants, validNewGuests]);

  useEffect(() => {
    if (!handicapEnabled) return;
    if (teamACount === teamBCount) return;
    setHandicapTeam(teamACount < teamBCount ? "A" : "B");
  }, [handicapEnabled, teamACount, teamBCount]);

  const lineupPayload = useMemo(
    () =>
      JSON.stringify({
        assignments: existingParticipants.map((participant) => ({
          participantId: participant.participantId,
          team: assignments[participant.participantId] ?? "OUT"
        })),
        newGuests: validNewGuests.map((guest) => ({
          name: guest.name.trim(),
          rating: Number(guest.rating),
          team: guest.team
        })),
        handicapTeam: handicapEnabled ? handicapTeam : null
      }),
    [assignments, existingParticipants, handicapEnabled, handicapTeam, validNewGuests]
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
        lineup: {
          assignments: existingParticipants.map((participant) => ({
            participantId: participant.participantId,
            team: assignments[participant.participantId] ?? "OUT"
          })),
          newGuests: validNewGuests.map((guest) => ({
            name: guest.name.trim(),
            rating: Number(guest.rating),
            team: guest.team
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

      <div className="grid gap-3 md:grid-cols-4">
        <Input defaultValue={defaultScoreA} min={0} name="scoreA" required type="number" />
        <Input defaultValue={defaultScoreB} min={0} name="scoreB" required type="number" />
        <Textarea
          className="md:col-span-2"
          defaultValue={defaultNotes ?? ""}
          name="notes"
          placeholder="Notas opcionales"
          rows={3}
        />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <p className="text-sm font-semibold text-slate-100">Formacion final</p>
        <p className="mt-1 text-xs text-slate-400">
          {teamALabel}: {teamACount} | {teamBLabel}: {teamBCount}
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
                  {participant.source === "guest" ? "Invitado" : `Rendimiento ${formatRendimiento(participant.rating)}`}
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
                <option value="A">{teamALabel}</option>
                <option value="B">{teamBLabel}</option>
                <option value="OUT">No juega</option>
              </Select>
            </div>
          ))}
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
                  rating: "1000",
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
            <div className="grid gap-2 rounded-lg border border-slate-800 bg-slate-900/80 p-2 md:grid-cols-[1fr_120px_130px_96px]" key={guest.id}>
              <Input
                onChange={(event) =>
                  setNewGuests((current) =>
                    current.map((item) => (item.id === guest.id ? { ...item, name: event.target.value } : item))
                  )
                }
                placeholder="Nombre invitado"
                value={guest.name}
              />
              <Input
                min={1}
                onChange={(event) =>
                  setNewGuests((current) =>
                    current.map((item) => (item.id === guest.id ? { ...item, rating: event.target.value } : item))
                  )
                }
                placeholder="Rendimiento"
                step={1}
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
        {handicapEnabled ? (
          <div className="mt-3">
            <p className="mb-1 text-xs text-slate-400">
              Si gana el equipo en desventaja: +20 / -20. Si gana el otro: +10 / 0.
            </p>
            <Select onChange={(event) => setHandicapTeam(event.target.value as TeamSide)} value={handicapTeam}>
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
