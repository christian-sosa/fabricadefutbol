export type ClubStatus = "draft" | "active" | "archived";
export type ClubMatchStatus = "draft" | "played" | "cancelled";
export type ClubLineupRole = "starter" | "substitute";

export type ClubRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  home_venue: string | null;
  is_public: boolean;
  status: ClubStatus;
  created_at: string;
};

export type ClubPlayerRecord = {
  id: string;
  club_id: string;
  full_name: string;
  nickname: string | null;
  position: string | null;
  shirt_number: number | null;
  photo_path: string | null;
  active: boolean;
};

export type ClubCompetitionRecord = {
  id: string;
  club_id: string;
  name: string;
  slug: string;
  active: boolean;
  notes: string | null;
};

export type ClubTeamRecord = {
  id: string;
  club_id: string;
  name: string;
  short_name: string | null;
  logo_path: string | null;
  active: boolean;
};

export type ClubTeamPlayerRecord = {
  id: string;
  club_team_id: string;
  club_player_id: string;
};

export type ClubMatchRecord = {
  id: string;
  club_id: string;
  club_team_id: string;
  club_competition_id: string | null;
  played_at: string;
  opponent_name: string;
  venue: string | null;
  goals_for: number;
  goals_against: number;
  status: ClubMatchStatus;
  notes: string | null;
};

export type ClubLineupRecord = {
  id: string;
  match_id: string;
  club_player_id: string | null;
  guest_name: string | null;
  display_name: string;
  role: ClubLineupRole;
};

export type ClubMatchPlayerStatRecord = {
  id: string;
  match_id: string;
  lineup_id: string;
  goals: number;
  assists: number;
  is_mvp: boolean;
};

export type ClubPublicSummary = {
  clubName: string;
  teamCount: number;
  playerCount: number;
  playedMatches: number;
  goalsFor: number;
  goalsAgainst: number;
};

export type ClubPublicTeam = {
  id: string;
  name: string;
  shortName: string | null;
  playerCount: number;
  matchesPlayed: number;
};

export type ClubPublicMatch = {
  id: string;
  playedAt: string;
  teamId: string;
  teamName: string;
  competitionId: string | null;
  competitionName: string;
  opponentName: string;
  venue: string | null;
  goalsFor: number;
  goalsAgainst: number;
};

export type ClubPublicStatRow = {
  name: string;
  teamName: string;
  value: number;
};

export type ClubPublicCompetitionStat = {
  id: string | null;
  name: string;
  matchesPlayed: number;
  goalsFor: number;
  goalsAgainst: number;
  topScorers: ClubPublicStatRow[];
  topAssisters: ClubPublicStatRow[];
  topFigures: ClubPublicStatRow[];
};

export type ClubPublicSnapshot = {
  summary: ClubPublicSummary;
  teams: ClubPublicTeam[];
  recentMatches: ClubPublicMatch[];
  topScorers: ClubPublicStatRow[];
  topAssisters: ClubPublicStatRow[];
  topFigures: ClubPublicStatRow[];
  competitionStats: ClubPublicCompetitionStat[];
};

export type ClubMatchSheetParticipantInput = {
  playerId?: string | null;
  guestName?: string | null;
  role: ClubLineupRole;
  goals: number;
  assists: number;
  isMvp?: boolean;
};

export type ClubMatchSheetInput = {
  goalsFor: number;
  goalsAgainst: number;
  participants: ClubMatchSheetParticipantInput[];
};

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function compareByValueThenName(left: ClubPublicStatRow, right: ClubPublicStatRow) {
  if (right.value !== left.value) return right.value - left.value;
  return left.name.localeCompare(right.name, "es");
}

function createStatAccumulator() {
  return new Map<string, ClubPublicStatRow>();
}

function toTopRows(accumulator: Map<string, ClubPublicStatRow>) {
  return Array.from(accumulator.values()).sort(compareByValueThenName).slice(0, 10);
}

function addStatValue(params: {
  accumulator: Map<string, ClubPublicStatRow>;
  name: string;
  teamName: string;
  value: number;
}) {
  if (params.value <= 0) return;
  const key = `${normalizeKey(params.name)}::${normalizeKey(params.teamName)}`;
  const existing = params.accumulator.get(key);
  if (existing) {
    existing.value += params.value;
    return;
  }

  params.accumulator.set(key, {
    name: params.name,
    teamName: params.teamName,
    value: params.value
  });
}

