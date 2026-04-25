import {
  buildPlayoffPairingOrder,
  generateKnockoutStage,
  generateRoundRobinFixture,
  getKnockoutStageLabel,
  shuffleTournamentTeams,
  type GeneratedTournamentRound
} from "@/lib/domain/tournament-fixture";
import {
  buildTournamentStandings,
  type TournamentMatchReference,
  type TournamentMatchResultReference,
  type TournamentTeamReference
} from "@/lib/domain/tournament-stats";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  CompetitionCoverageMode,
  CompetitionPhase,
  CompetitionType,
  TournamentMatchSheetInput
} from "@/types/domain";

type DbClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type CompetitionRecord = {
  id: string;
  league_id: string;
  type: CompetitionType;
  coverage_mode: CompetitionCoverageMode;
  playoff_size: number | null;
  status: string;
};

type CompetitionTeamRow = {
  id: string;
  competition_id: string;
  display_name: string;
  short_name: string | null;
  display_order: number;
};

type CompetitionRoundRow = {
  id: string;
  competition_id: string;
  round_number: number;
  name: string;
  phase: CompetitionPhase;
  stage_label: string | null;
};

type CompetitionByeRow = {
  id: string;
  competition_id: string;
  round_id: string;
  competition_team_id: string;
  phase: CompetitionPhase;
  kind: "free_round" | "advance";
};

type CompetitionMatchRow = {
  id: string;
  competition_id: string;
  round_id: string | null;
  home_team_id: string;
  away_team_id: string;
  phase: CompetitionPhase;
  stage_label: string | null;
  scheduled_at: string | null;
  venue: string | null;
  status: string;
};

