import { TEAM_SIZE_BY_MODALITY } from "@/lib/constants";
import {
  calculateEffectiveSkillScore,
  calculateGuestSkillScore,
  mapInitialRankToSkillLevel
} from "@/lib/domain/skill-level";
import { generateBalancedTeamOptions } from "@/lib/domain/team-generator";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeTeamLabel } from "@/lib/team-labels";
import type { MatchModality, MatchResultInput, PlayerPosition, PlayerRatingInput, SubstituteAssignment, TeamSide } from "@/types/domain";

type DbClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type DraftGuestInput = {
  key: string;
  name: string;
  rating: number;
};

type BalanceParticipant = PlayerRatingInput;

type SelectedPlayerForBalance = {
  id: string;
  full_name: string;
  initial_rank: number;
  skill_level: number | null;
  current_rating: number;
  active: boolean;
  preferred_position?: PlayerPosition | null;
  secondary_position?: PlayerPosition | null;
};

type ManualTeamAssignmentInput = {
  participantId: string;
  team: TeamSide;
};

type CreateDraftInput = {
  requestId?: string;
  supabase: DbClient;
  adminId: string;
  organizationId: string;
  scheduledAt: string;
  modality: MatchModality;
  location?: string;
  selectedPlayerIds: string[];
  invitedGuests: DraftGuestInput[];
  teamCreationMode?: "auto" | "manual";
  manualTeamAssignments?: ManualTeamAssignmentInput[];
  substituteAssignments?: SubstituteAssignment[];
  goalkeeperPlayerIds?: string[];
  teamALabel?: string | null;
  teamBLabel?: string | null;
};

const PLAYER_PREFIX = "player:";
const GUEST_PREFIX = "guest:";
function isGuestSchemaMissing(message: string) {
  const normalized = message.toLowerCase();
  const mentionsGuestTables =
    normalized.includes("match_guests") || normalized.includes("team_option_guests");
  const indicatesSchemaIssue =
    normalized.includes("schema cache") ||
    normalized.includes("does not exist") ||
    normalized.includes("relation");
  return mentionsGuestTables && indicatesSchemaIssue;
}

function buildGuestSchemaErrorMessage(baseMessage: string) {
  return `${baseMessage} Falta actualizar Supabase con las tablas de invitados (\`match_guests\` y \`team_option_guests\`). Ejecuta \`supabase/schema.sql\` y \`supabase/policies.sql\` y luego refresca el schema cache con: NOTIFY pgrst, 'reload schema';`;
}

function expectedPlayers(modality: MatchModality) {
  return TEAM_SIZE_BY_MODALITY[modality] * 2;
}

function validatePlayerCount(modality: MatchModality, registeredPlayersCount: number, guestsCount: number) {
  const expected = expectedPlayers(modality);
  const total = registeredPlayersCount + guestsCount;
  if (total !== expected) {
    throw new Error(`Para ${modality} necesitas exactamente ${expected} jugadores entre registrados e invitados.`);
  }
}

export function validateSubstituteAssignments(params: {
  modality: MatchModality;
  participantIds: string[];
  assignments: SubstituteAssignment[];
  goalkeeperPlayerIds: string[];
}) {
  const { modality, participantIds, assignments, goalkeeperPlayerIds } = params;
  if (assignments.length && !["9v9", "10v10", "11v11"].includes(modality)) {
    throw new Error("Los suplentes están disponibles únicamente en F9, F10 y F11.");
  }
  const participants = new Set(participantIds);
  if (participants.size !== participantIds.length) {
    throw new Error("Hay participantes duplicados en la convocatoria.");
  }
  const assignmentsById = new Map<string, TeamSide | null>();
  for (const assignment of assignments) {
    if (!participants.has(assignment.participantId)) {
      throw new Error("Los suplentes deben formar parte de la convocatoria.");
    }
    if (assignmentsById.has(assignment.participantId)) {
      throw new Error("Hay suplentes duplicados en la convocatoria.");
    }
    if (assignment.team !== null && assignment.team !== "A" && assignment.team !== "B") {
      throw new Error("El equipo de un suplente debe ser válido o quedar sin asignar.");
    }
    if (goalkeeperPlayerIds.some((id) => toPlayerParticipantId(id) === assignment.participantId)) {
      throw new Error("Los arqueros titulares no pueden estar marcados como suplentes.");
    }
    assignmentsById.set(assignment.participantId, assignment.team);
  }
  return assignmentsById;
}