export function validateClubMatchSheet(input: ClubMatchSheetInput) {
  const errors: string[] = [];
  const starters = input.participants.filter((participant) => participant.role === "starter");
  const duplicatePlayerIds = new Set<string>();
  const seenPlayerIds = new Set<string>();
  let goalsTotal = 0;
  let assistsTotal = 0;
  let mvpTotal = 0;

  if (!Number.isInteger(input.goalsFor) || input.goalsFor < 0) {
    errors.push("Los goles a favor deben ser un numero entero mayor o igual a 0.");
  }

  if (!Number.isInteger(input.goalsAgainst) || input.goalsAgainst < 0) {
    errors.push("Los goles en contra deben ser un numero entero mayor o igual a 0.");
  }

  if (starters.length !== 11) {
    errors.push("El partido debe tener exactamente 11 titulares.");
  }

  for (const participant of input.participants) {
    const playerId = participant.playerId?.trim() || null;
    const guestName = participant.guestName?.trim() || null;

    if (!playerId && !guestName) {
      errors.push("Cada participante debe ser un jugador del club o un invitado.");
    }

    if (playerId && guestName) {
      errors.push("Un participante no puede ser jugador del club e invitado a la vez.");
    }

    if (playerId) {
      if (seenPlayerIds.has(playerId)) {
        duplicatePlayerIds.add(playerId);
      }
      seenPlayerIds.add(playerId);
    }

    if (!Number.isInteger(participant.goals) || participant.goals < 0) {
      errors.push("Los goles de cada participante deben ser enteros mayores o iguales a 0.");
    }

    if (!Number.isInteger(participant.assists) || participant.assists < 0) {
      errors.push("Las asistencias de cada participante deben ser enteros mayores o iguales a 0.");
    }

    goalsTotal += Math.max(0, participant.goals);
    assistsTotal += Math.max(0, participant.assists);
    if (participant.isMvp) mvpTotal += 1;
  }

  if (duplicatePlayerIds.size > 0) {
    errors.push("Un jugador del club no puede cargarse dos veces en el mismo partido.");
  }

  if (goalsTotal > input.goalsFor) {
    errors.push("La suma de goleadores no puede superar los goles a favor.");
  }

  if (assistsTotal > input.goalsFor) {
    errors.push("La suma de asistencias no puede superar los goles a favor.");
  }

  if (mvpTotal > 1) {
    errors.push("Solo puede haber una figura por partido.");
  }

  return errors;
}

