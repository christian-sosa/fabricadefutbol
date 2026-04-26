export const MIN_SKILL_LEVEL = 1;
export const MAX_SKILL_LEVEL = 5;
export const RATING_UP_THRESHOLD = 1050;
export const RATING_DOWN_THRESHOLD = 950;
export const EDGE_RATING_BONUS = 25;
export const SKILL_LEVEL_OPTIONS = [1, 2, 3, 4, 5] as const;
export const SKILL_LEVEL_LABELS: Record<(typeof SKILL_LEVEL_OPTIONS)[number], string> = {
  1: "Figura",
  2: "Muy bueno",
  3: "Intermedio",
  4: "Recreativo",
  5: "Principiante"
};

export type EffectiveSkillScoreInput = {
  skillLevel: number | null | undefined;
  currentRating: number | null | undefined;
};

export function normalizeSkillLevel(value: number | null | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return MAX_SKILL_LEVEL;
  return Math.min(MAX_SKILL_LEVEL, Math.max(MIN_SKILL_LEVEL, Math.trunc(parsed)));
}

export function formatSkillLevelLabel(value: number | null | undefined) {
  const level = normalizeSkillLevel(value) as (typeof SKILL_LEVEL_OPTIONS)[number];
  return `Nivel ${level} - ${SKILL_LEVEL_LABELS[level]}`;
}

export function mapInitialRankToSkillLevel(params: {
  initialRank: number;
  totalPlayers: number;
  bucketCount?: number;
}) {
  const bucketCount = Math.max(1, Math.trunc(params.bucketCount ?? MAX_SKILL_LEVEL));
  const totalPlayers = Math.max(1, Math.trunc(params.totalPlayers));
  const rankPosition = Math.min(Math.max(1, Math.trunc(params.initialRank)), totalPlayers);
  const bucket = Math.floor(((rankPosition - 1) * bucketCount) / totalPlayers) + 1;

  return normalizeSkillLevel(bucket);
}

export function calculateEffectiveSkillLevel(input: EffectiveSkillScoreInput) {
  const skillLevel = normalizeSkillLevel(input.skillLevel);
  const currentRating = Number(input.currentRating ?? 1000);

  if (Number.isFinite(currentRating) && currentRating >= RATING_UP_THRESHOLD) {
    return Math.max(MIN_SKILL_LEVEL, skillLevel - 1);
  }

  if (Number.isFinite(currentRating) && currentRating <= RATING_DOWN_THRESHOLD) {
    return Math.min(MAX_SKILL_LEVEL, skillLevel + 1);
  }

  return skillLevel;
}

export function calculateEffectiveSkillScore(input: EffectiveSkillScoreInput) {
  const skillLevel = normalizeSkillLevel(input.skillLevel);
  const currentRating = Number(input.currentRating ?? 1000);
  const effectiveLevel = calculateEffectiveSkillLevel({
    skillLevel,
    currentRating
  });

  let score = (MAX_SKILL_LEVEL + 1 - effectiveLevel) * 100;
  if (skillLevel === MIN_SKILL_LEVEL && Number.isFinite(currentRating) && currentRating >= RATING_UP_THRESHOLD) {
    score += EDGE_RATING_BONUS;
  }
  if (skillLevel === MAX_SKILL_LEVEL && Number.isFinite(currentRating) && currentRating <= RATING_DOWN_THRESHOLD) {
    score -= EDGE_RATING_BONUS;
  }

  return Number(score.toFixed(2));
}
