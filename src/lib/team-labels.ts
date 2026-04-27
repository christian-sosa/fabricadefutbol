export const DEFAULT_TEAM_A_LABEL = "Negro";
export const DEFAULT_TEAM_B_LABEL = "Blanco";
export const TEAM_LABEL_MAX_LENGTH = 40;

type MatchTeamLabels = {
  team_a_label?: string | null;
  team_b_label?: string | null;
};

export function normalizeTeamLabel(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveMatchTeamLabels(match: MatchTeamLabels) {
  return {
    teamA: normalizeTeamLabel(match.team_a_label) ?? DEFAULT_TEAM_A_LABEL,
    teamB: normalizeTeamLabel(match.team_b_label) ?? DEFAULT_TEAM_B_LABEL
  };
}

