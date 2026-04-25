import { generateRoundRobinFixture } from "@/lib/domain/tournament-fixture";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TournamentMatchSheetInput } from "@/types/domain";

type DbClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type CompetitionTeamRow = {
  id: string;
  competition_id: string;
  display_name: string;
  short_name: string | null;
  display_order: number;
};

type CompetitionMatchRow = {
  id: string;
  competition_id: string;
  home_team_id: string;
  away_team_id: string;
  status: string;
};

type NormalizedMatchStat = {
  entryKey: string;
  competitionTeamId: string;
  playerId: string | null;
  playerName: string;
  goals: number;
  yellowCards: number;
  redCards: number;
  isMvp: boolean;
};

function uniqueValues(values: string[]) {
  return Array.from(new Set(values));
}

async function ensureCompetitionExists(supabase: DbClient, competitionId: string) {
  const { data, error } = await supabase
    .from("competitions")
    .select("id")
    .eq("id", competitionId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("No se encontró la competencia seleccionada.");
  }
}

async function loadCompetitionTeams(supabase: DbClient, competitionId: string) {
  const { data, error } = await supabase
    .from("competition_teams")
    .select("id, competition_id, display_name, short_name, display_order")
    .eq("competition_id", competitionId)
    .order("display_order", { ascending: true });

  if (error) throw new Error(`No se pudieron leer los equipos inscriptos: ${error.message}`);
  return (data ?? []) as CompetitionTeamRow[];
}

async function assertMatchBelongsToCompetition(params: {
  supabase: DbClient;
  competitionId: string;
  matchId: string;
}) {
  const { supabase, competitionId, matchId } = params;
  const { data, error } = await supabase
    .from("competition_matches")
    .select("id, competition_id, home_team_id, away_team_id, status")
    .eq("id", matchId)
    .eq("competition_id", competitionId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("No se encontró el partido dentro de la competencia seleccionada.");
  }

  return data as CompetitionMatchRow;
}

function normalizeCompetitionMatchStats(input: TournamentMatchSheetInput) {
  const mvpKey = input.mvpEntryKey?.trim() || null;
  const stats: NormalizedMatchStat[] = [];
  let mvpRow: NormalizedMatchStat | null = null;

  for (const row of input.stats) {
    const normalizedName = row.playerName.trim();
    const goals = Math.max(0, Math.floor(row.goals));
    const yellowCards = Math.max(0, Math.floor(row.yellowCards));
    const redCards = Math.max(0, Math.floor(row.redCards));
    const isMvp = mvpKey === row.entryKey;
    const hasStats = goals > 0 || yellowCards > 0 || redCards > 0;

    if (!row.teamId.trim()) {
      throw new Error("Cada fila del acta debe pertenecer a un equipo.");
    }

    if (!row.playerId && !normalizedName && !hasStats && !isMvp) {
      continue;
    }

    if (!row.playerId && !normalizedName) {
      throw new Error("Cada fila libre del acta necesita un nombre para poder guardarse.");
    }

    const normalizedRow: NormalizedMatchStat = {
      entryKey: row.entryKey,
      competitionTeamId: row.teamId,
      playerId: row.playerId ?? null,
      playerName: normalizedName,
      goals,
      yellowCards,
      redCards,
      isMvp
    };

    if (normalizedRow.playerId || hasStats || isMvp) {
      stats.push(normalizedRow);
    }

    if (isMvp) {
      mvpRow = normalizedRow;
    }
  }

  if (mvpKey && !mvpRow) {
    throw new Error("La figura seleccionada no existe en el acta enviada.");
  }

  return {
    stats,
    mvpRow
  };
}

