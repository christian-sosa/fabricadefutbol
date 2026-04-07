import { TEAM_SIZE_BY_MODALITY } from "@/lib/constants";
import type { MatchModality, PlayerRatingInput, TeamOptionCandidate } from "@/types/domain";

type GenerateTeamOptionsInput = {
  players: PlayerRatingInput[];
  modality: MatchModality;
  requestedOptions?: number;
  seed?: number;
  requiredSeparatedPairs?: Array<[string, string]>;
};

type ScoredCombination = TeamOptionCandidate & {
  score: number;
  key: string;
};

const DEFAULT_OPTION_COUNT = 3;
const MAX_OPTION_COUNT = 6;
const TOP_TWO_SAME_TEAM_PENALTY = 35;

function createSeededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(items: T[], random: () => number) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

function sumRatings(players: PlayerRatingInput[]) {
  return players.reduce((acc, player) => acc + player.rating, 0);
}

function canonicalKey(teamA: PlayerRatingInput[]) {
  return teamA
    .map((player) => player.id)
    .sort((a, b) => a.localeCompare(b))
    .join("|");
}

function sameTeam(topPlayerAId: string, topPlayerBId: string, teamA: PlayerRatingInput[]) {
  const ids = new Set(teamA.map((player) => player.id));
  const topInTeamA = ids.has(topPlayerAId) && ids.has(topPlayerBId);
  const topInTeamB = !ids.has(topPlayerAId) && !ids.has(topPlayerBId);
  return topInTeamA || topInTeamB;
}

function areParticipantsSeparated(
  firstParticipantId: string,
  secondParticipantId: string,
  teamAIds: Set<string>
) {
  return teamAIds.has(firstParticipantId) !== teamAIds.has(secondParticipantId);
}

function chooseCombinations(
  items: PlayerRatingInput[],
  size: number,
  random: () => number
): PlayerRatingInput[][] {
  const first = items[0];
  const rest = items.slice(1);
  const targetSize = size - 1;
  const output: PlayerRatingInput[][] = [];

  const walk = (start: number, acc: PlayerRatingInput[]) => {
    if (acc.length === targetSize) {
      output.push([first, ...acc]);
      return;
    }

    for (let i = start; i < rest.length; i += 1) {
      walk(i + 1, [...acc, rest[i]]);
    }
  };

  walk(0, []);
  shuffleInPlace(output, random);
  return output;
}

export function generateBalancedTeamOptions(input: GenerateTeamOptionsInput): TeamOptionCandidate[] {
  /**
   * Strategy:
   * 1) Build unique partitions A/B fixing one player to avoid mirrored duplicates.
   * 2) Score each partition by rating difference.
   * 3) Penalize combinations where top two ratings end up together.
   * 4) Add small seeded jitter to vary regeneration while preserving quality.
   */
  const { players, modality } = input;
  const teamSize = TEAM_SIZE_BY_MODALITY[modality];
  const expectedPlayers = teamSize * 2;

  if (players.length !== expectedPlayers) {
    throw new Error(
      `Cantidad inválida: para ${modality} se esperaban ${expectedPlayers} jugadores y llegaron ${players.length}.`
    );
  }

  const uniquePlayerIds = new Set(players.map((player) => player.id));
  if (uniquePlayerIds.size !== players.length) {
    throw new Error("Hay jugadores duplicados en la convocatoria.");
  }

  const requiredSeparatedPairs = input.requiredSeparatedPairs ?? [];
  for (const [firstParticipantId, secondParticipantId] of requiredSeparatedPairs) {
    if (!uniquePlayerIds.has(firstParticipantId) || !uniquePlayerIds.has(secondParticipantId)) {
      throw new Error("Las reglas de separacion incluyen participantes que no existen en la convocatoria.");
    }
    if (firstParticipantId === secondParticipantId) {
      throw new Error("Las reglas de separacion incluyen participantes duplicados.");
    }
  }

  const requested = Math.min(Math.max(input.requestedOptions ?? DEFAULT_OPTION_COUNT, 1), MAX_OPTION_COUNT);
  const seed = input.seed ?? Math.floor(Date.now() + Math.random() * 100000);
  const random = createSeededRandom(seed);

  const sortedByRating = [...players].sort((a, b) => b.rating - a.rating);
  const topA = sortedByRating[0]?.id;
  const topB = sortedByRating[1]?.id;
  const combinations = chooseCombinations(players, teamSize, random);

  const scored: ScoredCombination[] = combinations.flatMap((teamA) => {
    const teamAIds = new Set(teamA.map((player) => player.id));
    const respectsSeparatedPairs = requiredSeparatedPairs.every(([firstParticipantId, secondParticipantId]) =>
      areParticipantsSeparated(firstParticipantId, secondParticipantId, teamAIds)
    );
    if (!respectsSeparatedPairs) return [];

    const teamB = players.filter((player) => !teamAIds.has(player.id));
    const ratingSumA = sumRatings(teamA);
    const ratingSumB = sumRatings(teamB);
    const ratingDiff = Math.abs(ratingSumA - ratingSumB);

    const topTwoPenalty =
      topA && topB && sameTeam(topA, topB, teamA) ? TOP_TWO_SAME_TEAM_PENALTY : 0;

    const score = ratingDiff + topTwoPenalty + random() * 1.25;

    return {
      teamA,
      teamB,
      ratingSumA: Number(ratingSumA.toFixed(2)),
      ratingSumB: Number(ratingSumB.toFixed(2)),
      ratingDiff: Number(ratingDiff.toFixed(2)),
      score,
      key: canonicalKey(teamA)
    };
  });

  if (!scored.length) {
    throw new Error("No se pudieron generar equipos que respeten las reglas definidas.");
  }

  scored.sort((a, b) => a.score - b.score);

  const qualityPool = scored.slice(0, Math.min(80, scored.length));
  shuffleInPlace(qualityPool, random);

  const selected: TeamOptionCandidate[] = [];
  const usedKeys = new Set<string>();

  for (const option of qualityPool) {
    if (usedKeys.has(option.key)) continue;
    usedKeys.add(option.key);
    selected.push({
      teamA: option.teamA,
      teamB: option.teamB,
      ratingSumA: option.ratingSumA,
      ratingSumB: option.ratingSumB,
      ratingDiff: option.ratingDiff
    });
    if (selected.length >= requested) {
      break;
    }
  }

  if (selected.length < requested) {
    for (const option of scored) {
      if (usedKeys.has(option.key)) continue;
      usedKeys.add(option.key);
      selected.push({
        teamA: option.teamA,
        teamB: option.teamB,
        ratingSumA: option.ratingSumA,
        ratingSumB: option.ratingSumB,
        ratingDiff: option.ratingDiff
      });
      if (selected.length >= requested) {
        break;
      }
    }
  }

  return selected;
}