function validateGoalkeeperSelection(selectedPlayerIds: string[], goalkeeperPlayerIds: string[]) {
  if (goalkeeperPlayerIds.length !== 0 && goalkeeperPlayerIds.length !== 2) {
    throw new Error("Si seleccionas arqueros, debes elegir exactamente 2.");
  }

  const uniqueGoalkeepers = new Set(goalkeeperPlayerIds);
  if (uniqueGoalkeepers.size !== goalkeeperPlayerIds.length) {
    throw new Error("Hay arqueros duplicados en la convocatoria.");
  }

  const selectedPlayersSet = new Set(selectedPlayerIds);
  for (const goalkeeperId of goalkeeperPlayerIds) {
    if (!selectedPlayersSet.has(goalkeeperId)) {
      throw new Error("Los arqueros seleccionados deben estar dentro de los jugadores convocados.");
    }
  }
}

function toPlayerParticipantId(playerId: string) {
  return `${PLAYER_PREFIX}${playerId}`;
}

function toGuestParticipantId(guestId: string) {
  return `${GUEST_PREFIX}${guestId}`;
}

function resolveManualParticipantId(
  participantId: string,
  guestParticipantIdByKey: Map<string, string>
) {
  if (participantId.startsWith(PLAYER_PREFIX)) return participantId;

  if (participantId.startsWith(GUEST_PREFIX)) {
    const guestKey = participantId.slice(GUEST_PREFIX.length);
    const resolvedGuestParticipantId = guestParticipantIdByKey.get(guestKey);
    if (!resolvedGuestParticipantId) {
      throw new Error("El armado manual incluye invitados que no existen en la convocatoria.");
    }
    return resolvedGuestParticipantId;
  }

  throw new Error("El armado manual incluye participantes invalidos.");
}

async function assertMatchBelongsToOrganization(params: {
  supabase: DbClient;
  matchId: string;
  organizationId?: string;
}) {
  const { supabase, matchId, organizationId } = params;
  if (!organizationId) return;

  const { data: match, error } = await supabase
    .from("matches")
    .select("id")
    .eq("id", matchId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !match) {
    throw new Error("No se encontro el partido para el grupo seleccionado.");
  }
}

async function fetchSelectedPlayers(supabase: DbClient, organizationId: string, playerIds: string[]) {
  if (!playerIds.length) return [];

  const { data, error } = await supabase
    .from("players")
    .select("id, full_name, initial_rank, skill_level, current_rating, display_order, active, preferred_position, secondary_position")
    .eq("organization_id", organizationId)
    .in("id", playerIds)
    .order("display_order", { ascending: true })
    .order("initial_rank", { ascending: true });

  if (error) throw new Error(`No se pudieron leer jugadores: ${error.message}`);
  if (!data || data.length !== playerIds.length) {
    throw new Error("No se pudieron cargar todos los jugadores seleccionados.");
  }

  const inactive = data.find((player) => !player.active);
  if (inactive) {
    throw new Error(`El jugador ${inactive.full_name} esta inactivo.`);
  }

  return data;
}

