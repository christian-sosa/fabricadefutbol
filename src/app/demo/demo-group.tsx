"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { rankPlayers } from "@/lib/domain/player-ranking";

const players = ["Juan", "Manuel", "Nicolás", "Lucas", "Diego", "Pablo", "Martín", "Santi", "Agustín", "Tomás", "Fede", "Gonzalo"];
const tabs = ["Próximo partido", "Ranking", "Historial"] as const;
type DemoTab = (typeof tabs)[number];
const demoRanking = rankPlayers(players.map((name, index) => ({
  playerId: String(index), playerName: name, currentRating: index % 2 === 0 ? 1010 : 990,
  mvpCount: index === 0 ? 1 : 0, matchesPlayed: 1, wins: index % 2 === 0 ? 1 : 0,
  displayOrder: index
})));

export function DemoGroup() {
  const [tab, setTab] = useState<DemoTab>("Próximo partido");
  const [alternative, setAlternative] = useState(false);
  const teams = alternative ? [[0, 3, 4, 7, 8, 11], [1, 2, 5, 6, 9, 10]] : [[0, 2, 4, 6, 8, 10], [1, 3, 5, 7, 9, 11]];

  return (
    <div className="space-y-4">
      <nav aria-label="Secciones del grupo de ejemplo" className="grid grid-cols-3 gap-2">
        {tabs.map((item) => (
          <Button
            aria-pressed={tab === item}
            className="px-2 text-xs sm:text-sm"
            key={item}
            onClick={() => setTab(item)}
            variant={tab === item ? "primary" : "secondary"}
          >
            {item}
          </Button>
        ))}
      </nav>
      {tab === "Próximo partido" ? (
        <Card className="p-4 sm:p-5">
          <CardTitle>Miércoles a las 20:00 · 6 vs 6</CardTitle>
          <p className="mt-2 text-sm text-slate-400">Fecha ilustrativa · cancha del barrio</p>
          <div className="mt-4 grid grid-cols-2 divide-x divide-slate-800 overflow-hidden rounded-xl border border-slate-800">
            {teams.map((team, index) => (
              <section key={index}>
                <h3 className="border-b border-slate-800 bg-slate-950/50 px-3 py-3 text-sm font-bold text-slate-100">Equipo {index === 0 ? "A" : "B"}</h3>
                <ul className="divide-y divide-slate-800/60 px-2 sm:px-3">
                  {team.map((playerIndex) => (
                    <li className="flex min-h-10 items-center justify-between gap-1 py-2 text-sm text-slate-200" key={playerIndex}>
                      <span>{players[playerIndex]}</span>
                      {playerIndex < 2 ? <abbr className="text-xs text-slate-400 no-underline" title="Arquero">Arq.</abbr> : null}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <Button className="mt-4 w-full" onClick={() => setAlternative((value) => !value)} variant="secondary">
            Ver otra opción de equipos
          </Button>
          <p aria-live="polite" className="mt-2 text-center text-xs text-slate-400">
            Opción {alternative ? "2" : "1"} de ejemplo. Los cambios no se guardan.
          </p>
        </Card>
      ) : null}
      {tab === "Ranking" ? (
        <Card className="p-4 sm:p-5">
          <CardTitle>Ranking de ejemplo</CardTitle>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Ganó el equipo A. Juan fue figura: suma los mismos puntos que sus compañeros y queda primero por el desempate de figuras.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Rendimiento de los 12 jugadores del grupo de ejemplo</caption>
              <thead className="text-xs text-slate-400">
                <tr>
                  <th className="py-3 pr-2" scope="col">Jugador</th>
                  <th className="p-2 text-right" scope="col">Puntos</th>
                  <th className="py-3 pl-2 text-right" scope="col">Figuras</th>
                  <th className="hidden p-2 text-right sm:table-cell" scope="col">PJ</th>
                  <th className="hidden p-2 text-right sm:table-cell" scope="col">Ganados</th>
                  <th className="hidden p-2 text-right sm:table-cell" scope="col">Perdidos</th>
                </tr>
              </thead>
              <tbody>
                {demoRanking.map((player) => (
                  <tr className="border-t border-slate-800" key={player.playerId}>
                    <td className="py-3 pr-2 font-semibold text-slate-100">{player.playerName}</td>
                    <td className="p-2 text-right font-semibold tabular-nums">{player.currentRating}</td>
                    <td className="py-3 pl-2 text-right tabular-nums text-slate-300">{player.mvpCount}</td>
                    <td className="hidden p-2 text-right tabular-nums text-slate-400 sm:table-cell">1</td>
                    <td className="hidden p-2 text-right tabular-nums text-slate-400 sm:table-cell">{player.wins}</td>
                    <td className="hidden p-2 text-right tabular-nums text-slate-400 sm:table-cell">{1 - player.wins}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
      {tab === "Historial" ? (
        <Card className="p-4 sm:p-5">
          <CardTitle>Último partido · ejemplo</CardTitle>
          <p className="mt-4 text-center text-xl font-black tabular-nums text-slate-100 sm:text-2xl">Equipo A 3 — 2 Equipo B</p>
          <p className="mt-3 text-center text-sm font-semibold text-amber-200">Figura: Juan</p>
          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-800 pt-4">
            {[0, 1].map((side) => (
              <p className="text-sm leading-relaxed text-slate-300" key={side}>
                <strong className="mb-1 block text-slate-100">Equipo {side ? "B" : "A"}</strong>
                {players.filter((_, index) => index % 2 === side).join(", ")}
              </p>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-slate-400">La figura del partido es opcional, se cuenta en la temporada y no suma puntos.</p>
        </Card>
      ) : null}
    </div>
  );
}