type CompetitionMatchResultRow = {
  match_id: string;
  home_score: number;
  away_score: number;
  penalty_home_score: number | null;
  penalty_away_score: number | null;
  winner_team_id: string | null;
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

function normalizePlayoffSize(value: number | null) {
  return value === 4 || value === 8 ? value : null;
}

async function loadCompetitionRecord(supabase: DbClient, competitionId: string) {
  const { data, error } = await supabase
    .from("competitions")
    .select("id, league_id, type, coverage_mode, playoff_size, status")
    .eq("id", competitionId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("No se encontro la competencia seleccionada.");
  }

  return data as CompetitionRecord;
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

async function loadCompetitionRounds(supabase: DbClient, competitionId: string) {
  const { data, error } = await supabase
    .from("competition_rounds")
    .select("id, competition_id, round_number, name, phase, stage_label")
    .eq("competition_id", competitionId)
    .order("round_number", { ascending: true });

  if (error) throw new Error(`No se pudieron leer las fechas de la competencia: ${error.message}`);
  return (data ?? []) as CompetitionRoundRow[];
}

async function loadCompetitionByes(supabase: DbClient, competitionId: string) {
  const { data, error } = await supabase
    .from("competition_byes")
    .select("id, competition_id, round_id, competition_team_id, phase, kind")
    .eq("competition_id", competitionId);

  if (error) throw new Error(`No se pudieron leer los descansos del fixture: ${error.message}`);
  return (data ?? []) as CompetitionByeRow[];
}

async function loadCompetitionMatches(supabase: DbClient, competitionId: string) {
  const { data, error } = await supabase
    .from("competition_matches")
    .select("id, competition_id, round_id, home_team_id, away_team_id, phase, stage_label, scheduled_at, venue, status")
    .eq("competition_id", competitionId);

  if (error) throw new Error(`No se pudieron leer los partidos de la competencia: ${error.message}`);
  return (data ?? []) as CompetitionMatchRow[];
}

async function loadCompetitionMatchResults(supabase: DbClient, matchIds: string[]) {
  if (!matchIds.length) return [] as CompetitionMatchResultRow[];

  const { data, error } = await supabase
    .from("competition_match_results")
    .select("match_id, home_score, away_score, penalty_home_score, penalty_away_score, winner_team_id")
    .in("match_id", matchIds);

  if (error) throw new Error(`No se pudieron leer los resultados de la competencia: ${error.message}`);
  return (data ?? []) as CompetitionMatchResultRow[];
}

async function assertMatchBelongsToCompetition(params: {
  supabase: DbClient;
  competitionId: string;
  matchId: string;
}) {
  const { supabase, competitionId, matchId } = params;
  const { data, error } = await supabase
    .from("competition_matches")
    .select("id, competition_id, round_id, home_team_id, away_team_id, phase, stage_label, scheduled_at, venue, status")
    .eq("id", matchId)
    .eq("competition_id", competitionId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("No se encontro el partido dentro de la competencia seleccionada.");
  }

  return data as CompetitionMatchRow;
}

function normalizeCompetitionMatchStats(
  input: TournamentMatchSheetInput,
  allowDetailedStats: boolean
) {
  if (!allowDetailedStats) {
    return {
      stats: [] as NormalizedMatchStat[],
      mvpRow: null as NormalizedMatchStat | null
    };
  }

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

function buildTeamReferenceMap(teams: CompetitionTeamRow[]) {
  return new Map(
    teams.map((team) => [
      team.id,
      {
        id: team.id,
        name: team.display_name,
        short_name: team.short_name,
        display_order: Number(team.display_order)
      } satisfies TournamentTeamReference
    ])
  );
}

async function insertGeneratedRounds(params: {
  supabase: DbClient;
  competitionId: string;
  adminId: string;
  rounds: GeneratedTournamentRound[];
}) {
  const { supabase, competitionId, adminId, rounds } = params;
  if (!rounds.length) return;

  const { data: insertedRounds, error: roundsError } = await supabase
    .from("competition_rounds")
    .insert(
      rounds.map((round) => ({
        competition_id: competitionId,
        round_number: round.roundNumber,
        name: round.name,
        phase: round.phase,
        stage_label: round.stageLabel
      }))
    )
    .select("id, round_number");

  if (roundsError) {
    throw new Error(`No se pudieron crear las fechas de la competencia: ${roundsError.message}`);
  }

  const roundIdByNumber = new Map(
    (insertedRounds ?? []).map((round) => [Number(round.round_number), String(round.id)])
  );

  const matchRows = rounds.flatMap((round) =>
    round.matches.map((match) => ({
      competition_id: competitionId,
      round_id: roundIdByNumber.get(round.roundNumber) ?? null,
      home_team_id: match.homeTeamId,
      away_team_id: match.awayTeamId,
      phase: round.phase,
      stage_label: round.stageLabel,
      scheduled_at: null,
      venue: null,
      status: "draft",
      created_by: adminId
    }))
  );

  if (matchRows.length) {
    const { error: matchesInsertError } = await supabase.from("competition_matches").insert(matchRows);
    if (matchesInsertError) {
      throw new Error(`No se pudieron crear los partidos del fixture: ${matchesInsertError.message}`);
    }
  }

  const byeRows = rounds.flatMap((round) =>
    round.byes.map((bye) => ({
      competition_id: competitionId,
      round_id: roundIdByNumber.get(round.roundNumber),
      competition_team_id: bye.teamId,
      phase: round.phase,
      kind: bye.kind,
      note: bye.kind === "free_round" ? "Fecha libre" : "Pasa de ronda"
    }))
  );

  if (byeRows.length) {
    const { error: byesInsertError } = await supabase.from("competition_byes").insert(byeRows);
    if (byesInsertError) {
      throw new Error(`No se pudieron guardar los descansos del fixture: ${byesInsertError.message}`);
    }
  }
}

function prepareLeagueRounds(teams: CompetitionTeamRow[], startRoundNumber = 1) {
  const randomized = shuffleTournamentTeams(teams).map((team) => ({
    id: team.id,
    name: team.display_name
  }));

  return generateRoundRobinFixture(randomized, {
    phase: "league",
    startRoundNumber
  });
}

function prepareCupRound(teams: CompetitionTeamRow[], roundNumber: number, seeded = false) {
  const orderedTeams = seeded
    ? buildPlayoffPairingOrder(teams)
    : shuffleTournamentTeams(teams);

  return generateKnockoutStage(
    orderedTeams.map((team) => ({
      id: team.id,
      name: team.display_name
    })),
    {
      phase: "cup",
      roundNumber
    }
  );
}

function resolveKnockoutWinner(params: {
  match: CompetitionMatchRow;
  input: TournamentMatchSheetInput;
}) {
  const { match, input } = params;
  if (input.homeScore > input.awayScore) {
    return {
      winnerTeamId: match.home_team_id,
      penaltyHomeScore: null,
      penaltyAwayScore: null
    };
  }

  if (input.homeScore < input.awayScore) {
    return {
      winnerTeamId: match.away_team_id,
      penaltyHomeScore: null,
      penaltyAwayScore: null
    };
  }

  const penaltyHomeScore =
    input.penaltyHomeScore === undefined || input.penaltyHomeScore === null
      ? null
      : Math.max(0, Math.floor(input.penaltyHomeScore));
  const penaltyAwayScore =
    input.penaltyAwayScore === undefined || input.penaltyAwayScore === null
      ? null
      : Math.max(0, Math.floor(input.penaltyAwayScore));

  if (match.phase !== "cup") {
    return {
      winnerTeamId: null,
      penaltyHomeScore: null,
      penaltyAwayScore: null
    };
  }

  if (penaltyHomeScore === null || penaltyAwayScore === null) {
    throw new Error("Los cruces de copa empatados necesitan penales para cerrarse.");
  }

  if (penaltyHomeScore === penaltyAwayScore) {
    throw new Error("La definicion por penales no puede terminar empatada.");
  }

  return {
    winnerTeamId: penaltyHomeScore > penaltyAwayScore ? match.home_team_id : match.away_team_id,
    penaltyHomeScore,
    penaltyAwayScore
  };
}

async function maybeGenerateNextCupRound(params: {
  supabase: DbClient;
  adminId: string;
  competitionId: string;
  roundId: string | null;
}) {
  const { supabase, adminId, competitionId, roundId } = params;
  if (!roundId) return;

  const [rounds, byes, matches] = await Promise.all([
    loadCompetitionRounds(supabase, competitionId),
    loadCompetitionByes(supabase, competitionId),
    loadCompetitionMatches(supabase, competitionId)
  ]);
  const currentRound = rounds.find((round) => round.id === roundId) ?? null;
  if (!currentRound || currentRound.phase !== "cup") return;

  const currentRoundMatches = matches
    .filter((match) => match.round_id === roundId)
    .sort((left, right) => left.id.localeCompare(right.id));
  if (currentRoundMatches.some((match) => match.status !== "played")) {
    return;
  }

  const nextCupRoundExists = rounds.some(
    (round) => round.phase === "cup" && Number(round.round_number) > Number(currentRound.round_number)
  );
  if (nextCupRoundExists) return;

  const currentMatchResults = await loadCompetitionMatchResults(
    supabase,
    currentRoundMatches.map((match) => match.id)
  );
  const resultByMatchId = new Map(currentMatchResults.map((result) => [result.match_id, result]));
  const teamById = buildTeamReferenceMap(await loadCompetitionTeams(supabase, competitionId));

  const advancingTeamIds = [
    ...byes
      .filter((bye) => bye.round_id === roundId && bye.phase === "cup")
      .map((bye) => bye.competition_team_id),
    ...currentRoundMatches.map((match) => {
      const result = resultByMatchId.get(match.id);
      if (!result?.winner_team_id) {
        throw new Error("Cada cruce de copa jugado necesita un ganador definido.");
      }
      return result.winner_team_id;
    })
  ];

  if (advancingTeamIds.length <= 1) return;

  const nextTeams = advancingTeamIds
    .map((teamId) => teamById.get(teamId) ?? null)
    .filter((team): team is TournamentTeamReference => team !== null);

  const nextRound = generateKnockoutStage(
    nextTeams.map((team) => ({
      id: team.id,
      name: team.name
    })),
    {
      phase: "cup",
      roundNumber: Number(currentRound.round_number) + 1,
      stageLabel: getKnockoutStageLabel(nextTeams.length)
    }
  );

  await insertGeneratedRounds({
    supabase,
    competitionId,
    adminId,
    rounds: [nextRound]
  });
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

  const competition = await loadCompetitionRecord(supabase, competitionId);
  const [teams, matches, byes] = await Promise.all([
    loadCompetitionTeams(supabase, competitionId),
    loadCompetitionMatches(supabase, competitionId),
    loadCompetitionByes(supabase, competitionId)
  ]);

  if (matches.length > 0 || byes.length > 0) {
    throw new Error("El fixture automatico solo se puede generar cuando la competencia aun no tiene partidos.");
  }
  if (teams.length < 2) {
    throw new Error("Necesitas al menos 2 equipos inscriptos para generar el fixture.");
  }

  if (competition.type === "league") {
    await insertGeneratedRounds({
      supabase,
      competitionId,
      adminId,
      rounds: prepareLeagueRounds(teams)
    });
    return;
  }

  if (competition.type === "cup") {
    await insertGeneratedRounds({
      supabase,
      competitionId,
      adminId,
      rounds: [prepareCupRound(teams, 1, false)]
    });
    return;
  }

  await insertGeneratedRounds({
    supabase,
    competitionId,
    adminId,
    rounds: prepareLeagueRounds(teams)
  });
}

export async function generateCompetitionCupPlayoff(params: {
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

  const competition = await loadCompetitionRecord(supabase, competitionId);
  if (competition.type !== "league_and_cup") {
    throw new Error("Solo las competencias Liga + copa pueden generar playoff.");
  }

  const playoffSize = normalizePlayoffSize(competition.playoff_size);
  if (!playoffSize) {
    throw new Error("Define un playoff de 4 u 8 clasificados antes de generarlo.");
  }

  const [teams, rounds, matches] = await Promise.all([
    loadCompetitionTeams(supabase, competitionId),
    loadCompetitionRounds(supabase, competitionId),
    loadCompetitionMatches(supabase, competitionId)
  ]);
  const cupRounds = rounds.filter((round) => round.phase === "cup");
  if (cupRounds.length) {
    throw new Error("La copa de esta competencia ya fue generada.");
  }

  const leagueMatches = matches.filter((match) => match.phase === "league");
  if (!leagueMatches.length) {
    throw new Error("Primero debes generar y jugar la fase liga.");
  }
  if (leagueMatches.some((match) => match.status !== "played")) {
    throw new Error("La copa se habilita cuando todas las fechas de liga ya estan jugadas.");
  }

  const results = await loadCompetitionMatchResults(
    supabase,
    leagueMatches.map((match) => match.id)
  );
  const standings = buildTournamentStandings({
    teams: teams.map((team) => ({
      id: team.id,
      name: team.display_name,
      short_name: team.short_name,
      display_order: Number(team.display_order)
    })),
    matches: leagueMatches as TournamentMatchReference[],
    results: results as TournamentMatchResultReference[]
  });

  if (standings.length < playoffSize) {
    throw new Error(`La competencia necesita al menos ${playoffSize} equipos con fase liga completa.`);
  }

  const teamById = new Map(teams.map((team) => [team.id, team]));
  const seededTeams = standings
    .slice(0, playoffSize)
    .map((row) => teamById.get(row.teamId) ?? null)
    .filter((team): team is CompetitionTeamRow => team !== null);

  if (seededTeams.length < playoffSize) {
    throw new Error("No se pudieron resolver todos los clasificados al playoff.");
  }

  const nextRoundNumber = Math.max(0, ...rounds.map((round) => Number(round.round_number))) + 1;
  await insertGeneratedRounds({
    supabase,
    competitionId,
    adminId,
    rounds: [prepareCupRound(seededTeams, nextRoundNumber, true)]
  });
}

export async function validateCompetitionMatchPair(params: {
  supabase: DbClient;
  competitionId?: string;
  tournamentId?: string;
  homeTeamId: string;
  awayTeamId: string;
  phase?: CompetitionPhase;
  ignoreMatchId?: string;
}) {
  const { supabase, homeTeamId, awayTeamId, ignoreMatchId } = params;
  const phase = params.phase ?? "league";
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

  const existingMatches = await loadCompetitionMatches(supabase, competitionId);
  const duplicated = existingMatches.find((match) => {
    if (ignoreMatchId && String(match.id) === ignoreMatchId) return false;
    if ((match.phase ?? "league") !== phase) return false;
    const pair = uniqueValues([String(match.home_team_id), String(match.away_team_id)]).sort().join(":");
    const candidatePair = uniqueValues([homeTeamId, awayTeamId]).sort().join(":");
    return pair === candidatePair;
  });

  if (duplicated) {
    throw new Error("Ese cruce ya existe dentro de la misma fase de esta competencia.");
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
  const { supabase, adminId, matchId, input } = params;
  const competitionId = params.competitionId ?? params.tournamentId;
  if (!competitionId) {
    throw new Error("Falta la competencia a procesar.");
  }
  const competition = await loadCompetitionRecord(supabase, competitionId);
  const match = await assertMatchBelongsToCompetition({ supabase, competitionId, matchId });

  if (input.homeScore < 0 || input.awayScore < 0) {
    throw new Error("El marcador no puede tener goles negativos.");
  }

  const { stats, mvpRow } = normalizeCompetitionMatchStats(
    input,
    competition.coverage_mode !== "results_only"
  );
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

  const { winnerTeamId, penaltyHomeScore, penaltyAwayScore } = resolveKnockoutWinner({
    match,
    input
  });

  const { error: resultError } = await supabase.from("competition_match_results").upsert(
    {
      match_id: matchId,
      home_score: input.homeScore,
      away_score: input.awayScore,
      penalty_home_score: penaltyHomeScore,
      penalty_away_score: penaltyAwayScore,
      winner_team_id: winnerTeamId,
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

  await maybeGenerateNextCupRound({
    supabase,
    adminId,
    competitionId,
    roundId: match.round_id
  });
}

export const generateTournamentFixture = generateCompetitionFixture;
export const generateTournamentCupPlayoff = generateCompetitionCupPlayoff;
export const validateTournamentMatchPair = validateCompetitionMatchPair;
export const saveTournamentMatchSheet = saveCompetitionMatchSheet;
