import type {
  TournamentBestDefenseRow,
  TournamentFixtureRow,
  TournamentStandingRow,
  TournamentTopFigureRow,
  TournamentTopScorerRow
} from "@/types/domain";

export type TournamentTeamReference = {
  id: string;
  name: string;
  short_name: string | null;
  display_order: number;
  notes?: string | null;
};

export type TournamentRoundReference = {
  id: string;
  round_number: number;
  name: string;
  starts_at: string | null;
  ends_at: string | null;
};

export type TournamentMatchReference = {
  id: string;
  round_id: string | null;
  home_team_id: string;
  away_team_id: string;
  scheduled_at: string | null;
  venue: string | null;
  status: string;
};

export type TournamentMatchResultReference = {
  match_id: string;
  home_score: number;
  away_score: number;
  mvp_player_id: string | null;
  mvp_player_name: string | null;
  notes: string | null;
};

export type TournamentMatchPlayerStatReference = {
  match_id: string;
  team_id: string;
  player_id: string | null;
  player_name: string;
  goals: number;
  yellow_cards: number;
  red_cards: number;
  is_mvp: boolean;
};

type TeamAccumulator = TournamentStandingRow;

function buildTeamIndex(teams: TournamentTeamReference[]) {
  return new Map(teams.map((team) => [team.id, team]));
}

function compareMaybeDates(left: string | null, right: string | null) {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return new Date(left).getTime() - new Date(right).getTime();
}

function resolveTeamMeta(teamById: Map<string, TournamentTeamReference>, teamId: string) {
  const team = teamById.get(teamId);
  return {
    teamName: team?.name ?? "Equipo",
    teamShortName: team?.short_name ?? null
  };
}

export function buildTournamentStandings(params: {
  teams: TournamentTeamReference[];
  matches: TournamentMatchReference[];
  results: TournamentMatchResultReference[];
}) {
  const { teams, matches, results } = params;
  const resultByMatchId = new Map(results.map((result) => [result.match_id, result]));
  const standings = new Map<string, TeamAccumulator>();

  for (const team of teams) {
    standings.set(team.id, {
      teamId: team.id,
      teamName: team.name,
      shortName: team.short_name,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0
    });
  }

  for (const match of matches) {
    if (match.status !== "played") continue;

    const result = resultByMatchId.get(match.id);
    if (!result) continue;

    const homeRow = standings.get(match.home_team_id);
    const awayRow = standings.get(match.away_team_id);
    if (!homeRow || !awayRow) continue;

    homeRow.played += 1;
    awayRow.played += 1;
    homeRow.goalsFor += result.home_score;
    homeRow.goalsAgainst += result.away_score;
    awayRow.goalsFor += result.away_score;
    awayRow.goalsAgainst += result.home_score;

    if (result.home_score > result.away_score) {
      homeRow.wins += 1;
      awayRow.losses += 1;
      homeRow.points += 3;
    } else if (result.home_score < result.away_score) {
      awayRow.wins += 1;
      homeRow.losses += 1;
      awayRow.points += 3;
    } else {
      homeRow.draws += 1;
      awayRow.draws += 1;
      homeRow.points += 1;
      awayRow.points += 1;
    }
  }

  return [...standings.values()]
    .map((row) => ({
      ...row,
      goalDifference: row.goalsFor - row.goalsAgainst
    }))
    .sort((left, right) => {
      if (right.points !== left.points) return right.points - left.points;
      if (right.goalDifference !== left.goalDifference) return right.goalDifference - left.goalDifference;
      if (right.goalsFor !== left.goalsFor) return right.goalsFor - left.goalsFor;
      return left.teamName.localeCompare(right.teamName, "es");
    });
}

