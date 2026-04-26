import type { Database } from "@/types/database";
import type { PlayerComputedStats, TeamSide } from "@/types/domain";

type PlayerRow = Database["public"]["Tables"]["players"]["Row"];
type MatchRow = Database["public"]["Tables"]["matches"]["Row"];
type MatchResultRow = Database["public"]["Tables"]["match_result"]["Row"];
type MatchPlayerStatsRow = Database["public"]["Tables"]["match_player_stats"]["Row"];

export type MatchWithTeams = {
  match: MatchRow;
  result: MatchResultRow | null;
  teamAPlayerIds: string[];
  teamBPlayerIds: string[];
};

type InternalStats = {
  playerId: string;
  playerName: string;
  currentRating: number;
  initialRank: number;
  skillLevel: number;
  displayOrder: number;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  outcomes: ("W" | "D" | "L")[];
  goals: number;
  assists: number;
};

function pushOutcome(stats: InternalStats, outcome: "W" | "D" | "L") {
  stats.outcomes.push(outcome);
  if (outcome === "W") stats.wins += 1;
  if (outcome === "D") stats.draws += 1;
  if (outcome === "L") stats.losses += 1;
}

function outcomeByTeam(winner: MatchResultRow["winner_team"], team: TeamSide): "W" | "D" | "L" {
  if (winner === "DRAW") return "D";
  return winner === team ? "W" : "L";
}

function buildStreak(outcomes: ("W" | "D" | "L")[]) {
  if (!outcomes.length) return "-";
  const last = outcomes[outcomes.length - 1];
  let count = 0;
  for (let i = outcomes.length - 1; i >= 0; i -= 1) {
    if (outcomes[i] !== last) break;
    count += 1;
  }
  return `${last}${count}`;
}

export function calculatePlayerStats(params: {
  players: PlayerRow[];
  finishedMatches: MatchWithTeams[];
  matchPlayerStats?: MatchPlayerStatsRow[];
}): PlayerComputedStats[] {
  const { players, finishedMatches, matchPlayerStats = [] } = params;

  const statsByPlayer = new Map<string, InternalStats>(
    players.map((player) => [
      player.id,
      {
        playerId: player.id,
        playerName: player.full_name,
        currentRating: Number(player.current_rating),
        initialRank: player.initial_rank,
        skillLevel: player.skill_level,
        displayOrder: player.display_order,
        matchesPlayed: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        outcomes: [],
        goals: 0,
        assists: 0
      }
    ])
  );

  const matchesSorted = [...finishedMatches].sort(
    (a, b) => new Date(a.match.scheduled_at).getTime() - new Date(b.match.scheduled_at).getTime()
  );

  for (const item of matchesSorted) {
    if (!item.result) continue;
    const teamAIds = item.teamAPlayerIds;
    const teamBIds = item.teamBPlayerIds;

    for (const playerId of teamAIds) {
      const row = statsByPlayer.get(playerId);
      if (!row) continue;
      row.matchesPlayed += 1;
      pushOutcome(row, outcomeByTeam(item.result.winner_team, "A"));
    }
    for (const playerId of teamBIds) {
      const row = statsByPlayer.get(playerId);
      if (!row) continue;
      row.matchesPlayed += 1;
      pushOutcome(row, outcomeByTeam(item.result.winner_team, "B"));
    }
  }

  for (const row of matchPlayerStats) {
    const stats = statsByPlayer.get(row.player_id);
    if (!stats) continue;
    stats.goals += row.goals;
    stats.assists += row.assists;
  }

  const rankingMap = new Map(
    [...statsByPlayer.values()]
      .sort((a, b) => {
        const ratingDiff = b.currentRating - a.currentRating;
        if (ratingDiff !== 0) return ratingDiff;
        const matchesDiff = b.matchesPlayed - a.matchesPlayed;
        if (matchesDiff !== 0) return matchesDiff;
        const skillLevelDiff = a.skillLevel - b.skillLevel;
        if (skillLevelDiff !== 0) return skillLevelDiff;
        const displayOrderDiff = a.displayOrder - b.displayOrder;
        if (displayOrderDiff !== 0) return displayOrderDiff;
        return a.playerName.localeCompare(b.playerName);
      })
      .map((player, index) => [player.playerId, index + 1])
  );

  return [...statsByPlayer.values()]
    .map<PlayerComputedStats>((stats) => {
      const currentRank = rankingMap.get(stats.playerId) ?? 999;
      const winRate = stats.matchesPlayed === 0 ? 0 : (stats.wins / stats.matchesPlayed) * 100;

      return {
        playerId: stats.playerId,
        playerName: stats.playerName,
        currentRating: Math.round(stats.currentRating),
        initialRank: stats.initialRank,
        currentRank,
        matchesPlayed: stats.matchesPlayed,
        wins: stats.wins,
        draws: stats.draws,
        losses: stats.losses,
        winRate: Number(winRate.toFixed(2)),
        streak: buildStreak(stats.outcomes),
        goals: stats.goals,
        assists: stats.assists
      };
    })
    .sort((a, b) => a.currentRank - b.currentRank);
}
