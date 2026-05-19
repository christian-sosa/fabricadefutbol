import { GROWTH_EVENTS, type GrowthEventName } from "@/lib/growth";

export const SERVER_ANALYTICS_EVENTS = {
  adminLoginSucceeded: "admin_login_succeeded",
  adminOauthLoginSucceeded: "admin_oauth_login_succeeded",
  adminRegisterSucceeded: "admin_register_succeeded",
  matchFinished: "match_finished",
  paymentCreated: "payment_created",
  paymentApproved: "payment_approved",
  superMetricsExported: "super_metrics_exported"
} as const;

export type ServerAnalyticsEventName =
  (typeof SERVER_ANALYTICS_EVENTS)[keyof typeof SERVER_ANALYTICS_EVENTS];
export type AnalyticsEventName = GrowthEventName | ServerAnalyticsEventName;
export type AnalyticsPropertyValue = string | number | boolean;
export type AnalyticsProperties = Record<string, AnalyticsPropertyValue>;

const ANALYTICS_EVENT_NAMES = new Set<string>([
  ...Object.values(GROWTH_EVENTS),
  ...Object.values(SERVER_ANALYTICS_EVENTS)
]);

const SENSITIVE_PROPERTY_KEY_PATTERN =
  /email|mail|password|pass|token|secret|key|cookie|authorization|auth|phone|telefono/i;
const EMAIL_VALUE_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const MAX_PROPERTY_KEYS = 50;
const MAX_STRING_LENGTH = 240;

export function isAnalyticsEventName(value: string | null | undefined): value is AnalyticsEventName {
  return Boolean(value && ANALYTICS_EVENT_NAMES.has(value));
}

function sanitizeKey(key: string) {
  return key.trim().replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 80);
}

function sanitizeValue(value: unknown): AnalyticsPropertyValue | undefined {
  if (value === null) return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (EMAIL_VALUE_PATTERN.test(trimmed)) return "[redacted]";
    return trimmed.slice(0, MAX_STRING_LENGTH);
  }
  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value) || (value && typeof value === "object")) {
    const serialized = JSON.stringify(value);
    if (EMAIL_VALUE_PATTERN.test(serialized)) return "[redacted]";
    return serialized.slice(0, MAX_STRING_LENGTH);
  }

  return undefined;
}

export function sanitizeAnalyticsProperties(
  properties: Record<string, unknown> | null | undefined
): AnalyticsProperties {
  if (!properties) return {};

  const entries: Array<[string, AnalyticsPropertyValue]> = [];
  for (const [rawKey, rawValue] of Object.entries(properties)) {
    if (entries.length >= MAX_PROPERTY_KEYS) break;
    if (SENSITIVE_PROPERTY_KEY_PATTERN.test(rawKey)) continue;

    const key = sanitizeKey(rawKey);
    if (!key) continue;

    const value = sanitizeValue(rawValue);
    if (value === undefined) continue;
    entries.push([key, value]);
  }

  return Object.fromEntries(entries);
}
