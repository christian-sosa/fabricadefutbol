import { TEAM_SIZE_BY_MODALITY } from "@/lib/constants";
import { assignPlayersToPositions, getDefaultPositionFormation, getFormationRoles, getPlayerPositionCost, supportsPositionBalancing } from "@/lib/domain/player-positions";
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
  levelScore: number;
  key: string;
};

const DEFAULT_OPTION_COUNT = 3;
const MAX_OPTION_COUNT = 6;
const TOP_TWO_SAME_TEAM_PENALTY = 35;
const STRONG_PLAYER_SCORE_THRESHOLD = 400;
const ELITE_PLAYER_SCORE_THRESHOLD = 500;
const STRONG_COUNT_DIFF_PENALTY = 30;
const ELITE_COUNT_DIFF_PENALTY = 20;
// Por encima de este numero de combinaciones totales evitamos enumerar todo
// y usamos muestreo aleatorio. Cubre hasta 9v9 (C(17,8)=24310) sin cambios;
// 10v10 (C(19,9)=92378) y 11v11 (C(21,10)=352716) usan muestreo.
const MAX_ENUMERATED_COMBINATIONS = 50_000;
const SAMPLE_COMBINATIONS_TARGET = 50_000;
// Las preferencias no pueden sacrificar un nivel completo (100 puntos) por
// jugador. Conservamos los pesos históricos y acotamos su influencia a 30.
const MAX_POSITION_LEVEL_TRADEOFF = 30;
const POSITION_COST_WEIGHT = 3;
const MAX_POSITION_SHORTLIST = 2_500;

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

function countPlayersAtOrAbove(players: PlayerRatingInput[], threshold: number) {
  return players.filter((player) => player.rating >= threshold).length;
}

function distributionPenalty(params: {
  teamA: PlayerRatingInput[];
  teamB: PlayerRatingInput[];
  threshold: number;
  penaltyPerPlayerDiff: number;
}) {
  const strongA = countPlayersAtOrAbove(params.teamA, params.threshold);
  const strongB = countPlayersAtOrAbove(params.teamB, params.threshold);
  return Math.abs(strongA - strongB) * params.penaltyPerPlayerDiff;
}

function areParticipantsSeparated(
  firstParticipantId: string,
  secondParticipantId: string,
  teamAIds: Set<string>
) {
  return teamAIds.has(firstParticipantId) !== teamAIds.has(secondParticipantId);
}

function binomial(n: number, k: number) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  const m = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= m; i += 1) {
    result = (result * (n - m + i)) / i;
  }
  return result;
}

function enumerateCombinations(
  first: PlayerRatingInput,
  rest: PlayerRatingInput[],
  targetSize: number,
  random: () => number
): PlayerRatingInput[][] {
  const output: PlayerRatingInput[][] = [];
  const acc: PlayerRatingInput[] = [];

  const walk = (start: number) => {
    if (acc.length === targetSize) {
      output.push([first, ...acc]);
      return;
    }
    const remaining = targetSize - acc.length;
    const maxStart = rest.length - remaining;
    for (let i = start; i <= maxStart; i += 1) {
      acc.push(rest[i]);
      walk(i + 1);
      acc.pop();
    }
  };

  walk(0);
  shuffleInPlace(output, random);
  return output;
}

function sampleCombinations(
  first: PlayerRatingInput,
  rest: PlayerRatingInput[],
  targetSize: number,
  sampleSize: number,
  random: () => number
): PlayerRatingInput[][] {
  const seenKeys = new Set<string>();
  const output: PlayerRatingInput[][] = [];
  const restCopy = rest.slice();
  const maxTries = sampleSize * 3;

  for (let attempts = 0; attempts < maxTries && output.length < sampleSize; attempts += 1) {
    // Fisher-Yates parcial: mezclamos solo los primeros targetSize elementos.
    for (let i = 0; i < targetSize; i += 1) {
      const j = i + Math.floor(random() * (restCopy.length - i));
      [restCopy[i], restCopy[j]] = [restCopy[j], restCopy[i]];
    }
    const teamATail = restCopy.slice(0, targetSize);
    const key = teamATail
      .map((player) => player.id)
      .sort((a, b) => a.localeCompare(b))
      .join("|");
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    output.push([first, ...teamATail]);
  }

  return output;
}