export function buildTournamentFixture(params: {
  teams: TournamentTeamReference[];
  rounds: TournamentRoundReference[];
  matches: TournamentMatchReference[];
  results: TournamentMatchResultReference[];
}) {
  const { teams, rounds, matches, results } = params;
  const teamById = buildTeamIndex(teams);
  const roundById = new Map(rounds.map((round) => [round.id, round]));
  const resultByMatchId = new Map(results.map((result) => [result.match_id, result]));

  return [...matches]
    .map<TournamentFixtureRow | null>((match) => {
      const homeTeam = teamById.get(match.home_team_id);
      const awayTeam = teamById.get(match.away_team_id);
      if (!homeTeam || !awayTeam) return null;

      const round = match.round_id ? roundById.get(match.round_id) ?? null : null;
      const result = resultByMatchId.get(match.id) ?? null;

      return {
        id: match.id,
        roundId: round?.id ?? null,
        roundNumber: round?.round_number ?? 9999,
        roundName: round?.name ?? "Partido suelto",
        scheduledAt: match.scheduled_at,
        venue: match.venue,
        status: match.status as TournamentFixtureRow["status"],
        homeTeamId: homeTeam.id,
        homeTeamName: homeTeam.name,
        homeTeamShortName: homeTeam.short_name,
        awayTeamId: awayTeam.id,
        awayTeamName: awayTeam.name,
        awayTeamShortName: awayTeam.short_name,
        homeScore: result?.home_score ?? null,
        awayScore: result?.away_score ?? null
      };
    })
    .filter((row): row is TournamentFixtureRow => row !== null)
    .sort((left, right) => {
      if (left.roundNumber !== right.roundNumber) return left.roundNumber - right.roundNumber;
      const scheduleDiff = compareMaybeDates(left.scheduledAt, right.scheduledAt);
      if (scheduleDiff !== 0) return scheduleDiff;
      return left.homeTeamName.localeCompare(right.homeTeamName, "es");
    });
}

export function buildTournamentTopScorers(params: {
  teams: TournamentTeamReference[];
  playerStats: TournamentMatchPlayerStatReference[];
}) {
  const { teams, playerStats } = params;
  const teamById = buildTeamIndex(teams);
  const scorers = new Map<
    string,
    TournamentTopScorerRow & {
      yellowCards: number;
      redCards: number;
    }
  >();

  for (const row of playerStats) {
    if (row.goals <= 0) continue;

    const key = `${row.team_id}:${row.player_id ?? row.player_name.trim().toLowerCase()}`;
    const teamMeta = resolveTeamMeta(teamById, row.team_id);
    const current =
      scorers.get(key) ??
      {
        playerId: row.player_id,
        playerName: row.player_name,
        goals: 0,
        teamId: row.team_id,
        teamName: teamMeta.teamName,
        teamShortName: teamMeta.teamShortName,
        yellowCards: 0,
        redCards: 0
      };

    current.goals += row.goals;
    current.yellowCards += row.yellow_cards;
    current.redCards += row.red_cards;
    scorers.set(key, current);
  }

  return [...scorers.values()]
    .sort((left, right) => {
      if (right.goals !== left.goals) return right.goals - left.goals;
      return left.playerName.localeCompare(right.playerName, "es");
    })
    .map<TournamentTopScorerRow>(({ playerId, playerName, goals, teamId, teamName, teamShortName }) => ({
      playerId,
      playerName,
      goals,
      teamId,
      teamName,
      teamShortName
    }));
}

export function buildTournamentTopFigures(params: {
  teams: TournamentTeamReference[];
  playerStats: TournamentMatchPlayerStatReference[];
}) {
  const { teams, playerStats } = params;
  const teamById = buildTeamIndex(teams);
  const mvps = new Map<string, TournamentTopFigureRow>();

  for (const row of playerStats) {
    if (!row.is_mvp) continue;

    const key = `${row.team_id}:${row.player_id ?? row.player_name.trim().toLowerCase()}`;
    const teamMeta = resolveTeamMeta(teamById, row.team_id);
    const current =
      mvps.get(key) ??
      {
        playerId: row.player_id,
        playerName: row.player_name,
        teamId: row.team_id,
        teamName: teamMeta.teamName,
        teamShortName: teamMeta.teamShortName,
        mvpCount: 0
      };

    current.mvpCount += 1;
    mvps.set(key, current);
  }

  return [...mvps.values()].sort((left, right) => {
    if (right.mvpCount !== left.mvpCount) return right.mvpCount - left.mvpCount;
    return left.playerName.localeCompare(right.playerName, "es");
  });
}

export function buildTournamentBestDefense(params: {
  teams: TournamentTeamReference[];
  matches: TournamentMatchReference[];
  results: TournamentMatchResultReference[];
}) {
  const { teams, matches, results } = params;
  const standings = buildTournamentStandings({ teams, matches, results });

  return standings
    .filter((row) => row.played > 0)
    .map<TournamentBestDefenseRow>((row) => ({
      teamId: row.teamId,
      teamName: row.teamName,
      teamShortName: row.shortName,
      goalsAgainst: row.goalsAgainst,
      matchesPlayed: row.played
    }))
    .sort((left, right) => {
      if (left.goalsAgainst !== right.goalsAgainst) return left.goalsAgainst - right.goalsAgainst;
      if (right.matchesPlayed !== left.matchesPlayed) return right.matchesPlayed - left.matchesPlayed;
      return left.teamName.localeCompare(right.teamName, "es");
    });
}
