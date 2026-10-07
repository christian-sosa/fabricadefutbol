import { z } from "zod";
import type { MatchModality, PlayerPosition } from "@/types/domain";

export const PLAYER_POSITION_OPTIONS = [
  { value: "GK", label: "Arquero" },
  { value: "DEF", label: "Defensor" },
  { value: "MID", label: "Mediocampista" },
  { value: "FWD", label: "Delantero" }
] as const satisfies readonly { value: PlayerPosition; label: string }[];

export const playerPositionSchema = z.enum(["GK", "DEF", "MID", "FWD"], {
  errorMap: () => ({ message: "Seleccioná una posición válida." })
}).nullable().optional();

export type PositionPreferences = {
  preferredPosition?: PlayerPosition | null;
  secondaryPosition?: PlayerPosition | null;
  isGoalkeeper?: boolean;
};
export type PlayerPositionFit = "preferred" | "secondary" | "flexible" | "fallback";

export const DEFAULT_POSITION_FORMATIONS = {
  "9v9": "3-3-2",
  "10v10": "3-4-2",
  "11v11": "4-3-3"
} as const;

export function supportsPositionBalancing(modality: string): modality is keyof typeof DEFAULT_POSITION_FORMATIONS {
  return Object.hasOwn(DEFAULT_POSITION_FORMATIONS, modality);
}

export function getDefaultPositionFormation(modality: MatchModality): string | null {
  return supportsPositionBalancing(modality) ? DEFAULT_POSITION_FORMATIONS[modality] : null;
}

export function getFormationRoles(formationId: string): PlayerPosition[] {
  const lines = formationId.split("-").map(Number);
  if (lines.length < 2 || lines.some((count) => !Number.isInteger(count) || count < 1 || count > 10)) return [];
  return ["GK", ...lines.flatMap((count, line) => Array<PlayerPosition>(count).fill(
    line === 0 ? "DEF" : line === lines.length - 1 ? "FWD" : "MID"
  ))];
}

export function getPlayerPositionFit(player: PositionPreferences, position: PlayerPosition): PlayerPositionFit {
  // El arquero elegido para este partido tiene prioridad sobre su ficha habitual.
  if (player.isGoalkeeper) return position === "GK" ? "preferred" : "fallback";
  if (player.preferredPosition === position) return "preferred";
  if (player.secondaryPosition === position) return "secondary";
  if (!player.preferredPosition && !player.secondaryPosition) return "flexible";
  return "fallback";
}

export function getPlayerPositionCost(player: PositionPreferences, position: PlayerPosition): number {
  if (player.isGoalkeeper && position !== "GK") return 10_000;
  const fit = getPlayerPositionFit(player, position);
  return fit === "preferred" ? 0 : fit === "secondary" ? 1 : fit === "flexible" ? 2 : 12;
}

/**
 * Asigna globalmente: evita que una elección voraz quite la única opción de
 * defensa/medio a otro jugador. Hungarian rectangular, O(slots² × players).
 * Los empates respetan el orden original y nunca duplican participantes.
 */
export function assignPlayersToPositions<T extends PositionPreferences>(players: T[], positions: PlayerPosition[]): {
  assignments: Array<T | null>;
  cost: number;
} {
  if (!positions.length) return { assignments: [], cost: 0 };
  const columnCount = Math.max(players.length, positions.length);
  const rowPotential = new Float64Array(positions.length + 1);
  const columnPotential = new Float64Array(columnCount + 1);
  const matching = new Int32Array(columnCount + 1);
  const previous = new Int32Array(columnCount + 1);
  const minimum = new Float64Array(columnCount + 1);
  const used = new Uint8Array(columnCount + 1);
  const hasSelectedGoalkeeper = players.some((player) => player.isGoalkeeper);
  const costs = positions.map((position) => Array.from({ length: columnCount }, (_, index) =>
    index < players.length
      ? position === "GK" && hasSelectedGoalkeeper && !players[index].isGoalkeeper
        ? 10_000 : getPlayerPositionCost(players[index], position)
      : 20_000
  ));

  for (let row = 1; row <= positions.length; row += 1) {
    matching[0] = row;
    minimum.fill(Infinity);
    used.fill(0);
    let column = 0;
    do {
      used[column] = 1;
      const currentRow = matching[column];
      let delta = Infinity;
      let nextColumn = 0;
      for (let candidate = 1; candidate <= columnCount; candidate += 1) {
        if (used[candidate]) continue;
        const reduced = costs[currentRow - 1][candidate - 1] - rowPotential[currentRow] - columnPotential[candidate];
        if (reduced < minimum[candidate]) {
          minimum[candidate] = reduced;
          previous[candidate] = column;
        }
        if (minimum[candidate] < delta) {
          delta = minimum[candidate];
          nextColumn = candidate;
        }
      }
      for (let candidate = 0; candidate <= columnCount; candidate += 1) {
        if (used[candidate]) {
          rowPotential[matching[candidate]] += delta;
          columnPotential[candidate] -= delta;
        } else {
          minimum[candidate] -= delta;
        }
      }
      column = nextColumn;
    } while (matching[column]);

    do {
      const predecessor = previous[column];
      matching[column] = matching[predecessor];
      column = predecessor;
    } while (column);
  }

  const assignments: Array<T | null> = Array(positions.length).fill(null);
  for (let column = 1; column <= columnCount; column += 1) {
    if (matching[column] && column <= players.length) assignments[matching[column] - 1] = players[column - 1];
  }
  return { assignments, cost: Math.max(0, -columnPotential[0]) };
}
