import { FREE_TRIAL_DAYS, ORGANIZATION_PLAYER_PHOTO_RETENTION_DAYS } from "@/lib/constants";

export type OrganizationSubscriptionSnapshot = {
  status: string | null;
  current_period_end: string | null;
};

export type LeagueSubscriptionSnapshot = {
  status: string | null;
  current_period_end: string | null;
};

export type OrganizationWriteWindow = {
  canWrite: boolean;
  organizationTrialEndsAt: string;
  organizationTrialExpired: boolean;
  subscriptionActive: boolean;
  accessValidUntil: string;
  writeLockedAt: string | null;
  playerPhotosPurgeAt: string | null;
  playerPhotosRetentionExpired: boolean;
};

export type LeagueWriteWindow = {
  canWrite: boolean;
  subscriptionActive: boolean;
  accessValidUntil: string | null;
  writeLockedAt: string | null;
};

export function addDaysToIsoDate(isoDate: string, days: number) {
  const base = new Date(isoDate);
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function addMonthsToIsoDate(isoDate: string, months: number) {
  const base = new Date(isoDate);
  return new Date(
    Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth() + months,
      base.getUTCDate(),
      base.getUTCHours(),
      base.getUTCMinutes(),
      base.getUTCSeconds(),
      base.getUTCMilliseconds()
    )
  ).toISOString();
}

export function isIsoDateExpired(isoDate: string) {
  return Date.now() > new Date(isoDate).getTime();
}

export function getOrganizationTrialEndsAt(organizationCreatedAt: string) {
  return addDaysToIsoDate(organizationCreatedAt, FREE_TRIAL_DAYS);
}

export function hasActiveOrganizationSubscription(
  subscription: OrganizationSubscriptionSnapshot | null | undefined
) {
  if (!subscription?.current_period_end) return false;
  if ((subscription.status ?? "").toLowerCase() !== "active") return false;
  return !isIsoDateExpired(subscription.current_period_end);
}

export function resolveOrganizationWriteWindow(params: {
  organizationCreatedAt: string;
  subscription: OrganizationSubscriptionSnapshot | null | undefined;
}): OrganizationWriteWindow {
  const organizationTrialEndsAt = getOrganizationTrialEndsAt(params.organizationCreatedAt);
  const organizationTrialExpired = isIsoDateExpired(organizationTrialEndsAt);
  const subscriptionActive = hasActiveOrganizationSubscription(params.subscription);
  const accessValidUntil = params.subscription?.current_period_end ?? organizationTrialEndsAt;
  const canWrite = subscriptionActive || !organizationTrialExpired;
  const writeLockedAt = canWrite ? null : accessValidUntil;
  const playerPhotosPurgeAt = writeLockedAt
    ? addDaysToIsoDate(writeLockedAt, ORGANIZATION_PLAYER_PHOTO_RETENTION_DAYS)
    : null;

  return {
    canWrite,
    organizationTrialEndsAt,
    organizationTrialExpired,
    subscriptionActive,
    accessValidUntil,
    writeLockedAt,
    playerPhotosPurgeAt,
    playerPhotosRetentionExpired: playerPhotosPurgeAt ? isIsoDateExpired(playerPhotosPurgeAt) : false
  };
}

export function resolveNextOrganizationBillingPeriod(
  previousPeriodEnd: string | null | undefined,
  accessValidUntil?: string | null | undefined
) {
  const now = new Date();
  const candidateDates = [previousPeriodEnd, accessValidUntil]
    .map((value) => (value ? new Date(value) : null))
    .filter((value): value is Date => value instanceof Date && Number.isFinite(value.getTime()));

  const futureCandidate = candidateDates.reduce<Date | null>((latest, candidate) => {
    if (candidate.getTime() <= now.getTime()) return latest;
    if (!latest) return candidate;
    return candidate.getTime() > latest.getTime() ? candidate : latest;
  }, null);

  const periodStart = futureCandidate ? futureCandidate.toISOString() : now.toISOString();
  const periodEnd = addMonthsToIsoDate(periodStart, 1);

  return {
    periodStart,
    periodEnd
  };
}

export function hasActiveLeagueSubscription(
  subscription: LeagueSubscriptionSnapshot | null | undefined
) {
  if (!subscription?.current_period_end) return false;
  if ((subscription.status ?? "").toLowerCase() !== "active") return false;
  return !isIsoDateExpired(subscription.current_period_end);
}

export function resolveLeagueWriteWindow(params: {
  subscription: LeagueSubscriptionSnapshot | null | undefined;
}): LeagueWriteWindow {
  const subscriptionActive = hasActiveLeagueSubscription(params.subscription);
  const accessValidUntil = params.subscription?.current_period_end ?? null;

  return {
    canWrite: subscriptionActive,
    subscriptionActive,
    accessValidUntil,
    writeLockedAt: subscriptionActive ? null : accessValidUntil
  };
}

export function resolveNextLeagueBillingPeriod(previousPeriodEnd: string | null | undefined) {
  const now = new Date();
  const previous = previousPeriodEnd ? new Date(previousPeriodEnd) : null;
  const hasFuturePrevious = previous instanceof Date && Number.isFinite(previous.getTime()) && previous.getTime() > now.getTime();
  const periodStart = hasFuturePrevious ? previous.toISOString() : now.toISOString();
  const periodEnd = addMonthsToIsoDate(periodStart, 1);

  return {
    periodStart,
    periodEnd
  };
}

export function toShortDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString("es-AR");
}
