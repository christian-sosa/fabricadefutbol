export const MIN_SKILL_LEVEL = 1;
export const MAX_SKILL_LEVEL = 7;
export const DEFAULT_SKILL_LEVEL = 5;
export const BASE_RATING = 1000;
export const RATING_STEP_SIZE = 50;
export const RATING_UP_THRESHOLD = BASE_RATING + RATING_STEP_SIZE;
export const RATING_DOWN_THRESHOLD = BASE_RATING - RATING_STEP_SIZE;
export const EDGE_RATING_BONUS = 25;
export const GUEST_FEATURED_SKILL_LEVEL = 0.5;
export const SKILL_LEVEL_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;
export const GUEST_SKILL_LEVEL_OPTIONS = [GUEST_FEATURED_SKILL_LEVEL, ...SKILL_LEVEL_OPTIONS] as const;
export const GUEST_SKILL_LEVEL_HELP_TEXT =
  "Invitado superior: mejor que Estrella. Nivel 1 es Estrella; Nivel 7 es Principiante.";
export const SKILL_LEVEL_LABELS: Record<(typeof SKILL_LEVEL_OPTIONS)[number], string> = {
  1: "Estrella",
  2: "Figura",
  3: "Muy bueno",
  4: "Bueno",
  5: "Intermedio",
  6: "Recreativo",
  7: "Principiante"
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

export function parseGuestSkillLevelValue(value: number | string | null | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed === GUEST_FEATURED_SKILL_LEVEL) return GUEST_FEATURED_SKILL_LEVEL;

  const level = Math.trunc(parsed);
  if (parsed !== level) return null;
  if (level < MIN_SKILL_LEVEL || level > MAX_SKILL_LEVEL) return null;
  return level;
}

export function formatGuestSkillLevelLabel(value: number | string | null | undefined) {
  const level = parseGuestSkillLevelValue(value);
  if (level === GUEST_FEATURED_SKILL_LEVEL) {
    return "Invitado superior - mejor que Estrella";
  }
  if (level === null) return "Nivel invitado invalido";
  return formatSkillLevelLabel(level);
}

export function formatRatingTrendLabel(currentRating: number | null | undefined) {
  const rating = Number(currentRating ?? BASE_RATING);
  if (!Number.isFinite(rating)) return "Parejo";
  if (rating >= RATING_UP_THRESHOLD) return "Viene bien";
  if (rating <= RATING_DOWN_THRESHOLD) return "Viene mal";
  return "Parejo";
}

export function formatRatingTrendBadgeLabel(currentRating: number | null | undefined) {
  const label = formatRatingTrendLabel(currentRating);
  if (label === "Viene bien") return `+ ${label}`;
  if (label === "Viene mal") return `- ${label}`;
  return label;
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

function calculateRatingStepOffset(currentRating: number | null | undefined) {
  const rating = Number(currentRating ?? BASE_RATING);
  if (!Number.isFinite(rating)) return 0;

  const distanceFromBase = rating - BASE_RATING;
  if (Math.abs(distanceFromBase) < RATING_STEP_SIZE) return 0;

  return distanceFromBase > 0
    ? Math.floor(distanceFromBase / RATING_STEP_SIZE)
    : Math.ceil(distanceFromBase / RATING_STEP_SIZE);
}

function calculateRawEffectiveSkillLevel(input: EffectiveSkillScoreInput) {
  const skillLevel = normalizeSkillLevel(input.skillLevel);
  return skillLevel - calculateRatingStepOffset(input.currentRating);
}

export function calculateEffectiveSkillLevel(input: EffectiveSkillScoreInput) {
  return normalizeSkillLevel(calculateRawEffectiveSkillLevel(input));
}

export function calculateEffectiveSkillScore(input: EffectiveSkillScoreInput) {
  const skillLevel = normalizeSkillLevel(input.skillLevel);
  const currentRating = Number(input.currentRating ?? 1000);
  const rawEffectiveLevel = calculateRawEffectiveSkillLevel({
    skillLevel,
    currentRating
  });
  const effectiveLevel = normalizeSkillLevel(rawEffectiveLevel);

  let score = (MAX_SKILL_LEVEL + 1 - effectiveLevel) * 100;
  if (rawEffectiveLevel < MIN_SKILL_LEVEL) {
    score += (MIN_SKILL_LEVEL - rawEffectiveLevel) * EDGE_RATING_BONUS;
  }
  if (rawEffectiveLevel > MAX_SKILL_LEVEL) {
    score -= (rawEffectiveLevel - MAX_SKILL_LEVEL) * EDGE_RATING_BONUS;
  }

  return Number(score.toFixed(2));
}

export function calculateGuestSkillScore(guestSkillLevel: number | string | null | undefined) {
  const level = parseGuestSkillLevelValue(guestSkillLevel);
  if (level === GUEST_FEATURED_SKILL_LEVEL) {
    return calculateEffectiveSkillScore({
      skillLevel: MIN_SKILL_LEVEL,
      currentRating: RATING_UP_THRESHOLD
    });
  }

  return calculateEffectiveSkillScore({
    skillLevel: level ?? Number(guestSkillLevel),
    currentRating: 1000
  });
}

export function calculateGuestDisplayRating(guestSkillLevel: number | string | null | undefined) {
  const level = parseGuestSkillLevelValue(guestSkillLevel);
  if (level === GUEST_FEATURED_SKILL_LEVEL) return RATING_UP_THRESHOLD;
  if (level !== null) return 1000 - (level - MIN_SKILL_LEVEL) * 50;

  const legacyRating = Number(guestSkillLevel);
  return Number.isFinite(legacyRating) ? legacyRating : 0;
}
