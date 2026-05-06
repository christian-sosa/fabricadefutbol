function pad(value: number) {
  return String(value).padStart(2, "0");
}

export const MATCH_TIME_ZONE = "America/Argentina/Buenos_Aires";

function getTimeZonePart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((part) => part.type === type)?.value ?? "00";
}

function getMatchDateTimeParts(value: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: MATCH_TIME_ZONE,
    year: "numeric"
  }).formatToParts(value);

  return {
    year: getTimeZonePart(parts, "year"),
    month: getTimeZonePart(parts, "month"),
    day: getTimeZonePart(parts, "day"),
    hour: getTimeZonePart(parts, "hour"),
    minute: getTimeZonePart(parts, "minute"),
    second: getTimeZonePart(parts, "second")
  };
}

export function getCurrentMatchDateInput(value: Date = new Date()) {
  const parts = getMatchDateTimeParts(value);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getCurrentMatchDateTimeIso(value: Date = new Date()) {
  const parts = getMatchDateTimeParts(value);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.000Z`;
}

export function datetimeLocalToMatchIso(value: string) {
  const normalized = value.trim();
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/.exec(normalized);

  if (match) {
    const seconds = match[3] ?? "00";
    return `${match[1]}T${match[2]}:${seconds}.000Z`;
  }

  return new Date(normalized).toISOString();
}

function normalizeMatchDateInput(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) return null;

  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (
    parsed.getUTCFullYear() !== Number(match[1]) ||
    parsed.getUTCMonth() + 1 !== Number(match[2]) ||
    parsed.getUTCDate() !== Number(match[3])
  ) {
    return null;
  }

  return normalized;
}

function normalizeMatchTimeInput(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(normalized);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? "00");
  if (hour > 23 || minute > 59 || second > 59) return null;

  return `${pad(hour)}:${pad(minute)}:${pad(second)}`;
}

export function matchDateAndTimeToIso(
  dateValue: string | null | undefined,
  timeValue: string | null | undefined,
  defaultDate = getCurrentMatchDateInput()
) {
  const normalizedTime = normalizeMatchTimeInput(timeValue);
  if (!normalizedTime) {
    throw new Error("La hora es obligatoria.");
  }

  const normalizedDate = normalizeMatchDateInput(dateValue) ?? normalizeMatchDateInput(defaultDate) ?? getCurrentMatchDateInput();
  return `${normalizedDate}T${normalizedTime}.000Z`;
}

export function optionalMatchDateAndTimeToIso(
  dateValue: string | null | undefined,
  timeValue: string | null | undefined,
  defaultDate = getCurrentMatchDateInput()
) {
  if (!timeValue?.trim()) return null;
  return matchDateAndTimeToIso(dateValue, timeValue, defaultDate);
}

export function matchIsoToDatetimeLocal(value: string | null | undefined) {
  if (!value) return "";
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value.trim());
  if (match) return `${match[1]}T${match[2]}`;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${parsed.getUTCFullYear()}-${pad(parsed.getUTCMonth() + 1)}-${pad(parsed.getUTCDate())}T${pad(parsed.getUTCHours())}:${pad(parsed.getUTCMinutes())}`;
}

export function matchIsoToDateInput(value: string | null | undefined) {
  if (!value) return "";
  const match = /^(\d{4}-\d{2}-\d{2})T/.exec(value.trim());
  if (match) return match[1];

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${parsed.getUTCFullYear()}-${pad(parsed.getUTCMonth() + 1)}-${pad(parsed.getUTCDate())}`;
}

export function matchIsoToTimeInput(value: string | null | undefined) {
  if (!value) return "";
  const match = /^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2})/.exec(value.trim());
  if (match) return match[1];

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${pad(parsed.getUTCHours())}:${pad(parsed.getUTCMinutes())}`;
}

export function formatMatchDateTime(value: string | Date) {
  const parsed = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(parsed.getTime())) return "-";

  return `${pad(parsed.getUTCDate())}/${pad(parsed.getUTCMonth() + 1)}/${parsed.getUTCFullYear()} ${pad(parsed.getUTCHours())}:${pad(parsed.getUTCMinutes())}`;
}
