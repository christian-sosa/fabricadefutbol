import { headers } from "next/headers";

import {
  checkRateLimit,
  getClientIpFromHeaders,
  type RateLimitResult
} from "@/lib/rate-limit";

const DEFAULT_WINDOW_MS = 60 * 60 * 1000;

export const ACTION_RATE_LIMITS = {
  createOrganization: {
    limit: 3,
    windowMs: DEFAULT_WINDOW_MS
  },
  inviteOrganizationAdmin: {
    limit: 8,
    windowMs: DEFAULT_WINDOW_MS
  }
} as const;

function normalizeKeySegment(value: string | null | undefined, fallback: string) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || fallback;
}

export function buildActionRateLimitKey(params: {
  scope: string;
  actorId?: string | null;
  organizationId?: string | null;
  clientIp?: string | null;
}) {
  return [
    "action",
    normalizeKeySegment(params.scope, "unknown"),
    normalizeKeySegment(params.actorId, "anonymous"),
    normalizeKeySegment(params.organizationId, "global"),
    normalizeKeySegment(params.clientIp, "unknown")
  ].join(":");
}

export function formatActionRateLimitMessage(result: Pick<RateLimitResult, "retryAfterMs">) {
  const retryAfterMs = Math.max(0, result.retryAfterMs);
  if (retryAfterMs >= 60_000) {
    const minutes = Math.max(1, Math.ceil(retryAfterMs / 60_000));
    return `Demasiados intentos seguidos. Volve a probar en ${minutes} ${minutes === 1 ? "minuto" : "minutos"}.`;
  }

  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return `Demasiados intentos seguidos. Volve a probar en ${seconds} ${seconds === 1 ? "segundo" : "segundos"}.`;
}

export async function checkActionRateLimit(params: {
  scope: string;
  actorId?: string | null;
  organizationId?: string | null;
  limit: number;
  windowMs: number;
}) {
  const headerStore = await headers();
  const clientIp = getClientIpFromHeaders(headerStore);

  return checkRateLimit({
    key: buildActionRateLimitKey({
      scope: params.scope,
      actorId: params.actorId,
      organizationId: params.organizationId,
      clientIp
    }),
    limit: params.limit,
    windowMs: params.windowMs
  });
}