function chooseCombinations(
  items: PlayerRatingInput[],
  size: number,
  random: () => number
): PlayerRatingInput[][] {
  const first = items[0];
  const rest = items.slice(1);
  const targetSize = size - 1;

  const totalCombinations = binomial(rest.length, targetSize);
  if (totalCombinations <= MAX_ENUMERATED_COMBINATIONS) {
    return enumerateCombinations(first, rest, targetSize, random);
  }

  // Modalidades grandes (ej. 11v11): muestreo aleatorio uniforme con dedup
  // por clave canonica. Evita explosion combinatoria sin perder calidad porque
  // el scoring posterior filtra al top.
  return sampleCombinations(first, rest, targetSize, SAMPLE_COMBINATIONS_TARGET, random);
}

function positionProfileKey(team: PlayerRatingInput[]) {
  return team.map((player) => player.isGoalkeeper ? "keeper" : `${player.preferredPosition ?? ""}:${player.secondaryPosition ?? ""}`).sort().join("|");
}

function constrainedFallbackCombinations(players: PlayerRatingInput[], size: number, pairs: Array<[string, string]>, random: () => number): PlayerRatingInput[][] {
  // Una convocatoria con muchas separaciones puede tener una única partición
  // válida y el muestreo no alcanzarla. Los componentes bipartitos permiten
  // encontrarla exactamente; cada componente sólo tiene dos orientaciones.
  const indexes = new Map(players.map((player, index) => [player.id, index]));
  const adjacency = players.map(() => [] as number[]);
  for (const [first, second] of pairs) {
    const a = indexes.get(first)!;
    const b = indexes.get(second)!;
    adjacency[a].push(b);
    adjacency[b].push(a);
  }
  const colors = new Int8Array(players.length).fill(-1);
  const components: [PlayerRatingInput[], PlayerRatingInput[]][] = [];
  for (let index = 0; index < players.length; index += 1) {
    if (colors[index] >= 0) continue;
    const component: [PlayerRatingInput[], PlayerRatingInput[]] = [[], []];
    const queue = [index];
    colors[index] = 0;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      component[colors[current]].push(players[current]);
      for (const neighbor of adjacency[current]) {
        if (colors[neighbor] === colors[current]) return [];
        if (colors[neighbor] < 0) {
          colors[neighbor] = 1 - colors[current];
          queue.push(neighbor);
        }
      }
    }
    components.push(component);
  }
  const minRemaining = new Int32Array(components.length + 1);
  const maxRemaining = new Int32Array(components.length + 1);
  for (let index = components.length - 1; index >= 0; index -= 1) {
    const [left, right] = components[index];
    minRemaining[index] = minRemaining[index + 1] + Math.min(left.length, right.length);
    maxRemaining[index] = maxRemaining[index + 1] + Math.max(left.length, right.length);
  }
  const output: PlayerRatingInput[][] = [];
  const teamA = [...components[0][0]];
  const walk = (index: number) => {
    if (output.length >= SAMPLE_COMBINATIONS_TARGET || teamA.length + minRemaining[index] > size || teamA.length + maxRemaining[index] < size) return;
    if (index === components.length) {
      if (teamA.length === size) output.push([...teamA]);
      return;
    }
    for (const side of components[index]) {
      teamA.push(...side);
      walk(index + 1);
      teamA.splice(teamA.length - side.length, side.length);
    }
  };
  walk(1);
  shuffleInPlace(output, random);
  return output;
}

