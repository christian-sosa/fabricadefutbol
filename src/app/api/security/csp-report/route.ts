import { NextResponse } from "next/server";
import { checkSharedRateLimit } from "@/lib/shared-rate-limit";
import { getClientIpFromHeaders } from "@/lib/rate-limit";

const MAX_BYTES = 8192;

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return new NextResponse(null, { status: 403 });
  if (Number(request.headers.get("content-length")) > MAX_BYTES) return new NextResponse(null, { status: 413 });
  const limit = await checkSharedRateLimit({ key: `csp-report:${getClientIpFromHeaders(request.headers)}`, limit: 20, windowMs: 60_000 });
  if (!limit.allowed) return new NextResponse(null, { status: 429 });
  const reader = request.body?.getReader();
  if (!reader) return new NextResponse(null, { status: 400 });
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); return new NextResponse(null, { status: 413 }); }
      chunks.push(value);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const report = body?.["csp-report"];
    if (!report || typeof report !== "object") return new NextResponse(null, { status: 400 });
    const directive = String(report["effective-directive"] ?? "");
    if (!/^[a-z-]{1,40}$/.test(directive)) return new NextResponse(null, { status: 400 });
    // Browser reports can contain recovery tokens, private URLs and script text.
    // Keep only directive + origin; never log the incoming report or URL path.
    let blockedOrigin = "other";
    try {
      const blocked = new URL(String(report["blocked-uri"]));
      if (["https:", "http:"].includes(blocked.protocol)) blockedOrigin = blocked.origin.slice(0, 200);
    } catch {
      if (["inline", "eval", "data", "blob"].includes(report["blocked-uri"])) blockedOrigin = report["blocked-uri"];
    }
    console.info("[security] csp report", { directive, blockedOrigin });
    return new NextResponse(null, { status: 204 });
  } catch { return new NextResponse(null, { status: 400 }); }
  finally { reader.releaseLock(); }
}
