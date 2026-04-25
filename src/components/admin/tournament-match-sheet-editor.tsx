"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type RegisteredPlayerRow = {
  id: string;
  teamId: string;
  fullName: string;
  shirtNumber: number | null;
  position: string | null;
  active: boolean;
  goals: number;
  yellowCards: number;
  redCards: number;
  isMvp: boolean;
};

type ExtraStatRow = {
  teamId: string;
  playerName: string;
  goals: number;
  yellowCards: number;
  redCards: number;
  isMvp: boolean;
};

type TeamSummary = {
  id: string;
  name: string;
};

type EditorRow = {
  entryKey: string;
  teamId: string;
  playerId: string | null;
  playerName: string;
  goals: string;
  yellowCards: string;
  redCards: string;
};

function toNumericString(value: number) {
  return Number.isFinite(value) ? String(value) : "0";
}

function buildEntryKey(teamId: string, playerId: string | null, fallback: string) {
  return `${teamId}:${playerId ?? fallback}`;
}

export function TournamentMatchSheetEditor({
  action,
  homeTeam,
  awayTeam,
  registeredPlayers,
  extraStats,
  defaultHomeScore,
  defaultAwayScore,
  defaultNotes
}: {
  action: (formData: FormData) => void | Promise<void>;
  homeTeam: TeamSummary;
  awayTeam: TeamSummary;
  registeredPlayers: RegisteredPlayerRow[];
  extraStats: ExtraStatRow[];
  defaultHomeScore: number;
  defaultAwayScore: number;
  defaultNotes?: string | null;
}) {
  const [registeredRows, setRegisteredRows] = useState<EditorRow[]>(() =>
    registeredPlayers.map((player) => ({
      entryKey: buildEntryKey(player.teamId, player.id, player.fullName.toLowerCase()),
      teamId: player.teamId,
      playerId: player.id,
      playerName: player.fullName,
      goals: toNumericString(player.goals),
      yellowCards: toNumericString(player.yellowCards),
      redCards: toNumericString(player.redCards)
    }))
  );
  const [extraRows, setExtraRows] = useState<EditorRow[]>(() =>
    extraStats.map((row, index) => ({
      entryKey: buildEntryKey(row.teamId, null, `extra-${index + 1}-${row.playerName.toLowerCase()}`),
      teamId: row.teamId,
      playerId: null,
      playerName: row.playerName,
      goals: toNumericString(row.goals),
      yellowCards: toNumericString(row.yellowCards),
      redCards: toNumericString(row.redCards)
    }))
  );
  const [selectedMvpKey, setSelectedMvpKey] = useState<string>(() => {
    const registeredMvp = registeredPlayers.find((player) => player.isMvp);
    if (registeredMvp) {
      return buildEntryKey(registeredMvp.teamId, registeredMvp.id, registeredMvp.fullName.toLowerCase());
    }

    const extraMvp = extraStats.find((row) => row.isMvp);
    if (extraMvp) {
      const index = extraStats.findIndex((row) => row === extraMvp);
      return buildEntryKey(extraMvp.teamId, null, `extra-${index + 1}-${extraMvp.playerName.toLowerCase()}`);
    }

    return "";
  });
  const [extraSequence, setExtraSequence] = useState(extraStats.length + 1);

  const allRows = useMemo(() => [...registeredRows, ...extraRows], [extraRows, registeredRows]);
  const homeRows = useMemo(() => allRows.filter((row) => row.teamId === homeTeam.id), [allRows, homeTeam.id]);
  const awayRows = useMemo(() => allRows.filter((row) => row.teamId === awayTeam.id), [allRows, awayTeam.id]);

  useEffect(() => {
    if (!selectedMvpKey) {
      return;
    }

    if (allRows.some((row) => row.entryKey === selectedMvpKey)) {
      return;
    }

    setSelectedMvpKey("");
  }, [allRows, selectedMvpKey]);

  const payload = useMemo(
    () =>
      JSON.stringify({
        mvpEntryKey: selectedMvpKey || null,
        stats: allRows.map((row) => ({
          entryKey: row.entryKey,
          teamId: row.teamId,
          playerId: row.playerId,
          playerName: row.playerName.trim(),
          goals: Number(row.goals || 0),
          yellowCards: Number(row.yellowCards || 0),
          redCards: Number(row.redCards || 0)
        }))
      }),
    [allRows, selectedMvpKey]
  );

  function updateRegisteredRow(entryKey: string, field: "goals" | "yellowCards" | "redCards", value: string) {
    setRegisteredRows((current) =>
      current.map((row) => (row.entryKey === entryKey ? { ...row, [field]: value } : row))
    );
  }

  function updateExtraRow(entryKey: string, field: keyof Omit<EditorRow, "entryKey" | "teamId" | "playerId">, value: string) {
    setExtraRows((current) =>
      current.map((row) => (row.entryKey === entryKey ? { ...row, [field]: value } : row))
    );
  }

  function addExtraRow(teamId: string) {
    const label = teamId === homeTeam.id ? "local" : "visitante";
    setExtraRows((current) => [
      ...current,
      {
        entryKey: `${teamId}:extra-${label}-${extraSequence}`,
        teamId,
        playerId: null,
        playerName: "",
        goals: "0",
        yellowCards: "0",
        redCards: "0"
      }
    ]);
    setExtraSequence((value) => value + 1);
  }

  function removeExtraRow(entryKey: string) {
    setExtraRows((current) => current.filter((row) => row.entryKey !== entryKey));
  }

  function renderTeamRows(team: TeamSummary, rows: EditorRow[]) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-100">{team.name}</p>
            <p className="text-xs text-slate-400">Jugadores del plantel y filas libres para completar el acta.</p>
          </div>
          <Button onClick={() => addExtraRow(team.id)} type="button" variant="ghost">
            Agregar fila libre
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          {rows.map((row) => {
            const isRegistered = Boolean(row.playerId);
            const registeredMeta = registeredPlayers.find((player) => player.id === row.playerId) ?? null;

            return (
              <div
                className={cn(
                  "grid gap-2 rounded-xl border border-slate-800 bg-slate-900/80 p-3",
                  isRegistered ? "md:grid-cols-[1.4fr_90px_90px_90px_90px]" : "md:grid-cols-[1.4fr_90px_90px_90px_90px_auto]"
                )}
                key={row.entryKey}
              >
                <div>
                  {isRegistered ? (
                    <>
                      <p className="font-semibold text-slate-100">{row.playerName}</p>
                      <p className="text-xs text-slate-400">
                        {registeredMeta?.shirtNumber ? `#${registeredMeta.shirtNumber}` : "Sin numero"}
                        {registeredMeta?.position ? ` - ${registeredMeta.position}` : ""}
                        {!registeredMeta?.active ? " - Inactivo" : ""}
                      </p>
                    </>
                  ) : (
                    <Input
                      onChange={(event) => updateExtraRow(row.entryKey, "playerName", event.target.value)}
                      placeholder="Nombre del jugador"
                      value={row.playerName}
                    />
                  )}
                </div>

                <Input
                  min={0}
                  onChange={(event) =>
                    isRegistered
                      ? updateRegisteredRow(row.entryKey, "goals", event.target.value)
                      : updateExtraRow(row.entryKey, "goals", event.target.value)
                  }
                  placeholder="Goles"
                  type="number"
                  value={row.goals}
                />
                <Input
                  min={0}
                  onChange={(event) =>
                    isRegistered
                      ? updateRegisteredRow(row.entryKey, "yellowCards", event.target.value)
                      : updateExtraRow(row.entryKey, "yellowCards", event.target.value)
                  }
                  placeholder="Amarillas"
                  type="number"
                  value={row.yellowCards}
                />
                <Input
                  min={0}
                  onChange={(event) =>
                    isRegistered
                      ? updateRegisteredRow(row.entryKey, "redCards", event.target.value)
                      : updateExtraRow(row.entryKey, "redCards", event.target.value)
                  }
                  placeholder="Rojas"
                  type="number"
                  value={row.redCards}
                />

                <label className="flex items-center justify-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200">
                  <input
                    checked={selectedMvpKey === row.entryKey}
                    className="h-4 w-4 accent-emerald-400"
                    name="mvpSelector"
                    onChange={() => setSelectedMvpKey(row.entryKey)}
                    type="radio"
                  />
                  Figura
                </label>

                {!isRegistered ? (
                  <Button onClick={() => removeExtraRow(row.entryKey)} type="button" variant="danger">
                    Quitar
                  </Button>
                ) : null}
              </div>
            );
          })}

          {!rows.length ? <p className="text-sm text-slate-400">No hay filas disponibles para este equipo.</p> : null}
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input name="sheetPayload" type="hidden" value={payload} />

      <div className="grid gap-3 md:grid-cols-4">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="homeScore">
            Goles {homeTeam.name}
          </label>
          <Input defaultValue={defaultHomeScore} id="homeScore" min={0} name="homeScore" required type="number" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="awayScore">
            Goles {awayTeam.name}
          </label>
          <Input defaultValue={defaultAwayScore} id="awayScore" min={0} name="awayScore" required type="number" />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="notes">
            Notas
          </label>
          <Textarea defaultValue={defaultNotes ?? ""} id="notes" name="notes" rows={3} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {renderTeamRows(homeTeam, homeRows)}
        {renderTeamRows(awayTeam, awayRows)}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
        <label className="flex items-center gap-3 text-sm font-semibold text-slate-200">
          <input
            checked={!selectedMvpKey}
            className="h-4 w-4 accent-emerald-400"
            name="mvpSelector"
            onChange={() => setSelectedMvpKey("")}
            type="radio"
          />
          Guardar el partido sin figura
        </label>
        <p className="mt-2 text-xs text-slate-400">
          Puedes cerrar el acta solo con resultado y notas. Las figuras y estadísticas quedan abiertas para más tarde.
        </p>
      </div>

      <Button type="submit">Guardar acta</Button>
    </form>
  );
}
