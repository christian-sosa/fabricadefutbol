import { createHash } from "node:crypto";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { RateLimitResult } from "@/lib/rate-limit";

/** Shared across instances. Only a hash of the actor/IP key is persisted. */
export async function checkSharedRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  if (!params.key || !Number.isSafeInteger(params.limit) || params.limit < 1 || params.limit > 10000 ||
      !Number.isSafeInteger(params.windowMs) || params.windowMs < 1000 || params.windowMs > 86400000) {
    throw new Error("Configuración inválida del límite de solicitudes.");
  }
  const unavailable = { allowed: false, remaining: 0, retryAfterMs: 60_000 };
  try {
    const client = createSupabaseAdminClient();
    if (!client) return unavailable;
    const { data, error } = await client.rpc("consume_shared_rate_limit", {
      p_key_hash: createHash("sha256").update(params.key).digest("hex"),
      p_limit: params.limit,
      p_window_ms: params.windowMs
    });
    if (error || !data || typeof data.allowed !== "boolean" ||
        !Number.isFinite(data.remaining) || data.remaining < 0 ||
        !Number.isFinite(data.retryAfterMs) || data.retryAfterMs < 0) {
      console.error("[rate-limit] shared counter unavailable", { code: error?.code ?? "invalid_response" });
      return unavailable;
    }
    return { allowed: data.allowed, remaining: data.remaining, retryAfterMs: data.retryAfterMs };
  } catch {
    console.error("[rate-limit] shared counter unavailable");
    return unavailable;
  }
}
