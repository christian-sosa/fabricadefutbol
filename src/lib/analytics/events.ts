import { GROWTH_EVENTS, type GrowthEventName } from "@/lib/growth";

export const SERVER_ANALYTICS_EVENTS = {
  adminLoginSucceeded: "admin_login_succeeded",
  adminOauthLoginSucceeded: "admin_oauth_login_succeeded",
  adminRegisterSucceeded: "admin_register_succeeded",
  matchFinished: "match_finished",
  superMetricsExported: "super_metrics_exported"
} as const;
export const CLIENT_ANALYTICS_EVENTS = [GROWTH_EVENTS.ctaClicked, GROWTH_EVENTS.groupShared, GROWTH_EVENTS.matchShared, GROWTH_EVENTS.playersPageOpened, GROWTH_EVENTS.rankingShared, GROWTH_EVENTS.signupStarted, GROWTH_EVENTS.referralVisit] as const;
export type ClientAnalyticsEventName = (typeof CLIENT_ANALYTICS_EVENTS)[number];
export type ServerAnalyticsEventName = (typeof SERVER_ANALYTICS_EVENTS)[keyof typeof SERVER_ANALYTICS_EVENTS];
export type AnalyticsEventName = GrowthEventName | ServerAnalyticsEventName;
export type AnalyticsPropertyValue = string | number | boolean;
export type AnalyticsProperties = Record<string, AnalyticsPropertyValue>;
const EVENT_NAMES = new Set<string>([...Object.values(GROWTH_EVENTS), ...Object.values(SERVER_ANALYTICS_EVENTS)]);
const CLIENT_NAMES = new Set<string>(CLIENT_ANALYTICS_EVENTS);
export function isAnalyticsEventName(value: string | null | undefined): value is AnalyticsEventName { return Boolean(value && EVENT_NAMES.has(value)); }
export function isClientAnalyticsEventName(value: string | null | undefined): value is ClientAnalyticsEventName { return Boolean(value && CLIENT_NAMES.has(value)); }
const SENSITIVE_KEY = /email|mail|password|pass|token|secret|key|cookie|authorization|phone|telefono/i;
const SENSITIVE_VALUE = /[^\s@]+@[^\s@]+\.[^\s@]+|bearer\s|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/i;
const STATIC_PATHS = new Set(["/", "/groups", "/ranking", "/matches", "/upcoming", "/players", "/guides", "/help", "/about", "/pricing", "/feedback", "/privacy", "/terms", "/demo", "/admin", "/admin/login", "/admin/forgot-password", "/admin/reset-password", "/admin/players", "/admin/admins", "/admin/new", "/admin/matches", "/admin/matches/new", "/admin/super", "/auth/callback", "/auth/confirm", "/auth/confirm-email", "/auth/recovery", "/api/admin/super-metrics/export"]);

export function sanitizeAnalyticsPath(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const pathname = new URL(value, "https://local.invalid").pathname.replace(/\/$/, "") || "/";
    if (STATIC_PATHS.has(pathname)) return pathname;
    if (/^\/invite\/[^/]+$/.test(pathname)) return "/invite/:token";
    if (/^\/players\/[^/]+$/.test(pathname)) return "/players/:id";
    if (/^\/matches\/[^/]+$/.test(pathname)) return "/matches/:id";
    if (/^\/guides\/[^/]+$/.test(pathname)) return "/guides/:slug";
    if (/^\/admin\/matches\/[^/]+(?:\/result)?$/.test(pathname)) return pathname.endsWith("/result") ? "/admin/matches/:id/result" : "/admin/matches/:id";
    if (/^\/api\/admin\/organizations\/[^/]+\/matches\/[^/]+\/result$/.test(pathname)) return "/api/admin/organizations/:id/matches/:id/result";
    return "/other";
  } catch { return null; }
}

function sanitizeValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    const text = value.trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text);
    if (SENSITIVE_VALUE.test(text) || (!isUuid && /^\+?[\d ()-]{9,}$/.test(text))) return "[redacted]";
    if (/^(?:https?:\/\/|\/)/i.test(text)) return sanitizeAnalyticsPath(text);
    return text.slice(0, 240);
  }
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : undefined;
  if (typeof value !== "object" || depth >= 4 || seen.has(value)) return undefined;
  seen.add(value);
  if (Array.isArray(value)) return value.slice(0, 10).map((item) => sanitizeValue(item, depth + 1, seen)).filter((item) => item !== undefined);
  const safe: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value).slice(0, 20)) {
    if (SENSITIVE_KEY.test(key) || key === "__proto__" || key === "constructor" || key === "prototype") continue;
    const sanitized = sanitizeValue(item, depth + 1, seen);
    if (sanitized !== undefined) safe[key.replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 80)] = sanitized;
  }
  return safe;
}

export function sanitizeAnalyticsProperties(properties: Record<string, unknown> | null | undefined): AnalyticsProperties {
  if (!properties) return {};
  const clean = sanitizeValue(properties, 0, new WeakSet()) as Record<string, unknown> | undefined;
  return Object.fromEntries(Object.entries(clean ?? {}).map(([key, value]) => [key, typeof value === "object" ? JSON.stringify(value).slice(0, 240) : value])) as AnalyticsProperties;
}