function toBalancePlayers(
  registeredPlayers: SelectedPlayerForBalance[],
  guests: Array<{ id: string; guest_name: string; guest_rating: number }>,
  goalkeeperPlayerIds: string[] = []
) {
  const totalRegisteredPlayers = registeredPlayers.length;

  const basePlayers: BalanceParticipant[] = registeredPlayers.map((player) => ({
    id: toPlayerParticipantId(player.id),
    fullName: player.full_name,
    preferredPosition: player.preferred_position ?? null,
    secondaryPosition: player.secondary_position ?? null,
    isGoalkeeper: goalkeeperPlayerIds.includes(player.id),
    rating: calculateEffectiveSkillScore({
      skillLevel:
        player.skill_level ??
        mapInitialRankToSkillLevel({
          initialRank: Number(player.initial_rank),
          totalPlayers: totalRegisteredPlayers
        }),
      currentRating: Number(player.current_rating)
    })
  }));

  const guestPlayers: BalanceParticipant[] = guests.map((guest) => ({
    id: toGuestParticipantId(guest.id),
    fullName: guest.guest_name,
    rating: calculateGuestSkillScore(guest.guest_rating)
  }));

  return [...basePlayers, ...guestPlayers];
}

function buildManualTeamOption(params: {
  participants: BalanceParticipant[];
  assignments: ManualTeamAssignmentInput[];
  teamSize: number;
  guestParticipantIdByKey: Map<string, string>;
  goalkeeperPlayerIds: string[];
}) {
  const { participants, assignments, teamSize, guestParticipantIdByKey, goalkeeperPlayerIds } = params;
  const expectedParticipantIds = new Set(participants.map((participant) => participant.id));
  const assignmentByParticipantId = new Map<string, TeamSide>();

  for (const assignment of assignments) {
    const resolvedParticipantId = resolveManualParticipantId(
      assignment.participantId,
      guestParticipantIdByKey
    );
    if (!expectedParticipantIds.has(resolvedParticipantId)) {
      throw new Error("El armado manual incluye participantes que no forman parte de la convocatoria.");
    }
    if (assignmentByParticipantId.has(resolvedParticipantId)) {
      throw new Error("El armado manual incluye participantes duplicados.");
    }
    assignmentByParticipantId.set(resolvedParticipantId, assignment.team);
  }

  if (assignmentByParticipantId.size !== expectedParticipantIds.size) {
    throw new Error("El armado manual debe asignar a todos los convocados.");
  }

  const teamA: BalanceParticipant[] = [];
  const teamB: BalanceParticipant[] = [];
  for (const participant of participants) {
    const assignedTeam = assignmentByParticipantId.get(participant.id);
    if (assignedTeam === "A") teamA.push(participant);
    if (assignedTeam === "B") teamB.push(participant);
  }

  if (teamA.length !== teamSize || teamB.length !== teamSize) {
    throw new Error(`Los equipos manuales deben quedar en ${teamSize} vs ${teamSize}.`);
  }

  if (goalkeeperPlayerIds.length === 2) {
    const [firstGoalkeeperId, secondGoalkeeperId] = goalkeeperPlayerIds.map((playerId) =>
      toPlayerParticipantId(playerId)
    );
    const firstGoalkeeperTeam = assignmentByParticipantId.get(firstGoalkeeperId);
    const secondGoalkeeperTeam = assignmentByParticipantId.get(secondGoalkeeperId);
    if (!firstGoalkeeperTeam || !secondGoalkeeperTeam || firstGoalkeeperTeam === secondGoalkeeperTeam) {
      throw new Error("Los dos arqueros deben quedar en equipos separados.");
    }
  }

  const ratingSumA = Number(teamA.reduce((acc, participant) => acc + participant.rating, 0).toFixed(2));
  const ratingSumB = Number(teamB.reduce((acc, participant) => acc + participant.rating, 0).toFixed(2));
  const ratingDiff = Number(Math.abs(ratingSumA - ratingSumB).toFixed(2));

  return {
    teamA,
    teamB,
    ratingSumA,
    ratingSumB,
    ratingDiff
  };
}

