import { z } from "zod";
import { TEAM_SIZE_BY_MODALITY } from "@/lib/constants";
import { supportsMatchExtras } from "@/lib/domain/match-scorers";
import { assignPlayersToPositions, getDefaultPositionFormation, getFormationRoles, supportsPositionBalancing, type PositionPreferences } from "@/lib/domain/player-positions";
import type { MatchModality, PlayerPosition } from "@/types/domain";

export const FORMATION_PRESETS = {
  "5v5": ["2-2", "1-2-1", "2-1-1"],
  "6v6": ["2-2-1", "1-3-1", "2-1-2"],
  "7v7": ["2-3-1", "3-2-1", "2-2-2", "3-1-2"],
  "9v9": ["3-3-2", "3-2-3", "4-3-1", "4-2-2", "2-4-2"],
  "10v10": ["3-3-3", "4-3-2", "3-4-2", "4-4-1"],
  "11v11": ["4-4-2", "4-3-3", "4-2-3-1", "3-5-2", "3-4-3", "5-3-2"]
} as const satisfies Record<MatchModality, readonly string[]>;

export type FormationModality = keyof typeof FORMATION_PRESETS;
export type FormationPlayer = { participantId: string; name: string } & PositionPreferences;
export type FormationSlot = { slotId: string; participantId: string | null };
export type TeamFormation = { formationId: string; slots: FormationSlot[] };
export type MatchFormation = { teamA: TeamFormation; teamB: TeamFormation };
export type FormationSaveResult = { ok: true; version: number } | { ok: false; error: string; conflict?: boolean };

export function supportsMatchFormation(modality: string): modality is FormationModality {
  return Object.hasOwn(FORMATION_PRESETS, modality);
}

export function getFormationPositions(formationId: string) {
  if (!(Object.values(FORMATION_PRESETS).flat() as string[]).includes(formationId)) return [];
  const lines = formationId.split("-").map(Number);
  return [
    { slotId: "gk", x: 50, y: 88, label: "Arco" },
    ...lines.flatMap((count, line) => Array.from({ length: count }, (_, position) => ({
      slotId: `line-${line}-${position}`,
      x: ((position + 0.5) / count) * 88 + 6,
      y: 69 - line * (54 / Math.max(lines.length - 1, 1)),
      label: `${line === 0 ? "Defensa" : line === lines.length - 1 ? "Ataque" : "Mediocampo"} ${position + 1}${lines.length === 4 && line > 0 && line < 3 ? `, línea ${line}` : ""}`
    })))
  ];
}

export function getFormationSlotPosition(formationId: string, slotId: string): PlayerPosition | null {
  const index = getFormationPositions(formationId).findIndex((position) => position.slotId === slotId);
  return index < 0 ? null : getFormationRoles(formationId)[index] ?? null;
}

export function describeFormation(formationId: string): string {
  if (!getFormationPositions(formationId).length) return "Esquema no válido";
  const roles = getFormationRoles(formationId);
  const labels: Array<[PlayerPosition, string, string]> = [
    ["GK", "arquero", "arqueros"], ["DEF", "defensor", "defensores"],
    ["MID", "mediocampista", "mediocampistas"], ["FWD", "delantero", "delanteros"]
  ];
  return labels.flatMap(([role, singular, plural]) => {
    const count = roles.filter((position) => position === role).length;
    return count ? [`${count} ${count === 1 ? singular : plural}`] : [];
  }).join(" · ");
}

