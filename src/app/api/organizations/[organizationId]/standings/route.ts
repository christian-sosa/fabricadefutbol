import { NextResponse } from "next/server";

import { getPublicApiErrorMessage, logPublicApiError } from "@/lib/api-errors";
import { getPlayersWithStats } from "@/lib/queries/public";
import { logInfo } from "@/lib/observability/log";

const PUBLIC_CACHE_HEADER = "private, no-store";

export async function GET(
  request: Request,
  context: {
    params: Promise<{ organizationId: string }>;
  }
) {
  const { organizationId } = await context.params;
  if (!organizationId) {
    return NextResponse.json({ error: "organizationId es requerido." }, { status: 400 });
  }

  try {
    const startedAt = performance.now();
    const { searchParams } = new URL(request.url);
    const standings = await getPlayersWithStats(organizationId, {
      season: searchParams.get("season") ?? "current"
    });
    const durationMs = Number((performance.now() - startedAt).toFixed(1));
    logInfo("public.standings.read", { durationMs, rowCount: standings.length,
      seasonMode: searchParams.get("season") === "all" ? "all" : "season" });
    return NextResponse.json({
      organizationId,
      standings
    }, {
      headers: {
        "Cache-Control": PUBLIC_CACHE_HEADER,
        "Server-Timing": `group-query;dur=${durationMs}`
      }
    });
  } catch (error) {
    logPublicApiError("organization standings", error);
    const message = getPublicApiErrorMessage(error, "No se pudo obtener la tabla.");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
