import { FREE_TRIAL_DAYS } from "@/lib/constants";

export type OrganizationSubscriptionSnapshot = {
  status: string | null;
  current_period_end: string | null;
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

export function resolveNextOrganizationBillingPeriod(previousPeriodEnd: string | null | undefined) {
  const now = new Date();
  const previousEndDate = previousPeriodEnd ? new Date(previousPeriodEnd) : null;
  const periodStart =
    previousEndDate && previousEndDate.getTime() > now.getTime() ? previousEndDate.toISOString() : now.toISOString();
  const periodEnd = addMonthsToIsoDate(periodStart, 1);

  return {
    periodStart,
    periodEnd
  };
}

export function toShortDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString("es-AR");
}
