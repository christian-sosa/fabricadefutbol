export type LeagueSubscriptionSnapshot = {
  status: string | null;
  current_period_end: string | null;
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