export async function createDraftMatchWithOptions(input: CreateDraftInput) {
  const {
    supabase,
    organizationId,
    scheduledAt,
    modality,
    location,
    selectedPlayerIds,
    invitedGuests,
    teamCreationMode = "auto",
    manualTeamAssignments,
    substituteAssignments = [],
    goalkeeperPlayerIds = [],
    teamALabel,
    teamBLabel
  } = input;
  const substitutesById = validateSubstituteAssignments({
    modality,
    participantIds: [...selectedPlayerIds.map(toPlayerParticipantId), ...invitedGuests.map((guest) => toGuestParticipantId(guest.key))],
    assignments: substituteAssignments,
    goalkeeperPlayerIds
  });
  const starterPlayerIds = selectedPlayerIds.filter((id) => !substitutesById.has(toPlayerParticipantId(id)));
  const starterGuests = invitedGuests.filter((guest) => !substitutesById.has(toGuestParticipantId(guest.key)));
  validatePlayerCount(modality, starterPlayerIds.length, starterGuests.length);
  validateGoalkeeperSelection(selectedPlayerIds, goalkeeperPlayerIds);

  const players = await fetchSelectedPlayers(supabase, organizationId, selectedPlayerIds);

  const guests = invitedGuests.map((guest) => ({
    key: guest.key, id: guest.key, guest_name: guest.name, guest_rating: guest.rating
  }));
  const participants = toBalancePlayers(
    players.filter((player) => !substitutesById.has(toPlayerParticipantId(player.id))),
    guests.filter((guest) => !substitutesById.has(toGuestParticipantId(guest.key))),
    goalkeeperPlayerIds
  );

  const options = teamCreationMode === "manual"
    ? [buildManualTeamOption({
        participants,
        assignments: manualTeamAssignments ?? [],
        teamSize: TEAM_SIZE_BY_MODALITY[modality],
        guestParticipantIdByKey: new Map(guests.map((guest) => [guest.key, toGuestParticipantId(guest.id)])),
        goalkeeperPlayerIds
      })]
    : generateBalancedTeamOptions({
        players: participants,
        modality,
        requestedOptions: 3,
        requiredSeparatedPairs: goalkeeperPlayerIds.length === 2
          ? [[toPlayerParticipantId(goalkeeperPlayerIds[0]), toPlayerParticipantId(goalkeeperPlayerIds[1])] as [string, string]]
          : undefined
      });
  const { data, error } = await supabase.rpc("create_group_match_draft", {
    p_organization_id: organizationId,
    p_request_id: input.requestId ?? crypto.randomUUID(),
    p_input: {
      scheduledAt, modality, location: location || null,
      selectedPlayerIds, invitedGuests, substituteAssignments, goalkeeperPlayerIds,
      teamALabel: normalizeTeamLabel(teamALabel), teamBLabel: normalizeTeamLabel(teamBLabel),
      teamCreationMode, options
    }
  });
  if (error || !data || typeof data !== "object" || !("match_id" in data) || typeof data.match_id !== "string") {
    throw new Error(`No se pudo crear el partido: ${error?.message ?? "respuesta invalida"}`);
  }
  return data.match_id;
}