export function createTeamFormation(modality: FormationModality, players: FormationPlayer[], formationId: string = getDefaultPositionFormation(modality) ?? FORMATION_PRESETS[modality][0]): TeamFormation {
  const goalkeeper = players.find((player) => player.isGoalkeeper);
  const positions = getFormationPositions(formationId);
  if (supportsPositionBalancing(modality)) {
    // Las listas confirmadas llevan titulares primero; no elegir suplentes por
    // su ficha. El arquero confirmado siempre conserva su lugar en cancha.
    const uniquePlayers = [...new Map(players.map((player) => [player.participantId, player])).values()];
    const starters = uniquePlayers.slice(0, TEAM_SIZE_BY_MODALITY[modality]);
    if (goalkeeper && !starters.some((player) => player.participantId === goalkeeper.participantId)) {
      starters[starters.length - 1] = goalkeeper;
    }
    const { assignments } = assignPlayersToPositions(starters, getFormationRoles(formationId));
    return { formationId, slots: positions.map(({ slotId }, index) => ({
      slotId, participantId: assignments[index]?.participantId ?? null
    })) };
  }
  return {
    formationId,
    slots: positions.map(({ slotId }) => ({ slotId, participantId: slotId === "gk" ? goalkeeper?.participantId ?? null : null }))
  };
}

export function changeFormationPreset(formation: TeamFormation, formationId: string): TeamFormation {
  const goalkeeper = formation.slots.find((slot) => slot.slotId === "gk")?.participantId ?? null;
  const fieldPlayers = getFormationPositions(formation.formationId)
    .filter((position) => position.slotId !== "gk")
    .map((position) => formation.slots.find((slot) => slot.slotId === position.slotId)?.participantId ?? null);
  return { formationId, slots: getFormationPositions(formationId).map(({ slotId }, index) => ({
    slotId, participantId: slotId === "gk" ? goalkeeper : fieldPlayers[index - 1] ?? null
  })) };
}

export function assignFormationPlayer(formation: TeamFormation, slotId: string, participantId: string | null): TeamFormation {
  if (!formation.slots.some((slot) => slot.slotId === slotId)) return formation;
  return { ...formation, slots: formation.slots.map((slot) => ({ ...slot,
    participantId: slot.slotId === slotId ? participantId : participantId && slot.participantId === participantId ? null : slot.participantId
  })) };
}

/** Intercambia dos jugadores ubicados; un jugador del banco reemplaza al elegido. */
export function swapFormationPlayer(formation: TeamFormation, slotId: string, participantId: string, players: FormationPlayer[]): TeamFormation {
  const target = formation.slots.find((slot) => slot.slotId === slotId);
  const player = players.find((candidate) => candidate.participantId === participantId);
  if (!target || !player || !getFormationSlotPosition(formation.formationId, slotId)) return formation;
  if (target.participantId === participantId) return formation;
  const goalkeeper = players.find((candidate) => candidate.isGoalkeeper);
  if ((player.isGoalkeeper && slotId !== "gk") || (slotId === "gk" && goalkeeper && participantId !== goalkeeper.participantId)) return formation;
  const source = formation.slots.find((slot) => slot.participantId === participantId);
  return { ...formation, slots: formation.slots.map((slot) => ({ ...slot,
    participantId: slot.slotId === slotId ? participantId : slot.slotId === source?.slotId ? target.participantId : slot.participantId
  })) };
}

/** Reubica sólo a quienes están en cancha: conserva suplentes elegidos y cantidad de huecos. */
export function reassignFormationByPreferences(formation: TeamFormation, players: FormationPlayer[]): TeamFormation {
  const positions = getFormationPositions(formation.formationId);
  if (!positions.length || positions.length !== formation.slots.length ||
    new Set(formation.slots.map((slot) => slot.slotId)).size !== positions.length ||
    positions.some((position) => !formation.slots.some((slot) => slot.slotId === position.slotId))) return formation;
  const playersById = new Map(players.map((player) => [player.participantId, player]));
  const onPitch: FormationPlayer[] = [];
  const used = new Set<string>();
  for (const slot of formation.slots) {
    if (!slot.participantId) continue;
    const player = playersById.get(slot.participantId);
    if (!player || used.has(player.participantId)) return formation;
    used.add(player.participantId);
    onPitch.push(player);
  }
  const { assignments } = assignPlayersToPositions(onPitch, getFormationRoles(formation.formationId));
  return { ...formation, slots: positions.map(({ slotId }, index) => ({
    slotId, participantId: assignments[index]?.participantId ?? null
  })) };
}

