type RankingPlayer = {
  playerId: string;
  playerName: string;
  currentRating: number;
  mvpCount?: number;
  matchesPlayed: number;
  skillLevel?: number;
  displayOrder?: number;
  currentRank?: number;
};

export function comparePlayerRanking(left: RankingPlayer, right: RankingPlayer) {
  return right.currentRating - left.currentRating
    || (right.mvpCount ?? 0) - (left.mvpCount ?? 0)
    || right.matchesPlayed - left.matchesPlayed
    || (left.skillLevel ?? 0) - (right.skillLevel ?? 0)
    || (left.displayOrder ?? 0) - (right.displayOrder ?? 0)
    // Cached rows retain the previous stable fallback when raw level/order are absent.
    || (left.currentRank ?? 0) - (right.currentRank ?? 0)
    || left.playerName.localeCompare(right.playerName, "es")
    || left.playerId.localeCompare(right.playerId);
}

export function rankPlayers<T extends RankingPlayer>(players: T[]): Array<T & { currentRank: number }> {
  return [...players].sort(comparePlayerRanking).map((player, index) => ({ ...player, currentRank: index + 1 }));
}