export async function regenerateDraftTeamOptions(params: {
  supabase: DbClient;
  adminId: string;
  matchId: string;
  organizationId?: string;
}) {
  const { supabase, matchId, organizationId } = params;

  await assertMatchBelongsToOrganization({ supabase, matchId, organizationId });

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("id, modality, status, organization_id, goalkeeper_player_ids, result_version")
    .eq("id", matchId)
    .single();

  if (matchError || !match) throw new Error("No se encontro el partido.");
  if (match.status !== "draft") {
    throw new Error("Solo se pueden regenerar opciones mientras el partido esta en borrador.");
  }

  const [{ data: matchPlayers, error: matchPlayersError }, { data: matchGuests, error: matchGuestsError }] =
    await Promise.all([
      supabase.from("match_players").select("player_id, is_substitute").eq("match_id", matchId),
      supabase.from("match_guests").select("id, guest_name, guest_rating, is_substitute").eq("match_id", matchId)
    ]);
  if (matchPlayersError) throw new Error(`No se pudieron leer convocados: ${matchPlayersError.message}`);
  if (matchGuestsError) {
    if (isGuestSchemaMissing(matchGuestsError.message)) {
      throw new Error(buildGuestSchemaErrorMessage("No se pudieron leer invitados."));
    }
    throw new Error(`No se pudieron leer invitados: ${matchGuestsError.message}`);
  }

  const playerIds = (matchPlayers ?? []).filter((row) => !row.is_substitute).map((row) => row.player_id);
  const starterGuests = (matchGuests ?? []).filter((guest) => !guest.is_substitute);
  validatePlayerCount(match.modality, playerIds.length, starterGuests.length);

  const players = await fetchSelectedPlayers(supabase, match.organization_id, playerIds);
  const participants = toBalancePlayers(players, starterGuests, match.goalkeeper_player_ids ?? []);

  const options = generateBalancedTeamOptions({
    players: participants,
    modality: match.modality,
    requestedOptions: 3,
    requiredSeparatedPairs: match.goalkeeper_player_ids?.length === 2
      ? [[toPlayerParticipantId(match.goalkeeper_player_ids[0]), toPlayerParticipantId(match.goalkeeper_player_ids[1])]]
      : undefined
  });

  const { error } = await supabase.rpc("replace_group_match_options", {
    p_match_id: matchId,
    p_organization_id: match.organization_id,
    p_expected_version: match.result_version ?? 0,
    p_options: JSON.parse(JSON.stringify(options))
  });
  if (error) throw new Error(error.message);
}

export type SaveMatchResultOutcome = {
  firstFinished: boolean;
  resultVersion: number;
  seasonId: string | null;
};

export async function confirmTeamOption(params: {
  supabase: DbClient;
  matchId: string;
  optionId: string;
  organizationId: string;
  teamALabel?: string | null;
  teamBLabel?: string | null;
}) {
  const { error } = await params.supabase.rpc("confirm_group_match_option", {
    p_match_id: params.matchId,
    p_organization_id: params.organizationId,
    p_option_id: params.optionId,
    p_team_a_label: normalizeTeamLabel(params.teamALabel),
    p_team_b_label: normalizeTeamLabel(params.teamBLabel)
  });
  if (error) throw new Error(error.message);
}

export async function saveMatchResult(params: {
  supabase: DbClient;
  adminId: string;
  matchId: string;
  organizationId: string;
  resultInput: MatchResultInput;
}): Promise<SaveMatchResultOutcome> {
  const { resultInput } = params;
  if (![resultInput.scoreA, resultInput.scoreB].every((score) => Number.isInteger(score) && score >= 0)) {
    throw new Error("El resultado debe tener goles enteros no negativos.");
  }
  // No client-side writes or fallback: the entire result is committed by PostgreSQL.
  const { data, error } = await params.supabase.rpc("save_group_match_result", {
    p_match_id: params.matchId,
    p_organization_id: params.organizationId,
    p_expected_version: resultInput.expectedVersion ?? 0,
    p_input: JSON.parse(JSON.stringify(resultInput)),
    p_finish: true
  });
  if (error) throw new Error(error.message);
  const outcome = data as { first_finished: boolean; result_version: number; season_id: string | null };
  return { firstFinished: outcome.first_finished, resultVersion: outcome.result_version, seasonId: outcome.season_id };
}

export async function saveConfirmedMatchLineup(params: {
  supabase: DbClient;
  matchId: string;
  organizationId: string;
  expectedVersion?: number;
  lineupInput: NonNullable<MatchResultInput["lineup"]>;
}) {
  const { error } = await params.supabase.rpc("save_group_match_result", {
    p_match_id: params.matchId,
    p_organization_id: params.organizationId,
    p_expected_version: params.expectedVersion ?? 0,
    p_input: JSON.parse(JSON.stringify({ lineup: params.lineupInput })),
    p_finish: false
  });
  if (error) throw new Error(error.message);
}
