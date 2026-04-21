import { generateRoundRobinFixture } from "@/lib/domain/tournament-fixture";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TournamentMatchSheetInput } from "@/types/domain";

type DbClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type TournamentTeamRow = {
  id: string;
  tournament_id: string;
  name: string;
  short_name: string | null;
  display_order: number;
};

type TournamentMatchRow = {
  id: string;
  tournament_id: string;
  home_team_id: string;
  away_team_id: string;
  status: string;
};

function uniqueValues(values: string[]) {
  return Array.from(new Set(values));
}

async function ensureTournamentExists(supabase: DbClient, tournamentId: string) {
  const { data, error } = await supabase.from("tournaments").select("id").eq("id", tournamentId).maybeSingle();
  if (error || !data) {
    throw new Error("No se encontro el torneo seleccionado.");
  }
}

async function loadTournamentTeams(supabase: DbClient, tournamentId: string) {
  const { data, error } = await supabase
    .from("tournament_teams")
    .select("id, tournament_id, name, short_name, display_order")
    .eq("tournament_id", tournamentId)
    .order("display_order", { ascending: true });

  if (error) throw new Error(`No se pudieron leer los equipos del torneo: ${error.message}`);
  return (data ?? []) as TournamentTeamRow[];
}

async function assertMatchBelongsToTournament(params: {
  supabase: DbClient;
  tournamentId: string;
  matchId: string;
}) {
  const { supabase, tournamentId, matchId } = params;
  const { data, error } = await supabase
    .from("tournament_matches")
    .select("id, tournament_id, home_team_id, away_team_id, status")
    .eq("id", matchId)
    .eq("tournament_id", tournamentId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("No se encontro el partido dentro del torneo seleccionado.");
  }

  return data as TournamentMatchRow;
}

export async function generateTournamentFixture(params: {
  supabase: DbClient;
  adminId: string;
  tournamentId: string;
}) {
  const { supabase, adminId, tournamentId } = params;
  await ensureTournamentExists(supabase, tournamentId);

  const [teams, { count: matchesCount, error: matchesError }] = await Promise.all([
    loadTournamentTeams(supabase, tournamentId),
    supabase.from("tournament_matches").select("id", { count: "exact", head: true }).eq("tournament_id", tournamentId)
  ]);

  if (matchesError) throw new Error(`No se pudo verificar el fixture actual: ${matchesError.message}`);
  if ((matchesCount ?? 0) > 0) {
    throw new Error("El fixture automatico solo se puede generar cuando el torneo aun no tiene partidos.");
  }
  if (teams.length < 2) {
    throw new Error("Necesitas al menos 2 equipos para generar el fixture.");
  }

  const generated = generateRoundRobinFixture(
    teams.map((team) => ({
      id: team.id,
      name: team.name
    }))
  );

  const { data: insertedRounds, error: roundsError } = await supabase
    .from("tournament_rounds")
    .insert(
      generated.map((round) => ({
        tournament_id: tournamentId,
        round_number: round.roundNumber,
        name: round.name
      }))
    )
    .select("id, round_number");

  if (roundsError) {
    throw new Error(`No se pudieron crear las fechas del torneo: ${roundsError.message}`);
  }

  const roundIdByNumber = new Map((insertedRounds ?? []).map((round) => [round.round_number, round.id]));
  const matchRows = generated.flatMap((round) =>
    round.matches.map((match) => ({
      tournament_id: tournamentId,
      round_id: roundIdByNumber.get(round.roundNumber) ?? null,
      home_team_id: match.homeTeamId,
      away_team_id: match.awayTeamId,
      scheduled_at: null,
      venue: null,
      status: "draft",
      created_by: adminId
    }))
  );

  const { error: matchesInsertError } = await supabase.from("tournament_matches").insert(matchRows);
  if (matchesInsertError) {
    throw new Error(`No se pudieron crear los partidos del fixture: ${matchesInsertError.message}`);
  }
}

export async function validateTournamentMatchPair(params: {
  supabase: DbClient;
  tournamentId: string;
  homeTeamId: string;
  awayTeamId: string;
  ignoreMatchId?: string;
}) {
  const { supabase, tournamentId, homeTeamId, awayTeamId, ignoreMatchId } = params;

  if (homeTeamId === awayTeamId) {
    throw new Error("El equipo local y el visitante deben ser distintos.");
  }

  const teams = await loadTournamentTeams(supabase, tournamentId);
  const teamIds = new Set(teams.map((team) => team.id));
  if (!teamIds.has(homeTeamId) || !teamIds.has(awayTeamId)) {
    throw new Error("Los equipos seleccionados no pertenecen a este torneo.");
  }

  const { data: existingMatches, error } = await supabase
    .from("tournament_matches")
    .select("id, home_team_id, away_team_id")
    .eq("tournament_id", tournamentId);

  if (error) {
    throw new Error(`No se pudo validar el cruce seleccionado: ${error.message}`);
  }

  const duplicated = (existingMatches ?? []).find((match) => {
    if (ignoreMatchId && match.id === ignoreMatchId) return false;
    const pair = uniqueValues([match.home_team_id, match.away_team_id]).sort().join(":");
    const candidatePair = uniqueValues([homeTeamId, awayTeamId]).sort().join(":");
    return pair === candidatePair;
  });

  if (duplicated) {
    throw new Error("Ese cruce ya existe dentro del torneo.");
  }
}

