export const GOOGLE_OUTCOME_COOKIE = "fdf_ga_outcome";

export function parseGoogleOutcome(value: string | undefined) {
  if (!value || !/^group_created:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) return null;
  return { eventName: "group_created", outcomeId: value.slice("group_created:".length) } as const;
}
