"use client";

import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { formatMatchModality, TEAM_SIZE_BY_MODALITY } from "@/lib/constants";
import type { ClubPlayerRecord, ClubTeamPlayerRecord, ClubTeamRecord } from "@/lib/domain/clubs";

type MatchPlayerPickerProps = {
  players: ClubPlayerRecord[];
  teams: ClubTeamRecord[];
  teamPlayers: ClubTeamPlayerRecord[];
};

function PlayerRows({
  players,
  title
}: {
  players: ClubPlayerRecord[];
  title: string;
}) {
  if (!players.length) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">
        No hay jugadores para mostrar en esta seccion.
      </div>
    );
  }

  return (
    <section className="space-y-2">
      <p className="text-sm font-semibold text-slate-200">{title}</p>
      <div className="overflow-x-auto">
        <Table>
          <THead>
            <tr>
              <TH>Jugador</TH>
              <TH>Rol</TH>
              <TH>Goles</TH>
              <TH>Asist.</TH>
              <TH>Figura</TH>
              <TH>Pago cancha</TH>
              <TH>Monto pago</TH>
            </tr>
          </THead>
          <TBody>
            {players.map((player) => (
              <tr key={player.id}>
                <TD className="font-semibold">{player.full_name}</TD>
                <TD>
                  <Select className="w-40" name={`playerRole:${player.id}`}>
                    <option value="">No estuvo</option>
                    <option value="starter">Titular</option>
                    <option value="substitute">Suplente</option>
                    <option value="present">Presente, no entro</option>
                  </Select>
                </TD>
                <TD>
                  <Input className="w-20" min={0} name={`playerGoals:${player.id}`} type="number" />
                </TD>
                <TD>
                  <Input className="w-20" min={0} name={`playerAssists:${player.id}`} type="number" />
                </TD>
                <TD>
                  <input className="h-4 w-4 accent-emerald-400" name="mvp" type="radio" value={`player:${player.id}`} />
                </TD>
                <TD>
                  <Select className="w-40" defaultValue="unpaid" name={`playerPaymentStatus:${player.id}`}>
                    <option value="unpaid">No pago</option>
                    <option value="paid">Pago completo</option>
                    <option value="partial">Pago parcial</option>
                  </Select>
                </TD>
                <TD>
                  <Input
                    aria-label={`Monto pagado ${player.full_name}`}
                    className="w-24"
                    min={0}
                    name={`playerPaidAmount:${player.id}`}
                    placeholder="$"
                    step="0.01"
                    type="number"
                  />
                </TD>
              </tr>
            ))}
          </TBody>
        </Table>
      </div>
    </section>
  );
}

export function MatchPlayerPicker({ players, teams, teamPlayers }: MatchPlayerPickerProps) {
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [showPool, setShowPool] = useState(false);
  const activePlayers = useMemo(() => players.filter((player) => player.active), [players]);
  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? null;
  const rosterIds = useMemo(
    () =>
      new Set(
        teamPlayers
          .filter((row) => row.club_team_id === selectedTeamId)
          .map((row) => row.club_player_id)
      ),
    [selectedTeamId, teamPlayers]
  );
  const teamRosterPlayers = activePlayers.filter((player) => rosterIds.has(player.id));
  const poolPlayers = activePlayers.filter((player) => !rosterIds.has(player.id));

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-200">Equipo</label>
        <Select
          name="teamId"
          onChange={(event) => {
            setSelectedTeamId(event.target.value);
            setShowPool(false);
          }}
          required
          value={selectedTeamId}
        >
          <option value="">Elegir equipo</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </Select>
      </div>

      {selectedTeamId ? (
        <>
          {selectedTeam ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">
              <input name="modality" type="hidden" value={selectedTeam.modality} />
              <p className="font-semibold">
                Modalidad: {formatMatchModality(selectedTeam.modality)}
              </p>
              <p className="mt-1 text-emerald-100/80">
                La planilla debe tener exactamente {TEAM_SIZE_BY_MODALITY[selectedTeam.modality]} titulares.
              </p>
            </div>
          ) : null}

          <PlayerRows players={teamRosterPlayers} title="Plantel del equipo elegido" />

          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <label className="flex items-start gap-3 text-sm text-slate-200">
              <input
                checked={showPool}
                className="mt-0.5 h-4 w-4 accent-emerald-400"
                onChange={(event) => setShowPool(event.target.checked)}
                type="checkbox"
              />
              <span>
                Completar con jugadores del pool del club
                <span className="mt-1 block text-xs text-slate-400">
                  Muestra jugadores de otros equipos o sin equipo, sin repetir el plantel elegido.
                </span>
              </span>
            </label>
          </div>

          {showPool ? <PlayerRows players={poolPlayers} title="Pool complementario" /> : null}
        </>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">
          Elegi un equipo para ver su plantel.
        </div>
      )}
    </div>
  );
}
