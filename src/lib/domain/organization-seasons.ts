const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type SeasonInsertInput = {
  organizationId: string;
  createdBy?: string | null;
  startsAt: Date;
};

export function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function getAnnualOrganizationSeasonEndDate(now = new Date()) {
  return `${now.getUTCFullYear()}-12-31`;
}

function parseDateOnly(value: string) {
  if (!DATE_ONLY_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return null;
  return toDateOnly(date) === value ? date : null;
}

export function calculateOrganizationSeasonDurationMonths(startsAt: Date, endsAt: string) {
  const endDate = parseDateOnly(endsAt);
  if (!endDate) {
    throw new Error("La fecha de fin de temporada es invalida.");
  }

  let months =
    (endDate.getUTCFullYear() - startsAt.getUTCFullYear()) * 12 +
    (endDate.getUTCMonth() - startsAt.getUTCMonth());
  if (endDate.getUTCDate() >= startsAt.getUTCDate()) {
    months += 1;
  }

  return Math.max(1, months);
}

export function buildOrganizationSeasonLabel(startsAt: Date, endsAt: string) {
  const endDate = parseDateOnly(endsAt);
  if (!endDate) {
    throw new Error("La fecha de fin de temporada es invalida.");
  }

  return `Temporada ${startsAt.getUTCFullYear()}`;
}

export function buildOrganizationSeasonInsert({ organizationId, createdBy, startsAt }: SeasonInsertInput) {
  const endsAt = getAnnualOrganizationSeasonEndDate(startsAt);
  return {
    organization_id: organizationId,
    label: buildOrganizationSeasonLabel(startsAt, endsAt),
    duration_months: calculateOrganizationSeasonDurationMonths(startsAt, endsAt),
    starts_at: toDateOnly(startsAt),
    ends_at: endsAt,
    status: "active" as const,
    created_by: createdBy ?? null
  };
}