export function buildClubPublicSnapshot(params: {
  club: ClubRecord;
  players: ClubPlayerRecord[];
  competitions: ClubCompetitionRecord[];
  teams: ClubTeamRecord[];
  teamPlayers: ClubTeamPlayerRecord[];
  matches: ClubMatchRecord[];
  lineups: ClubLineupRecord[];
  stats: ClubMatchPlayerStatRecord[];
}): ClubPublicSnapshot {
  const activeTeams = params.teams.filter((team) => team.active);
  const activePlayers = params.players.filter((player) => player.active);
  const competitionsById = new Map(params.competitions.map((competition) => [competition.id, competition]));
  const teamsById = new Map(params.teams.map((team) => [team.id, team]));
  const playedMatches = params.matches
    .filter((match) => match.status === "played")
    .sort((left, right) => new Date(right.played_at).getTime() - new Date(left.played_at).getTime());
  const playedMatchIds = new Set(playedMatches.map((match) => match.id));
  const playedMatchesByTeam = new Map<string, number>();

  for (const match of playedMatches) {
    playedMatchesByTeam.set(match.club_team_id, (playedMatchesByTeam.get(match.club_team_id) ?? 0) + 1);
  }

  const playerCountByTeam = new Map<string, number>();
  for (const teamPlayer of params.teamPlayers) {
    playerCountByTeam.set(
      teamPlayer.club_team_id,
      (playerCountByTeam.get(teamPlayer.club_team_id) ?? 0) + 1
    );
  }

  const lineupById = new Map(params.lineups.map((lineup) => [lineup.id, lineup]));
  const matchById = new Map(params.matches.map((match) => [match.id, match]));
  const scorers = createStatAccumulator();
  const assisters = createStatAccumulator();
  const figures = createStatAccumulator();
  const competitionStatsById = new Map<
    string,
    {
      id: string | null;
      name: string;
      matchesPlayed: number;
      goalsFor: number;
      goalsAgainst: number;
      scorers: Map<string, ClubPublicStatRow>;
      assisters: Map<string, ClubPublicStatRow>;
      figures: Map<string, ClubPublicStatRow>;
    }
  >();

  function getCompetitionAccumulator(match: ClubMatchRecord) {
    const competition = match.club_competition_id ? competitionsById.get(match.club_competition_id) ?? null : null;
    const key = competition?.id ?? "without-competition";
    const existing = competitionStatsById.get(key);
    if (existing) return existing;

    const created = {
      id: competition?.id ?? null,
      name: competition?.name ?? "Sin torneo",
      matchesPlayed: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      scorers: createStatAccumulator(),
      assisters: createStatAccumulator(),
      figures: createStatAccumulator()
    };
    competitionStatsById.set(key, created);
    return created;
  }

  for (const match of playedMatches) {
    const competitionStats = getCompetitionAccumulator(match);
    competitionStats.matchesPlayed += 1;
    competitionStats.goalsFor += Number(match.goals_for);
    competitionStats.goalsAgainst += Number(match.goals_against);
  }

  for (const stat of params.stats) {
    if (!playedMatchIds.has(stat.match_id)) continue;
    const lineup = lineupById.get(stat.lineup_id);
    const match = matchById.get(stat.match_id);
    if (!lineup || !match) continue;
    const teamName = teamsById.get(match.club_team_id)?.name ?? "Equipo";
    const competitionStats = getCompetitionAccumulator(match);

    addStatValue({
      accumulator: scorers,
      name: lineup.display_name,
      teamName,
      value: stat.goals
    });
    addStatValue({
      accumulator: competitionStats.scorers,
      name: lineup.display_name,
      teamName,
      value: stat.goals
    });
    addStatValue({
      accumulator: assisters,
      name: lineup.display_name,
      teamName,
      value: stat.assists
    });
    addStatValue({
      accumulator: competitionStats.assisters,
      name: lineup.display_name,
      teamName,
      value: stat.assists
    });
    addStatValue({
      accumulator: figures,
      name: lineup.display_name,
      teamName,
      value: stat.is_mvp ? 1 : 0
    });
    addStatValue({
      accumulator: competitionStats.figures,
      name: lineup.display_name,
      teamName,
      value: stat.is_mvp ? 1 : 0
    });
  }

  const summary: ClubPublicSummary = {
    clubName: params.club.name,
    teamCount: activeTeams.length,
    playerCount: activePlayers.length,
    playedMatches: playedMatches.length,
    goalsFor: playedMatches.reduce((total, match) => total + Number(match.goals_for), 0),
    goalsAgainst: playedMatches.reduce((total, match) => total + Number(match.goals_against), 0)
  };

  return {
    summary,
    teams: activeTeams
      .map((team) => ({
        id: team.id,
        name: team.name,
        shortName: team.short_name,
        playerCount: playerCountByTeam.get(team.id) ?? 0,
        matchesPlayed: playedMatchesByTeam.get(team.id) ?? 0
      }))
      .sort((left, right) => left.name.localeCompare(right.name, "es")),
    recentMatches: playedMatches.slice(0, 10).map((match) => ({
      id: match.id,
      playedAt: match.played_at,
      teamId: match.club_team_id,
      teamName: teamsById.get(match.club_team_id)?.name ?? "Equipo",
      competitionId: match.club_competition_id,
      competitionName: match.club_competition_id
        ? competitionsById.get(match.club_competition_id)?.name ?? "Torneo"
        : "Sin torneo",
      opponentName: match.opponent_name,
      venue: match.venue,
      goalsFor: Number(match.goals_for),
      goalsAgainst: Number(match.goals_against)
    })),
    topScorers: toTopRows(scorers),
    topAssisters: toTopRows(assisters),
    topFigures: toTopRows(figures),
    competitionStats: Array.from(competitionStatsById.values())
      .map((competition) => ({
        id: competition.id,
        name: competition.name,
        matchesPlayed: competition.matchesPlayed,
        goalsFor: competition.goalsFor,
        goalsAgainst: competition.goalsAgainst,
        topScorers: toTopRows(competition.scorers),
        topAssisters: toTopRows(competition.assisters),
        topFigures: toTopRows(competition.figures)
      }))
      .sort((left, right) => {
        if (right.matchesPlayed !== left.matchesPlayed) return right.matchesPlayed - left.matchesPlayed;
        return left.name.localeCompare(right.name, "es");
      })
  };
}