function scorePositionShortlist(scored: ScoredCombination[], modality: MatchModality): ScoredCombination[] {
  const formationId = getDefaultPositionFormation(modality);
  if (!formationId) return scored;
  const positions = getFormationRoles(formationId);
  const roleCounts = [...new Set(positions)].map((role) => ({ role, count: positions.filter((position) => position === role).length }));
  const estimateCache = new Map<string, number>();
  const assignmentCache = new Map<string, number>();
  const bestLevelScore = scored.reduce((best, candidate) => Math.min(best, candidate.levelScore), Infinity);
  const candidates = scored.filter((candidate) => candidate.levelScore <= bestLevelScore + MAX_POSITION_LEVEL_TRADEOFF);
  const getEstimate = (team: PlayerRatingInput[], key: string) => {
    const existing = estimateCache.get(key);
    if (existing !== undefined) return existing;
    // Cota barata: cada puesto elige sus mejores candidatos sin reservarlos.
    // Luego resolvemos el encaje global sólo para las mejores alternativas.
    const estimate = roleCounts.reduce((total, { role, count }) => total + team
      .map((player) => getPlayerPositionCost(player, role))
      .sort((a, b) => a - b).slice(0, count).reduce((sum, cost) => sum + cost, 0), 0);
    estimateCache.set(key, estimate);
    return estimate;
  };
  const estimated = candidates.map((candidate) => {
    const keyA = positionProfileKey(candidate.teamA);
    const keyB = positionProfileKey(candidate.teamB);
    const estimateA = getEstimate(candidate.teamA, keyA);
    const estimateB = getEstimate(candidate.teamB, keyB);
    return { candidate, keyA, keyB, estimate: estimateA + estimateB + Math.abs(estimateA - estimateB) };
  });
  const bestEstimate = estimated.reduce((best, candidate) => Math.min(best, candidate.estimate), Infinity);
  estimated.sort((a, b) =>
    (a.candidate.score + Math.min(MAX_POSITION_LEVEL_TRADEOFF, (a.estimate - bestEstimate) * POSITION_COST_WEIGHT)) -
    (b.candidate.score + Math.min(MAX_POSITION_LEVEL_TRADEOFF, (b.estimate - bestEstimate) * POSITION_COST_WEIGHT))
  );
  const getCost = (team: PlayerRatingInput[], key: string) => {
    const existing = assignmentCache.get(key);
    if (existing !== undefined) return existing;
    const cost = assignPlayersToPositions(team, positions).cost;
    assignmentCache.set(key, cost);
    return cost;
  };
  const fitted = estimated.slice(0, MAX_POSITION_SHORTLIST).map(({ candidate, keyA, keyB }) => {
    const costA = getCost(candidate.teamA, keyA);
    const costB = getCost(candidate.teamB, keyB);
    return { candidate, positionCost: costA + costB + Math.abs(costA - costB) };
  });
  const bestPositionCost = fitted.reduce((best, candidate) => Math.min(best, candidate.positionCost), Infinity);
  return fitted.map(({ candidate, positionCost }) => ({
    ...candidate,
    score: candidate.score + Math.min(MAX_POSITION_LEVEL_TRADEOFF, (positionCost - bestPositionCost) * POSITION_COST_WEIGHT)
  }));
}

export function generateBalancedTeamOptions(input: GenerateTeamOptionsInput): TeamOptionCandidate[] {
  /**
   * Strategy:
   * 1) Build unique partitions A/B fixing one player to avoid mirrored duplicates.
   * 2) Score each partition by rating difference.
   * 3) Penalize combinations that concentrate too much top-end strength.
   * 4) Fit preferred/secondary roles in large formats within the level budget.
   * 5) Add small seeded jitter to vary regeneration while preserving quality.
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

  const requiredSeparatedPairs = [...(input.requiredSeparatedPairs ?? [])];
  const selectedGoalkeepers = players.filter((player) => player.isGoalkeeper);
  if (selectedGoalkeepers.length === 2) {
    requiredSeparatedPairs.push([selectedGoalkeepers[0].id, selectedGoalkeepers[1].id]);
  }
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

  const scoreCombination = (teamA: PlayerRatingInput[]): ScoredCombination[] => {
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
    const strongDistributionPenalty = distributionPenalty({
      teamA,
      teamB,
      threshold: STRONG_PLAYER_SCORE_THRESHOLD,
      penaltyPerPlayerDiff: STRONG_COUNT_DIFF_PENALTY
    });
    const eliteDistributionPenalty = distributionPenalty({
      teamA,
      teamB,
      threshold: ELITE_PLAYER_SCORE_THRESHOLD,
      penaltyPerPlayerDiff: ELITE_COUNT_DIFF_PENALTY
    });

    const levelScore = ratingDiff + topTwoPenalty + strongDistributionPenalty + eliteDistributionPenalty;
    const score = levelScore + random() * 1.25;

    return [{
      teamA,
      teamB,
      ratingSumA: Number(ratingSumA.toFixed(2)),
      ratingSumB: Number(ratingSumB.toFixed(2)),
      ratingDiff: Number(ratingDiff.toFixed(2)),
      score,
      levelScore,
      key: canonicalKey(teamA)
    }];
  };
  let scored = combinations.flatMap(scoreCombination);
  if (!scored.length && requiredSeparatedPairs.length) {
    scored = constrainedFallbackCombinations(players, teamSize, requiredSeparatedPairs, random).flatMap(scoreCombination);
  }

  if (!scored.length) {
    throw new Error("No se pudieron generar equipos que respeten las reglas definidas.");
  }

  if (supportsPositionBalancing(modality) && players.some((player) => player.preferredPosition || player.secondaryPosition)) {
    scored = scorePositionShortlist(scored, modality);
  }

  scored.sort((a, b) => a.score - b.score);

  const qualityPool = scored.slice(0, Math.min(80, scored.length));

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