type NormalizedTournamentMatchStat = {
  entryKey: string;
  teamId: string;
  playerId: string | null;
  playerName: string;
  goals: number;
  yellowCards: number;
  redCards: number;
  isMvp: boolean;
};

function normalizeTournamentMatchStats(input: TournamentMatchSheetInput) {
  const stats: NormalizedTournamentMatchStat[] = [];

  for (const row of input.stats) {
    const normalizedName = row.playerName.trim();
    const goals = Math.max(0, Math.floor(row.goals));
    const yellowCards = Math.max(0, Math.floor(row.yellowCards));
    const redCards = Math.max(0, Math.floor(row.redCards));

    if (!row.playerId && !normalizedName) {
      throw new Error("Cada fila del acta debe tener un jugador del plantel o un nombre cargado.");
    }

    if (!row.teamId.trim()) {
      throw new Error("Cada fila del acta debe pertenecer a un equipo.");
    }

    if (!normalizedName) {
      throw new Error("Falta el nombre snapshot de una fila del acta.");
    }

    stats.push({
      entryKey: row.entryKey,
      teamId: row.teamId,
      playerId: row.playerId ?? null,
      playerName: normalizedName,
      goals,
      yellowCards,
      redCards,
      isMvp: false
    });
  }

  if (!stats.length) {
    throw new Error("Debes cargar al menos una fila en el acta del partido.");
  }

  const mvpKey = input.mvpEntryKey?.trim();
  if (!mvpKey) {
    throw new Error("Debes seleccionar la figura del partido.");
  }

  const mvpRow = stats.find((row) => row.entryKey === mvpKey);
  if (!mvpRow) {
    throw new Error("La figura del partido seleccionada no existe en el acta.");
  }
  mvpRow.isMvp = true;

  return {
    stats,
    mvpRow
  };
}

async function resolveTournamentPlayersMap(params: {
  supabase: DbClient;
  tournamentId: string;
  playerIds: string[];
}) {
  const { supabase, tournamentId, playerIds } = params;
  if (!playerIds.length) return new Map<string, { id: string; team_id: string; full_name: string }>();

  const { data, error } = await supabase
    .from("tournament_players")
    .select("id, team_id, full_name")
    .eq("tournament_id", tournamentId)
    .in("id", playerIds);

  if (error) {
    throw new Error(`No se pudieron leer los jugadores del torneo: ${error.message}`);
  }

  return new Map((data ?? []).map((row) => [row.id, row]));
}

export async function saveTournamentMatchSheet(params: {
  supabase: DbClient;
  adminId: string;
  tournamentId: string;
  matchId: string;
  input: TournamentMatchSheetInput;
}) {
  const { supabase, adminId, tournamentId, matchId, input } = params;
  const match = await assertMatchBelongsToTournament({ supabase, tournamentId, matchId });

  if (input.homeScore < 0 || input.awayScore < 0) {
    throw new Error("El marcador no puede tener goles negativos.");
  }

  const { stats, mvpRow } = normalizeTournamentMatchStats(input);
  const allowedTeamIds = new Set([match.home_team_id, match.away_team_id]);

  for (const row of stats) {
    if (!allowedTeamIds.has(row.teamId)) {
      throw new Error("El acta contiene filas asignadas a equipos que no juegan este partido.");
    }
  }

  const playerIds = uniqueValues(stats.map((row) => row.playerId).filter((value): value is string => Boolean(value)));
  const playersById = await resolveTournamentPlayersMap({
    supabase,
    tournamentId,
    playerIds
  });

  for (const row of stats) {
    if (!row.playerId) continue;
    const player = playersById.get(row.playerId);
    if (!player) {
      throw new Error("El acta referencia jugadores que no pertenecen a este torneo.");
    }
    if (player.team_id !== row.teamId) {
      throw new Error("El acta referencia un jugador en un equipo distinto al de su plantel.");
    }
  }

  const { error: resultError } = await supabase.from("tournament_match_results").upsert(
    {
      match_id: matchId,
      home_score: input.homeScore,
      away_score: input.awayScore,
      mvp_player_id: mvpRow.playerId,
      mvp_player_name: mvpRow.playerName,
      notes: input.notes?.trim() || null,
      created_by: adminId
    },
    { onConflict: "match_id" }
  );

  if (resultError) {
    throw new Error(`No se pudo guardar el resultado del partido: ${resultError.message}`);
  }

  const { error: deleteStatsError } = await supabase
    .from("tournament_match_player_stats")
    .delete()
    .eq("match_id", matchId);

  if (deleteStatsError) {
    throw new Error(`No se pudo limpiar el acta anterior: ${deleteStatsError.message}`);
  }

  const { error: insertStatsError } = await supabase.from("tournament_match_player_stats").insert(
    stats.map((row) => ({
      match_id: matchId,
      team_id: row.teamId,
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

  const { error: updateMatchError } = await supabase
    .from("tournament_matches")
    .update({
      status: "played"
    })
    .eq("id", matchId)
    .eq("tournament_id", tournamentId);

  if (updateMatchError) {
    throw new Error(`No se pudo actualizar el estado del partido: ${updateMatchError.message}`);
  }
}
