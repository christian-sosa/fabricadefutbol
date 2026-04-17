/**
 * Rate limit in-memory con ventana deslizante simple.
 *
 * NOTA: Funciona por proceso. En despliegues multi-instancia o serverless
 * con cold starts, provee proteccion "best effort". Si se requiere algo mas
 * robusto, migrar a Upstash Redis o a una tabla con contador en Postgres.
 */

type Bucket = {
  count: number;
  resetAt: number;
};

const BUCKETS_BY_KEY = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;

function pruneIfNeeded(now: number) {
  if (BUCKETS_BY_KEY.size < MAX_BUCKETS) return;
  // Limpieza oportunista cuando el mapa crece: eliminamos expirados.
  for (const [key, bucket] of BUCKETS_BY_KEY) {
    if (bucket.resetAt <= now) BUCKETS_BY_KEY.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export function checkRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  const now = Date.now();
  pruneIfNeeded(now);
  const existing = BUCKETS_BY_KEY.get(params.key);

  if (!existing || existing.resetAt <= now) {
    BUCKETS_BY_KEY.set(params.key, { count: 1, resetAt: now + params.windowMs });
    return { allowed: true, remaining: Math.max(0, params.limit - 1), retryAfterMs: 0 };
  }

  if (existing.count >= params.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, existing.resetAt - now)
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, params.limit - existing.count),
    retryAfterMs: 0
  };
}

export function getClientIpFromHeaders(
  headerStore: { get: (name: string) => string | null } | Headers
): string {
  const forwarded = headerStore.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headerStore.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
