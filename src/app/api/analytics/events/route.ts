import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isClientAnalyticsEventName, sanitizeAnalyticsPath, sanitizeAnalyticsProperties } from "@/lib/analytics/events";
import { ANALYTICS_REFERRAL_COOKIE, ANALYTICS_SESSION_COOKIE, referralSchema } from "@/lib/analytics/attribution";
import { recordAnalyticsEvent } from "@/lib/analytics/server";
import { getClientIpFromHeaders } from "@/lib/rate-limit";
import { checkSharedRateLimit } from "@/lib/shared-rate-limit";

const schema = z.object({ eventName: z.string().max(60), sessionId: z.string().uuid().optional(), source: z.string().max(80).optional(), path: z.string().max(500).nullable().optional(), properties: z.record(z.unknown()).optional() }).strict();
const MAX_BYTES = 8192;
async function readBoundedJson(request: Request) {
  if (Number(request.headers.get("content-length")) > MAX_BYTES) throw new RangeError();
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); throw new RangeError(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(all));
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Origen inválido." }, { status: 403 });
  const limit = await checkSharedRateLimit({ key: `analytics:${getClientIpFromHeaders(request.headers)}`, limit: 60, windowMs: 60_000 });
  if (!limit.allowed) return NextResponse.json({ error: "Demasiados eventos." }, { status: 429, headers: { "retry-after": "60" } });
  let body: unknown;
  try { body = await readBoundedJson(request); } catch (error) {
    return NextResponse.json({ error: error instanceof RangeError ? "Evento demasiado grande." : "JSON inválido." }, { status: error instanceof RangeError ? 413 : 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success || !isClientAnalyticsEventName(parsed.data.eventName)) return NextResponse.json({ error: "Evento inválido." }, { status: 400 });
  const { eventName, sessionId } = parsed.data;
  // Client events describe interaction only. Identity, entity ids and business outcomes are never accepted here.
  const props = sanitizeAnalyticsProperties(Object.fromEntries(Object.entries(parsed.data.properties ?? {}).filter(([key]) => ["cta", "source", "content"].includes(key))));
  const referral = eventName === "referral_visit" && sessionId ? referralSchema.safeParse({ sessionId, source: "whatsapp", content: ["group", "ranking", "match"].includes(String(props.content)) ? props.content : "other" }) : null;
  if (eventName === "referral_visit" && !referral?.success) return NextResponse.json({ error: "Referencia inválida." }, { status: 400 });
  const result = await recordAnalyticsEvent({
    eventName, source: "client", path: sanitizeAnalyticsPath(parsed.data.path),
    eventKey: referral?.success ? `referral_visit:${sessionId}` : null,
    properties: { ...props, ...(sessionId ? { session_id: sessionId } : {}), ...(referral?.success ? { referral_source: "whatsapp", referral_content: referral.data.content } : {}) }
  });
  const response = NextResponse.json({ recorded: result.recorded });
  const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };
  if (sessionId) response.cookies.set(ANALYTICS_SESSION_COOKIE, sessionId, options);
  if (referral?.success) response.cookies.set(ANALYTICS_REFERRAL_COOKIE, JSON.stringify(referral.data), { ...options, maxAge: 30 * 86400 });
  return response;
}
