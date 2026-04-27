import { TEAM_SIZE_BY_MODALITY } from "@/lib/constants";
import { calculateMatchRatingAdjustments, deriveWinnerTeam } from "@/lib/domain/rating";
import { calculateEffectiveSkillScore, mapInitialRankToSkillLevel } from "@/lib/domain/skill-level";
import { generateBalancedTeamOptions } from "@/lib/domain/team-generator";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MatchModality, MatchResultInput, ResultAssignmentTeam, TeamSide } from "@/types/domain";

type DbClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type DraftGuestInput = {
  key: string;
  name: string;
  rating: number;
};

type BalanceParticipant = {
  id: string;
  fullName: string;
  rating: number;
};

type SelectedPlayerForBalance = {
  id: string;
  full_name: string;
  initial_rank: number;
  skill_level: number | null;
  current_rating: number;
  active: boolean;
};

type ConfirmedParticipant = {
  id: string;
  source: "player" | "guest";
  entityId: string;
  full_name: string;
  current_rating: number;
};

type ManualTeamAssignmentInput = {
  participantId: string;
  team: TeamSide;
};

type LineupAssignmentInput = {
  participantId: string;
  team: ResultAssignmentTeam;
};

type NewGuestLineupInput = {
  name: string;
  rating: number;
  team: TeamSide;
};

type NewPlayerLineupInput = {
  playerId: string;
  team: TeamSide;
};

type MatchLineupAdjustmentInput = {
  assignments: LineupAssignmentInput[];
  newPlayers?: NewPlayerLineupInput[];
  newGuests?: NewGuestLineupInput[];
};

type ResolvedMatchLineup = {
  optionId: string;
  teamA: ConfirmedParticipant[];
  teamB: ConfirmedParticipant[];
  handicapTeam: TeamSide | null;
};

