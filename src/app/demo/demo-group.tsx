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
  return <div className="space-y-4">
    <nav aria-label="Secciones del grupo de ejemplo" className="flex flex-wrap gap-2">{tabs.map((item) => <Button aria-pressed={tab === item} key={item} onClick={() => setTab(item)} variant={tab === item ? "primary" : "secondary"}>{item}</Button>)}</nav>
    {tab === "Próximo partido" ? <Card><CardTitle>Miércoles a las 20:00 · 6 vs 6</CardTitle><p className="mt-2 text-sm text-slate-400">Fecha ilustrativa · cancha del barrio · 12 convocados</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{teams.map((team, index) => <div className="rounded-xl border border-slate-700 p-4" key={index}><h3 className="font-semibold">Equipo {index === 0 ? "A" : "B"}</h3><ul className="mt-3 space-y-2">{team.map((playerIndex) => <li key={playerIndex}>{players[playerIndex]}{playerIndex < 2 ? " · arquero" : ""}</li>)}</ul></div>)}</div>
      <Button className="mt-4" onClick={() => setAlternative((value) => !value)} variant="secondary">Ver otra opción de equipos</Button>
      <p aria-live="polite" className="mt-2 text-xs text-slate-400">Opción {alternative ? "2" : "1"} de ejemplo. Los cambios se conservan solo mientras mirás esta demo.</p>
    </Card> : null}
    {tab === "Ranking" ? <Card><CardTitle>Ranking de ejemplo</CardTitle><p className="mt-2 text-sm text-slate-400">Una victoria para el equipo A y una derrota para el B. Juan fue figura: tiene los mismos puntos que sus compañeros y queda primero por el desempate de MVP.</p><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Jugador</th><th className="p-2">Rendimiento</th><th className="p-2">MVP</th><th className="p-2">PJ</th><th className="p-2">Ganados</th><th className="p-2">Perdidos</th></tr></thead><tbody>{demoRanking.map((player) => <tr className="border-t border-slate-800" key={player.playerId}><td className="p-2">{player.playerName}</td><td className="p-2">{player.currentRating}</td><td className="p-2">{player.mvpCount}</td><td className="p-2">1</td><td className="p-2">{player.wins}</td><td className="p-2">{1 - player.wins}</td></tr>)}</tbody></table></div></Card> : null}
    {tab === "Historial" ? <Card><CardTitle>Último partido · ejemplo</CardTitle><p className="mt-4 text-2xl font-black">Equipo A 3 — 2 Equipo B</p><div className="mt-3 grid gap-4 sm:grid-cols-2">{[0, 1].map((side) => <p className="text-sm text-slate-300" key={side}><strong>Equipo {side ? "B" : "A"}:</strong> {players.filter((_, index) => index % 2 === side).join(", ")}</p>)}</div><p className="mt-4 font-semibold text-amber-200">MVP: Juan</p><p className="mt-2 text-sm text-slate-400">La figura del partido es opcional, se cuenta en la temporada y no suma puntos.</p></Card> : null}
  </div>;
}