async function resolveCompetitionPlayersMap(params: {
  supabase: DbClient;
  playerIds: string[];
}) {
  const { supabase, playerIds } = params;
  if (!playerIds.length) {
    return new Map<string, { id: string; competition_team_id: string; full_name: string }>();
  }

  const { data, error } = await supabase
    .from("competition_team_players")
    .select("id, competition_team_id, full_name")
    .in("id", playerIds);

  if (error) {
    throw new Error(`No se pudieron leer los jugadores de la competencia: ${error.message}`);
  }

  return new Map((data ?? []).map((row) => [String(row.id), row]));
}

export async function generateCompetitionFixture(params: {
  supabase: DbClient;
  adminId: string;
  competitionId?: string;
  tournamentId?: string;
}) {
  const { supabase, adminId } = params;
  const competitionId = params.competitionId ?? params.tournamentId;
  if (!competitionId) {
    throw new Error("Falta la competencia a procesar.");
  }
  await ensureCompetitionExists(supabase, competitionId);

  const [teams, { count: matchesCount, error: matchesError }] = await Promise.all([
    loadCompetitionTeams(supabase, competitionId),
    supabase
      .from("competition_matches")
      .select("id", { count: "exact", head: true })
      .eq("competition_id", competitionId)
  ]);

  if (matchesError) throw new Error(`No se pudo verificar el fixture actual: ${matchesError.message}`);
  if ((matchesCount ?? 0) > 0) {
    throw new Error("El fixture automático solo se puede generar cuando la competencia aún no tiene partidos.");
  }
  if (teams.length < 2) {
    throw new Error("Necesitas al menos 2 equipos inscriptos para generar el fixture.");
  }

  const generated = generateRoundRobinFixture(
    teams.map((team) => ({
      id: team.id,
      name: team.display_name
    }))
  );

  const { data: insertedRounds, error: roundsError } = await supabase
    .from("competition_rounds")
    .insert(
      generated.map((round) => ({
        competition_id: competitionId,
        round_number: round.roundNumber,
        name: round.name
      }))
    )
    .select("id, round_number");

  if (roundsError) {
    throw new Error(`No se pudieron crear las fechas de la competencia: ${roundsError.message}`);
  }

  const roundIdByNumber = new Map((insertedRounds ?? []).map((round) => [Number(round.round_number), String(round.id)]));
  const matchRows = generated.flatMap((round) =>
    round.matches.map((match) => ({
      competition_id: competitionId,
      round_id: roundIdByNumber.get(round.roundNumber) ?? null,
      home_team_id: match.homeTeamId,
      away_team_id: match.awayTeamId,
      scheduled_at: null,
      venue: null,
      status: "draft",
      created_by: adminId
    }))
  );

  const { error: matchesInsertError } = await supabase.from("competition_matches").insert(matchRows);
  if (matchesInsertError) {
    throw new Error(`No se pudieron crear los partidos del fixture: ${matchesInsertError.message}`);
  }
}

export async function validateCompetitionMatchPair(params: {
  supabase: DbClient;
  competitionId?: string;
  tournamentId?: string;
  homeTeamId: string;
  awayTeamId: string;
  ignoreMatchId?: string;
}) {
  const { supabase, homeTeamId, awayTeamId, ignoreMatchId } = params;
  const competitionId = params.competitionId ?? params.tournamentId;
  if (!competitionId) {
    throw new Error("Falta la competencia a validar.");
  }

  if (homeTeamId === awayTeamId) {
    throw new Error("El equipo local y el visitante deben ser distintos.");
  }

  const teams = await loadCompetitionTeams(supabase, competitionId);
  const teamIds = new Set(teams.map((team) => team.id));
  if (!teamIds.has(homeTeamId) || !teamIds.has(awayTeamId)) {
    throw new Error("Los equipos seleccionados no pertenecen a esta competencia.");
  }

  const { data: existingMatches, error } = await supabase
    .from("competition_matches")
    .select("id, home_team_id, away_team_id")
    .eq("competition_id", competitionId);

  if (error) {
    throw new Error(`No se pudo validar el cruce seleccionado: ${error.message}`);
  }

  const duplicated = (existingMatches ?? []).find((match) => {
    if (ignoreMatchId && String(match.id) === ignoreMatchId) return false;
    const pair = uniqueValues([String(match.home_team_id), String(match.away_team_id)]).sort().join(":");
    const candidatePair = uniqueValues([homeTeamId, awayTeamId]).sort().join(":");
    return pair === candidatePair;
  });

  if (duplicated) {
    throw new Error("Ese cruce ya existe dentro de la competencia.");
  }
}