type CreateDraftInput = {
  supabase: DbClient;
  adminId: string;
  organizationId: string;
  scheduledAt: string;
  modality: MatchModality;
  location?: string;
  teamALabel?: string | null;
  teamBLabel?: string | null;
  selectedPlayerIds: string[];
  invitedGuests: DraftGuestInput[];
  teamCreationMode?: "auto" | "manual";
  manualTeamAssignments?: ManualTeamAssignmentInput[];
  goalkeeperPlayerIds?: string[];
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

function parseParticipantId(participantId: string): { source: "player" | "guest"; entityId: string } {
  if (participantId.startsWith(PLAYER_PREFIX)) {
    return {
      source: "player",
      entityId: participantId.slice(PLAYER_PREFIX.length)
    };
  }
  if (participantId.startsWith(GUEST_PREFIX)) {
    return {
      source: "guest",
      entityId: participantId.slice(GUEST_PREFIX.length)
    };
  }
  throw new Error("Participante invalido dentro de la opcion de equipos.");
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
    .select("id, full_name, initial_rank, skill_level, current_rating, display_order, active")
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
  guests: Array<{ id: string; guest_name: string; guest_rating: number }>
) {
  const totalRegisteredPlayers = registeredPlayers.length;

  const basePlayers: BalanceParticipant[] = registeredPlayers.map((player) => ({
    id: toPlayerParticipantId(player.id),
    fullName: player.full_name,
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
    rating: calculateEffectiveSkillScore({
      skillLevel: Number(guest.guest_rating),
      currentRating: 1000
    })
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

async function insertTeamOptions(
  supabase: DbClient,
  adminId: string,
  matchId: string,
  options: ReturnType<typeof generateBalancedTeamOptions>
): Promise<Array<{ id: string; option_number: number }>> {
  const optionRows = options.map((option, index) => ({
    match_id: matchId,
    option_number: index + 1,
    rating_sum_a: option.ratingSumA,
    rating_sum_b: option.ratingSumB,
    rating_diff: option.ratingDiff,
    created_by: adminId
  }));

  const { data: insertedOptions, error: insertOptionError } = await supabase
    .from("team_options")
    .insert(optionRows)
    .select("id, option_number");

  if (insertOptionError) {
    throw new Error(`No se pudieron guardar opciones de equipos: ${insertOptionError.message}`);
  }

  const playerRows:
    | Array<{
        team_option_id: string;
        player_id: string;
        team: "A" | "B";
      }>
    = [];
  const guestRows:
    | Array<{
        team_option_id: string;
        guest_id: string;
        team: "A" | "B";
      }>
    = [];

  for (const insertedOption of insertedOptions ?? []) {
    const option = options[insertedOption.option_number - 1];

    for (const member of option.teamA) {
      const parsed = parseParticipantId(member.id);
      if (parsed.source === "player") {
        playerRows.push({
          team_option_id: insertedOption.id,
          player_id: parsed.entityId,
          team: "A"
        });
      } else {
        guestRows.push({
          team_option_id: insertedOption.id,
          guest_id: parsed.entityId,
          team: "A"
        });
      }
    }

    for (const member of option.teamB) {
      const parsed = parseParticipantId(member.id);
      if (parsed.source === "player") {
        playerRows.push({
          team_option_id: insertedOption.id,
          player_id: parsed.entityId,
          team: "B"
        });
      } else {
        guestRows.push({
          team_option_id: insertedOption.id,
          guest_id: parsed.entityId,
          team: "B"
        });
      }
    }
  }

  if (!playerRows.length && !guestRows.length) {
    throw new Error("No se pudieron construir los jugadores de las opciones.");
  }

  if (playerRows.length) {
    const { error: insertPlayersError } = await supabase.from("team_option_players").insert(playerRows);
    if (insertPlayersError) {
      throw new Error(`No se pudieron guardar jugadores registrados en opciones: ${insertPlayersError.message}`);
    }
  }

  if (guestRows.length) {
    const { error: insertGuestsError } = await supabase.from("team_option_guests").insert(guestRows);
    if (insertGuestsError) {
      if (isGuestSchemaMissing(insertGuestsError.message)) {
        throw new Error(buildGuestSchemaErrorMessage("No se pudieron guardar invitados en opciones."));
      }
      throw new Error(`No se pudieron guardar invitados en opciones: ${insertGuestsError.message}`);
    }
  }

  return insertedOptions ?? [];
}

async function insertDraftGuests(params: {
  supabase: DbClient;
  matchId: string;
  invitedGuests: DraftGuestInput[];
}) {
  const { supabase, matchId, invitedGuests } = params;
  if (!invitedGuests.length) return [] as Array<{ key: string; id: string; guest_name: string; guest_rating: number }>;

  const insertedGuests: Array<{ key: string; id: string; guest_name: string; guest_rating: number }> = [];
  for (const guest of invitedGuests) {
    const { data, error } = await supabase
      .from("match_guests")
      .insert({
        match_id: matchId,
        guest_name: guest.name,
        guest_rating: guest.rating
      })
      .select("id, guest_name, guest_rating")
      .single();

    if (error || !data) {
      if (error && isGuestSchemaMissing(error.message)) {
        throw new Error(buildGuestSchemaErrorMessage("No se pudieron guardar invitados del partido."));
      }
      throw new Error(`No se pudieron guardar invitados del partido: ${error?.message ?? "sin detalle"}`);
    }

    insertedGuests.push({
      key: guest.key,
      id: data.id,
      guest_name: data.guest_name,
      guest_rating: Number(data.guest_rating)
    });
  }

  return insertedGuests;
}

export async function createDraftMatchWithOptions(input: CreateDraftInput) {
  const {
    supabase,
    adminId,
    organizationId,
    scheduledAt,
    modality,
    location,
    teamALabel,
    teamBLabel,
    selectedPlayerIds,
    invitedGuests,
    teamCreationMode = "auto",
    manualTeamAssignments,
    goalkeeperPlayerIds = []
  } = input;
  validatePlayerCount(modality, selectedPlayerIds.length, invitedGuests.length);
  validateGoalkeeperSelection(selectedPlayerIds, goalkeeperPlayerIds);

  const players = await fetchSelectedPlayers(supabase, organizationId, selectedPlayerIds);

  const { data: match, error: createMatchError } = await supabase
    .from("matches")
    .insert({
      organization_id: organizationId,
      scheduled_at: scheduledAt,
      modality,
      status: "draft",
      location: location || null,
      team_a_label: teamALabel ?? null,
      team_b_label: teamBLabel ?? null,
      created_by: adminId
    })
    .select("id")
    .single();

  if (createMatchError || !match) {
    throw new Error(`No se pudo crear el partido: ${createMatchError?.message ?? "sin detalle"}`);
  }

  if (selectedPlayerIds.length) {
    const matchPlayersRows = selectedPlayerIds.map((playerId) => ({ match_id: match.id, player_id: playerId }));
    const { error: matchPlayersError } = await supabase.from("match_players").insert(matchPlayersRows);
    if (matchPlayersError) {
      throw new Error(`No se pudieron asociar jugadores al partido: ${matchPlayersError.message}`);
    }
  }

  const insertedGuests = await insertDraftGuests({
    supabase,
    matchId: match.id,
    invitedGuests
  });
  const participants = toBalancePlayers(players, insertedGuests);

  if (teamCreationMode === "manual") {
    if (!manualTeamAssignments?.length) {
      throw new Error("Falta el armado manual de equipos.");
    }

    const guestParticipantIdByKey = new Map(
      insertedGuests.map((guest) => [guest.key, toGuestParticipantId(guest.id)])
    );
    const manualOption = buildManualTeamOption({
      participants,
      assignments: manualTeamAssignments,
      teamSize: TEAM_SIZE_BY_MODALITY[modality],
      guestParticipantIdByKey,
      goalkeeperPlayerIds
    });

    const insertedOptions = await insertTeamOptions(supabase, adminId, match.id, [manualOption]);
    const optionIdToConfirm = insertedOptions.find((option) => option.option_number === 1)?.id;
    if (!optionIdToConfirm) {
      throw new Error("No se pudo confirmar la opcion manual de equipos.");
    }

    await confirmTeamOption({
      supabase,
      matchId: match.id,
      optionId: optionIdToConfirm
    });
    return match.id;
  }

  const requiredSeparatedPairs =
    goalkeeperPlayerIds.length === 2
      ? [[toPlayerParticipantId(goalkeeperPlayerIds[0]), toPlayerParticipantId(goalkeeperPlayerIds[1])] as [string, string]]
      : undefined;

  const options = generateBalancedTeamOptions({
    players: participants,
    modality,
    requestedOptions: 3,
    requiredSeparatedPairs
  });

  await insertTeamOptions(supabase, adminId, match.id, options);

  return match.id;
}

export async function regenerateDraftTeamOptions(params: {
  supabase: DbClient;
  adminId: string;
  matchId: string;
  organizationId?: string;
}) {
  const { supabase, adminId, matchId, organizationId } = params;

  await assertMatchBelongsToOrganization({ supabase, matchId, organizationId });

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("id, modality, status, organization_id")
    .eq("id", matchId)
    .single();

  if (matchError || !match) throw new Error("No se encontro el partido.");
  if (match.status !== "draft") {
    throw new Error("Solo se pueden regenerar opciones mientras el partido esta en borrador.");
  }

  const [{ data: matchPlayers, error: matchPlayersError }, { data: matchGuests, error: matchGuestsError }] =
    await Promise.all([
      supabase.from("match_players").select("player_id").eq("match_id", matchId),
      supabase.from("match_guests").select("id, guest_name, guest_rating").eq("match_id", matchId)
    ]);
  if (matchPlayersError) throw new Error(`No se pudieron leer convocados: ${matchPlayersError.message}`);
  if (matchGuestsError) {
    if (isGuestSchemaMissing(matchGuestsError.message)) {
      throw new Error(buildGuestSchemaErrorMessage("No se pudieron leer invitados."));
    }
    throw new Error(`No se pudieron leer invitados: ${matchGuestsError.message}`);
  }

  const playerIds = (matchPlayers ?? []).map((row) => row.player_id);
  validatePlayerCount(match.modality, playerIds.length, (matchGuests ?? []).length);

  const players = await fetchSelectedPlayers(supabase, match.organization_id, playerIds);
  const participants = toBalancePlayers(players, matchGuests ?? []);

  const { data: existingOptions, error: existingOptionsError } = await supabase
    .from("team_options")
    .select("id")
    .eq("match_id", matchId)
    .eq("is_confirmed", false);

  if (existingOptionsError) {
    throw new Error(`No se pudieron leer opciones existentes: ${existingOptionsError.message}`);
  }

  if (existingOptions?.length) {
    const idsToDelete = existingOptions.map((option) => option.id);
    const { error: deleteOptionsError } = await supabase.from("team_options").delete().in("id", idsToDelete);
    if (deleteOptionsError) {
      throw new Error(`No se pudieron limpiar opciones anteriores: ${deleteOptionsError.message}`);
    }
  }

  const options = generateBalancedTeamOptions({
    players: participants,
    modality: match.modality,
    requestedOptions: 3
  });

  await insertTeamOptions(supabase, adminId, matchId, options);
}

export async function confirmTeamOption(params: {
  supabase: DbClient;
  matchId: string;
  optionId: string;
  organizationId?: string;
}) {
  const { supabase, matchId, optionId, organizationId } = params;

  await assertMatchBelongsToOrganization({ supabase, matchId, organizationId });

  const { error: resetError } = await supabase
    .from("team_options")
    .update({ is_confirmed: false })
    .eq("match_id", matchId);
  if (resetError) throw new Error(`No se pudo resetear confirmacion previa: ${resetError.message}`);

  const { error: confirmError } = await supabase
    .from("team_options")
    .update({ is_confirmed: true })
    .eq("id", optionId)
    .eq("match_id", matchId);
  if (confirmError) throw new Error(`No se pudo confirmar opcion: ${confirmError.message}`);

  const { error: updateMatchError } = await supabase
    .from("matches")
    .update({ status: "confirmed", confirmed_option_id: optionId })
    .eq("id", matchId);
  if (updateMatchError) throw new Error(`No se pudo actualizar estado del partido: ${updateMatchError.message}`);
}

async function rollbackPreviousRatingHistory(supabase: DbClient, matchId: string) {
  const { data: previousHistory, error: historyError } = await supabase
    .from("rating_history")
    .select("id, player_id, delta")
    .eq("match_id", matchId);

  if (historyError) throw new Error(`No se pudo leer historial de rendimiento: ${historyError.message}`);
  if (!previousHistory?.length) return;

  for (const row of previousHistory) {
    const { data: playerRow, error: playerError } = await supabase
      .from("players")
      .select("current_rating")
      .eq("id", row.player_id)
      .single();
    if (playerError || !playerRow) {
      throw new Error("No se pudo restaurar rendimiento anterior.");
    }

    const reverted = Math.round(Number(playerRow.current_rating) - Number(row.delta));
    const { error: revertError } = await supabase
      .from("players")
      .update({ current_rating: reverted })
      .eq("id", row.player_id);
    if (revertError) {
      throw new Error(`No se pudo revertir rendimiento de jugador: ${revertError.message}`);
    }
  }

  const { error: deleteHistoryError } = await supabase.from("rating_history").delete().eq("match_id", matchId);
  if (deleteHistoryError) {
    throw new Error(`No se pudo limpiar historial previo de rendimiento: ${deleteHistoryError.message}`);
  }
}

async function loadConfirmedTeams(
  supabase: DbClient,
  matchId: string
): Promise<{ teamA: ConfirmedParticipant[]; teamB: ConfirmedParticipant[]; optionId: string }> {
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("confirmed_option_id")
    .eq("id", matchId)
    .single();

  if (matchError || !match?.confirmed_option_id) {
    throw new Error("El partido todavia no tiene equipos confirmados.");
  }

  const optionId = match.confirmed_option_id;
  const [{ data: optionPlayers, error: optionPlayersError }, { data: optionGuests, error: optionGuestsError }] =
    await Promise.all([
      supabase.from("team_option_players").select("team, player_id").eq("team_option_id", optionId),
      supabase.from("team_option_guests").select("team, guest_id").eq("team_option_id", optionId)
    ]);

  if (optionPlayersError) {
    throw new Error(`No se pudieron leer jugadores de la opcion confirmada: ${optionPlayersError.message}`);
  }
  if (optionGuestsError) {
    if (isGuestSchemaMissing(optionGuestsError.message)) {
      throw new Error(buildGuestSchemaErrorMessage("No se pudieron leer invitados de la opcion confirmada."));
    }
    throw new Error(`No se pudieron leer invitados de la opcion confirmada: ${optionGuestsError.message}`);
  }

  const playerIds = (optionPlayers ?? []).map((row) => row.player_id);
  const guestIds = (optionGuests ?? []).map((row) => row.guest_id);

  const [{ data: players, error: playersError }, { data: guests, error: guestsError }] = await Promise.all([
    playerIds.length
      ? supabase.from("players").select("id, full_name, current_rating").in("id", playerIds)
      : Promise.resolve({ data: [], error: null }),
    guestIds.length
      ? supabase.from("match_guests").select("id, guest_name, guest_rating").in("id", guestIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (playersError) {
    throw new Error(`No se pudieron leer rendimientos de jugadores: ${playersError.message}`);
  }
  if (guestsError) {
    if (isGuestSchemaMissing(guestsError.message)) {
        throw new Error(buildGuestSchemaErrorMessage("No se pudieron leer rendimientos de invitados."));
    }
    throw new Error(`No se pudieron leer rendimientos de invitados: ${guestsError.message}`);
  }

  const playersById = new Map((players ?? []).map((player) => [player.id, player]));
  const guestsById = new Map((guests ?? []).map((guest) => [guest.id, guest]));
  const teamA: ConfirmedParticipant[] = [];
  const teamB: ConfirmedParticipant[] = [];

  for (const row of optionPlayers ?? []) {
    const player = playersById.get(row.player_id);
    if (!player) continue;
    const normalized: ConfirmedParticipant = {
      id: toPlayerParticipantId(player.id),
      source: "player",
      entityId: player.id,
      full_name: player.full_name,
      current_rating: Number(player.current_rating)
    };
    if (row.team === "A") teamA.push(normalized);
    if (row.team === "B") teamB.push(normalized);
  }

  for (const row of optionGuests ?? []) {
    const guest = guestsById.get(row.guest_id);
    if (!guest) continue;
    const normalized: ConfirmedParticipant = {
      id: toGuestParticipantId(guest.id),
      source: "guest",
      entityId: guest.id,
      full_name: guest.guest_name,
      current_rating: Number(guest.guest_rating)
    };
    if (row.team === "A") teamA.push(normalized);
    if (row.team === "B") teamB.push(normalized);
  }

  return { teamA, teamB, optionId };
}

function normalizeLineupAssignments(
  rawAssignments: LineupAssignmentInput[] | undefined,
  participantsById: Map<string, ConfirmedParticipant>
) {
  const assignmentMap = new Map<string, ResultAssignmentTeam>();

  for (const assignment of rawAssignments ?? []) {
    if (!participantsById.has(assignment.participantId)) {
      throw new Error("La formacion final incluye un participante inexistente.");
    }
    assignmentMap.set(assignment.participantId, assignment.team);
  }

  return assignmentMap;
}

function normalizeLineupGuests(rawGuests: NewGuestLineupInput[] | undefined) {
  return (rawGuests ?? []).map((guest) => {
    const normalizedName = guest.name.trim();
    const normalizedRating = Number(guest.rating);

    if (!normalizedName) {
      throw new Error("Los invitados agregados deben tener nombre.");
    }
    if (!Number.isFinite(normalizedRating) || normalizedRating <= 0) {
      throw new Error(`El invitado ${normalizedName} tiene un rendimiento invalido.`);
    }

    return {
      name: normalizedName,
      rating: Math.round(normalizedRating),
      team: guest.team
    };
  });
}

function normalizeLineupPlayers(rawPlayers: NewPlayerLineupInput[] | undefined) {
  const usedPlayerIds = new Set<string>();

  return (rawPlayers ?? []).map((row) => {
    const normalizedPlayerId = row.playerId.trim();
    if (!normalizedPlayerId) {
      throw new Error("Los jugadores de reemplazo deben tener un ID valido.");
    }
    if (usedPlayerIds.has(normalizedPlayerId)) {
      throw new Error("Hay jugadores de reemplazo duplicados en la formacion final.");
    }
    usedPlayerIds.add(normalizedPlayerId);

    return {
      playerId: normalizedPlayerId,
      team: row.team
    };
  });
}

async function insertNewLineupGuests(params: {
  supabase: DbClient;
  matchId: string;
  guests: Array<{ name: string; rating: number; team: TeamSide }>;
}) {
  const { supabase, matchId, guests } = params;
  if (!guests.length) return [];

  const insertedGuests: ConfirmedParticipant[] = [];
  for (const guest of guests) {
    const { data, error } = await supabase
      .from("match_guests")
      .insert({
        match_id: matchId,
        guest_name: guest.name,
        guest_rating: guest.rating
      })
      .select("id, guest_name, guest_rating")
      .single();

    if (error || !data) {
      if (error && isGuestSchemaMissing(error.message)) {
        throw new Error(buildGuestSchemaErrorMessage("No se pudieron guardar invitados agregados al resultado."));
      }
      throw new Error(`No se pudieron guardar invitados agregados al resultado: ${error?.message ?? "sin detalle"}`);
    }

    insertedGuests.push({
      id: toGuestParticipantId(data.id),
      source: "guest",
      entityId: data.id,
      full_name: data.guest_name,
      current_rating: Number(data.guest_rating)
    });
  }

  return insertedGuests;
}

async function resolveNewLineupPlayers(params: {
  supabase: DbClient;
  organizationId: string;
  players: Array<{ playerId: string; team: TeamSide }>;
  participantsById: Map<string, ConfirmedParticipant>;
}) {
  const { supabase, organizationId, players, participantsById } = params;
  if (!players.length) return [];

  const playerIds = players.map((player) => player.playerId);
  const { data: playerRows, error: playersError } = await supabase
    .from("players")
    .select("id, full_name, current_rating, organization_id")
    .in("id", playerIds)
    .eq("organization_id", organizationId);

  if (playersError) {
    throw new Error(`No se pudieron leer jugadores de reemplazo: ${playersError.message}`);
  }

  const playersById = new Map((playerRows ?? []).map((row) => [row.id, row]));
  if (playersById.size !== playerIds.length) {
    throw new Error("Al menos un jugador de reemplazo no existe o no pertenece a este grupo.");
  }

  return players.map((player) => {
    const participantId = toPlayerParticipantId(player.playerId);
    if (participantsById.has(participantId)) {
      throw new Error("No puedes agregar como reemplazo a un jugador que ya estaba en la formacion confirmada.");
    }

    const playerRow = playersById.get(player.playerId);
    if (!playerRow) {
      throw new Error("No se encontro un jugador de reemplazo seleccionado.");
    }

    return {
      participant: {
        id: participantId,
        source: "player" as const,
        entityId: playerRow.id,
        full_name: playerRow.full_name,
        current_rating: Number(playerRow.current_rating)
      },
      team: player.team
    };
  });
}

async function persistConfirmedLineup(params: {
  supabase: DbClient;
  optionId: string;
  teamA: ConfirmedParticipant[];
  teamB: ConfirmedParticipant[];
}) {
  const { supabase, optionId, teamA, teamB } = params;
  const allMembers = [
    ...teamA.map((member) => ({ ...member, team: "A" as TeamSide })),
    ...teamB.map((member) => ({ ...member, team: "B" as TeamSide }))
  ];

  const { error: deletePlayersError } = await supabase
    .from("team_option_players")
    .delete()
    .eq("team_option_id", optionId);
  if (deletePlayersError) {
    throw new Error(`No se pudo actualizar la formacion confirmada: ${deletePlayersError.message}`);
  }

  const { error: deleteGuestsError } = await supabase
    .from("team_option_guests")
    .delete()
    .eq("team_option_id", optionId);
  if (deleteGuestsError) {
    if (isGuestSchemaMissing(deleteGuestsError.message)) {
      throw new Error(buildGuestSchemaErrorMessage("No se pudo actualizar la formacion confirmada."));
    }
    throw new Error(`No se pudo actualizar la formacion confirmada: ${deleteGuestsError.message}`);
  }

  const playerRows = allMembers
    .filter((member) => member.source === "player")
    .map((member) => ({
      team_option_id: optionId,
      player_id: member.entityId,
      team: member.team
    }));
  const guestRows = allMembers
    .filter((member) => member.source === "guest")
    .map((member) => ({
      team_option_id: optionId,
      guest_id: member.entityId,
      team: member.team
    }));

  if (playerRows.length) {
    const { error: insertPlayersError } = await supabase.from("team_option_players").insert(playerRows);
    if (insertPlayersError) {
      throw new Error(`No se pudieron guardar jugadores en la formacion confirmada: ${insertPlayersError.message}`);
    }
  }

  if (guestRows.length) {
    const { error: insertGuestsError } = await supabase.from("team_option_guests").insert(guestRows);
    if (insertGuestsError) {
      if (isGuestSchemaMissing(insertGuestsError.message)) {
        throw new Error(buildGuestSchemaErrorMessage("No se pudieron guardar invitados en la formacion confirmada."));
      }
      throw new Error(`No se pudieron guardar invitados en la formacion confirmada: ${insertGuestsError.message}`);
    }
  }
}

async function resolveLineupForResult(params: {
  supabase: DbClient;
  matchId: string;
  resultInput: MatchResultInput;
}) {
  const { supabase, matchId, resultInput } = params;
  const confirmed = await loadConfirmedTeams(supabase, matchId);
  const participants = [...confirmed.teamA, ...confirmed.teamB];
  const participantsById = new Map(participants.map((participant) => [participant.id, participant]));
  const lineupInput = resultInput.lineup;

  if (!lineupInput) {
    return {
      optionId: confirmed.optionId,
      teamA: confirmed.teamA,
      teamB: confirmed.teamB,
      handicapTeam: null
    } satisfies ResolvedMatchLineup;
  }

  const assignmentMap = normalizeLineupAssignments(lineupInput.assignments, participantsById);
  const teamA: ConfirmedParticipant[] = [];
  const teamB: ConfirmedParticipant[] = [];

  for (const participant of participants) {
    const team = assignmentMap.get(participant.id) ?? "OUT";
    if (team === "A") teamA.push(participant);
    if (team === "B") teamB.push(participant);
  }

  const normalizedGuests = normalizeLineupGuests(lineupInput.newGuests);
  const insertedGuests = await insertNewLineupGuests({
    supabase,
    matchId,
    guests: normalizedGuests
  });

  insertedGuests.forEach((guest, index) => {
    const targetTeam = normalizedGuests[index]?.team;
    if (targetTeam === "A") teamA.push(guest);
    if (targetTeam === "B") teamB.push(guest);
  });

  if (!teamA.length || !teamB.length) {
    throw new Error("Cada equipo debe tener al menos un participante en la formacion final.");
  }

  const handicapTeam = lineupInput.handicapTeam ?? null;
  if (handicapTeam) {
    const handicapCount = handicapTeam === "A" ? teamA.length : teamB.length;
    const otherCount = handicapTeam === "A" ? teamB.length : teamA.length;
    if (handicapCount >= otherCount) {
      throw new Error("El equipo marcado con desventaja debe tener menos jugadores que el rival.");
    }
  }

  await persistConfirmedLineup({
    supabase,
    optionId: confirmed.optionId,
    teamA,
    teamB
  });

  return {
    optionId: confirmed.optionId,
    teamA,
    teamB,
    handicapTeam
  } satisfies ResolvedMatchLineup;
}

export async function saveMatchResult(params: {
  supabase: DbClient;
  adminId: string;
  matchId: string;
  resultInput: MatchResultInput;
  organizationId?: string;
}) {
  const { supabase, adminId, matchId, resultInput, organizationId } = params;
  const { scoreA, scoreB, notes } = resultInput;

  if (scoreA < 0 || scoreB < 0) {
    throw new Error("El resultado no puede tener goles negativos.");
  }

  await assertMatchBelongsToOrganization({ supabase, matchId, organizationId });

  const winnerTeam = deriveWinnerTeam(scoreA, scoreB);

  await rollbackPreviousRatingHistory(supabase, matchId);
  const { teamA, teamB, handicapTeam } = await resolveLineupForResult({
    supabase,
    matchId,
    resultInput
  });
  const adjustments = calculateMatchRatingAdjustments({
    teamA: teamA.map((player) => ({ id: player.id, rating: player.current_rating })),
    teamB: teamB.map((player) => ({ id: player.id, rating: player.current_rating })),
    winnerTeam,
    shortHandedTeam: handicapTeam
  });

  const { error: upsertResultError } = await supabase.from("match_result").upsert(
    {
      match_id: matchId,
      created_by: adminId,
      score_a: scoreA,
      score_b: scoreB,
      winner_team: winnerTeam,
      notes: notes ?? null
    },
    { onConflict: "match_id" }
  );
  if (upsertResultError) {
    throw new Error(`No se pudo guardar resultado: ${upsertResultError.message}`);
  }

  const registeredPlayerAdjustments = adjustments
    .map((adjustment) => {
      const parsed = parseParticipantId(adjustment.playerId);
      if (parsed.source !== "player") return null;
      return {
        ...adjustment,
        playerId: parsed.entityId
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null);

  for (const adjustment of registeredPlayerAdjustments) {
    const { error: updatePlayerError } = await supabase
      .from("players")
      .update({ current_rating: adjustment.ratingAfter })
      .eq("id", adjustment.playerId);

    if (updatePlayerError) {
      throw new Error(`No se pudo actualizar rendimiento de un jugador: ${updatePlayerError.message}`);
    }
  }

  if (registeredPlayerAdjustments.length) {
    const historyRows = registeredPlayerAdjustments.map((adjustment) => ({
      match_id: matchId,
      player_id: adjustment.playerId,
      rating_before: adjustment.ratingBefore,
      rating_after: adjustment.ratingAfter,
      delta: adjustment.delta,
      reason: "match_result"
    }));

    const { error: historyInsertError } = await supabase.from("rating_history").insert(historyRows);
    if (historyInsertError) {
      throw new Error(`No se pudo guardar historial de rendimiento: ${historyInsertError.message}`);
    }
  }

  const { error: updateMatchError } = await supabase
    .from("matches")
    .update({
      status: "finished",
      finished_at: new Date().toISOString()
    })
    .eq("id", matchId);

  if (updateMatchError) {
    throw new Error(`No se pudo actualizar estado final del partido: ${updateMatchError.message}`);
  }
}

export async function saveConfirmedMatchLineup(params: {
  supabase: DbClient;
  matchId: string;
  organizationId: string;
  lineupInput: MatchLineupAdjustmentInput;
}) {
  const { supabase, matchId, organizationId, lineupInput } = params;
  await assertMatchBelongsToOrganization({ supabase, matchId, organizationId });

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("id, status")
    .eq("id", matchId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (matchError || !match) {
    throw new Error("No se encontro el partido para el grupo seleccionado.");
  }

  if (match.status !== "confirmed") {
    throw new Error("Solo puedes ajustar la formacion en partidos confirmados.");
  }

  const { data: existingResult, error: resultError } = await supabase
    .from("match_result")
    .select("id")
    .eq("match_id", matchId)
    .maybeSingle();
  if (resultError) {
    throw new Error(`No se pudo verificar el resultado del partido: ${resultError.message}`);
  }
  if (existingResult) {
    throw new Error("Este partido ya tiene resultado. Solo puedes ajustar formacion antes de cargarlo.");
  }

  const confirmed = await loadConfirmedTeams(supabase, matchId);
  const participants = [...confirmed.teamA, ...confirmed.teamB];
  const participantsById = new Map(participants.map((participant) => [participant.id, participant]));

  const assignmentMap = normalizeLineupAssignments(lineupInput.assignments, participantsById);
  const teamA: ConfirmedParticipant[] = [];
  const teamB: ConfirmedParticipant[] = [];

  for (const participant of participants) {
    const team = assignmentMap.get(participant.id) ?? "OUT";
    if (team === "A") teamA.push(participant);
    if (team === "B") teamB.push(participant);
  }

  const normalizedNewPlayers = normalizeLineupPlayers(lineupInput.newPlayers);
  const additionalPlayers = await resolveNewLineupPlayers({
    supabase,
    organizationId,
    players: normalizedNewPlayers,
    participantsById
  });
  for (const row of additionalPlayers) {
    if (row.team === "A") teamA.push(row.participant);
    if (row.team === "B") teamB.push(row.participant);
  }

  const normalizedGuests = normalizeLineupGuests(lineupInput.newGuests);
  const insertedGuests = await insertNewLineupGuests({
    supabase,
    matchId,
    guests: normalizedGuests
  });

  insertedGuests.forEach((guest, index) => {
    const targetTeam = normalizedGuests[index]?.team;
    if (targetTeam === "A") teamA.push(guest);
    if (targetTeam === "B") teamB.push(guest);
  });

  if (!teamA.length || !teamB.length) {
    throw new Error("Cada equipo debe tener al menos un participante en la formacion final.");
  }

  await persistConfirmedLineup({
    supabase,
    optionId: confirmed.optionId,
    teamA,
    teamB
  });
}