const teamSchema = z.object({
  formationId: z.string().max(16),
  slots: z.array(z.object({ slotId: z.string().max(30), participantId: z.string().max(50).nullable() }).strict())
    .max(Math.max(...Object.values(TEAM_SIZE_BY_MODALITY)))
}).strict();
const matchSchema = z.object({ teamA: teamSchema, teamB: teamSchema }).strict();

export function validateMatchFormation(value: unknown, modality: string, teams: { teamA: FormationPlayer[]; teamB: FormationPlayer[] }): MatchFormation {
  if (!supportsMatchFormation(modality)) throw new Error("La modalidad del partido no admite formaciones.");
  const parsed = matchSchema.safeParse(value);
  if (!parsed.success) throw new Error("La formación enviada no es válida.");
  const expectedSize = TEAM_SIZE_BY_MODALITY[modality];
  const allParticipants = new Set<string>();
  for (const key of ["teamA", "teamB"] as const) {
    const formation = parsed.data[key];
    if (!(FORMATION_PRESETS[modality] as readonly string[]).includes(formation.formationId)) throw new Error("Elegí una formación válida para la modalidad del partido.");
    const positions = getFormationPositions(formation.formationId);
    const slotIds = formation.slots.map((slot) => slot.slotId);
    if (slotIds.length !== expectedSize || new Set(slotIds).size !== expectedSize || positions.some((position) => !slotIds.includes(position.slotId))) throw new Error("La formación debe incluir todas las posiciones una sola vez.");
    const players = teams[key];
    const roster = new Set(players.map((player) => player.participantId));
    if (roster.size !== players.length || (supportsMatchExtras(modality) ? roster.size < expectedSize : roster.size !== expectedSize)) throw new Error("Los equipos cambiaron. Revisá los jugadores confirmados antes de armar la formación.");
    const used = new Set<string>();
    for (const slot of formation.slots) {
      if (!slot.participantId) throw new Error("Completá todas las posiciones de ambos equipos antes de guardar.");
      if (!roster.has(slot.participantId)) throw new Error("Cada jugador debe pertenecer a su equipo confirmado.");
      if (used.has(slot.participantId) || allParticipants.has(slot.participantId)) throw new Error("Un jugador no puede ocupar más de una posición.");
      used.add(slot.participantId);
      allParticipants.add(slot.participantId);
    }
    const goalkeeper = players.filter((player) => player.isGoalkeeper);
    if (goalkeeper.length > 1 || (goalkeeper[0] && formation.slots.find((slot) => slot.slotId === "gk")?.participantId !== goalkeeper[0].participantId)) throw new Error("El arquero confirmado debe ocupar el arco de su equipo.");
  }
  return parsed.data;
}

export function readMatchFormation(value: unknown, modality: string, teams: { teamA: FormationPlayer[]; teamB: FormationPlayer[] }): MatchFormation | null {
  if (!value) return null;
  try { return validateMatchFormation(value, modality, teams); } catch { return null; }
}

export function toFormationPlayers(players: Array<{ id: string; full_name: string; is_guest?: boolean; preferred_position?: PlayerPosition | null; secondary_position?: PlayerPosition | null }>, goalkeeperIds: string[] = []): FormationPlayer[] {
  return players.map((player) => ({
    participantId: player.is_guest ? `guest:${player.id.replace(/^guest-/, "")}` : `player:${player.id}`,
    name: player.full_name,
    isGoalkeeper: !player.is_guest && goalkeeperIds.includes(player.id),
    ...(player.preferred_position !== undefined ? { preferredPosition: player.preferred_position } : {}),
    ...(player.secondary_position !== undefined ? { secondaryPosition: player.secondary_position } : {})
  }));
}
