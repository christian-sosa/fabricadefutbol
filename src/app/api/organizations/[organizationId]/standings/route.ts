import { NextResponse } from "next/server";

import { getPublicApiErrorMessage, logPublicApiError } from "@/lib/api-errors";
import { getPlayersWithStats } from "@/lib/queries/public";

const PUBLIC_CACHE_HEADER = "public, s-maxage=60, stale-while-revalidate=300";

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
    const { searchParams } = new URL(request.url);
    const standings = await getPlayersWithStats(organizationId, {
      season: searchParams.get("season") ?? "current"
    });
    return NextResponse.json({
      organizationId,
      standings
    }, {
      headers: {
        "Cache-Control": PUBLIC_CACHE_HEADER
      }
    });
  } catch (error) {
    logPublicApiError("organization standings", error);
    const message = getPublicApiErrorMessage(error, "No se pudo obtener la tabla.");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
