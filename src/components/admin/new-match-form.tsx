"use client";

import { useMemo, useState } from "react";

import { createMatchAction } from "@/app/admin/(panel)/matches/new/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { Select } from "@/components/ui/select";
import type { MatchModality } from "@/types/domain";

type SelectablePlayer = {
  id: string;
  full_name: string;
  current_rating: number;
  initial_rank: number;
};

type GuestRow = {
  key: number;
  name: string;
  rating: string;
};

const EXPECTED_PLAYERS: Record<MatchModality, number> = {
  "5v5": 10,
  "6v6": 12,
  "7v7": 14,
  "9v9": 18,
  "11v11": 22
};

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
  const [guestRows, setGuestRows] = useState<GuestRow[]>([]);

  const expected = EXPECTED_PLAYERS[modality];
  const selectedCount = useMemo(
    () => Object.values(selectedPlayers).filter(Boolean).length,
    [selectedPlayers]
  );

  const validGuestCount = useMemo(
    () => guestRows.filter((guest) => guest.name.trim().length > 0 && guest.rating.trim().length > 0).length,
    [guestRows]
  );
  const totalCurrent = selectedCount + validGuestCount;

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

  return (
    <form action={createMatchAction} className="mt-4 space-y-4">
      <input name="organizationId" type="hidden" value={organizationId} />
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
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {players.map((player) => (
            <label
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm transition hover:border-slate-600"
              key={player.id}
            >
              <span className="flex items-center gap-3">
                <PlayerAvatar name={player.full_name} playerId={player.id} size="sm" />
                <span>
                  {player.full_name} <span className="text-xs text-slate-500">(rank {player.initial_rank})</span>
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className="text-xs font-semibold text-emerald-300">{Number(player.current_rating).toFixed(2)}</span>
                <input
                  checked={Boolean(selectedPlayers[player.id])}
                  name="playerIds"
                  onChange={(event) =>
                    setSelectedPlayers((current) => ({
                      ...current,
                      [player.id]: event.target.checked
                    }))
                  }
                  type="checkbox"
                  value={player.id}
                />
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-100">Invitados (temporales)</p>
            <p className="text-xs text-slate-400">
              No se guardan como jugadores del club, pero si quedan en el historial del partido. El rank equivalente
              se interpreta como initial rank (1 = mejor).
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
                <Input
                  name="guestNames"
                  onChange={(event) => updateGuest(guest.key, "name", event.target.value)}
                  placeholder={`Nombre invitado #${index + 1}`}
                  value={guest.name}
                />
                <Input
                  min={1}
                  name="guestRatings"
                  onChange={(event) => updateGuest(guest.key, "rating", event.target.value)}
                  placeholder="Rank equivalente (1 mejor)"
                  step="0.01"
                  type="number"
                  value={guest.rating}
                />
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

      {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}
      <Button type="submit">Crear partido y generar equipos</Button>
    </form>
  );
}