export async function saveCompetitionMatchSheet(params: {
  supabase: DbClient;
  adminId: string;
  competitionId?: string;
  tournamentId?: string;
  matchId: string;
  input: TournamentMatchSheetInput;
}) {
  const { supabase, matchId, input } = params;
  const competitionId = params.competitionId ?? params.tournamentId;
  if (!competitionId) {
    throw new Error("Falta la competencia a procesar.");
  }
  const match = await assertMatchBelongsToCompetition({ supabase, competitionId, matchId });

  if (input.homeScore < 0 || input.awayScore < 0) {
    throw new Error("El marcador no puede tener goles negativos.");
  }

  const { stats, mvpRow } = normalizeCompetitionMatchStats(input);
  const allowedTeamIds = new Set([match.home_team_id, match.away_team_id]);

  for (const row of stats) {
    if (!allowedTeamIds.has(row.competitionTeamId)) {
      throw new Error("El acta contiene filas asignadas a equipos que no juegan este partido.");
    }
  }

  const playerIds = uniqueValues(stats.map((row) => row.playerId).filter((value): value is string => Boolean(value)));
  const playersById = await resolveCompetitionPlayersMap({
    supabase,
    playerIds
  });

  for (const row of stats) {
    if (!row.playerId) continue;
    const player = playersById.get(row.playerId);
    if (!player) {
      throw new Error("El acta referencia jugadores que no pertenecen a esta competencia.");
    }
    if (String(player.competition_team_id) !== row.competitionTeamId) {
      throw new Error("El acta referencia un jugador en un equipo distinto al de su plantel.");
    }
  }

  const { error: resultError } = await supabase.from("competition_match_results").upsert(
    {
      match_id: matchId,
      home_score: input.homeScore,
      away_score: input.awayScore,
      mvp_player_id: mvpRow?.playerId ?? null,
      mvp_player_name: mvpRow?.playerName || null,
      notes: input.notes?.trim() || null
    },
    { onConflict: "match_id" }
  );

  if (resultError) {
    throw new Error(`No se pudo guardar el resultado del partido: ${resultError.message}`);
  }

  const { error: deleteStatsError } = await supabase
    .from("competition_match_player_stats")
    .delete()
    .eq("match_id", matchId);

  if (deleteStatsError) {
    throw new Error(`No se pudo limpiar el acta anterior: ${deleteStatsError.message}`);
  }

  if (stats.length) {
    const { error: insertStatsError } = await supabase.from("competition_match_player_stats").insert(
      stats.map((row) => ({
        match_id: matchId,
        team_id: row.competitionTeamId,
        player_id: row.playerId,
        player_name: row.playerName,
        goals: row.goals,
        yellow_cards: row.yellowCards,
        red_cards: row.redCards,
        is_mvp: row.isMvp
      }))
    );

    if (insertStatsError) {
      throw new Error(`No se pudo guardar el acta del partido: ${insertStatsError.message}`);
    }
  }

  const { error: updateMatchError } = await supabase
    .from("competition_matches")
    .update({
      status: "played"
    })
    .eq("id", matchId)
    .eq("competition_id", competitionId);

  if (updateMatchError) {
    throw new Error(`No se pudo actualizar el estado del partido: ${updateMatchError.message}`);
  }
}

export const generateTournamentFixture = generateCompetitionFixture;
export const validateTournamentMatchPair = validateCompetitionMatchPair;
export const saveTournamentMatchSheet = saveCompetitionMatchSheet;
