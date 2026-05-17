import { NextResponse } from "next/server";

import { getPublicApiErrorMessage, logPublicApiError } from "@/lib/api-errors";
import { getMatchHistoryCardsPage } from "@/lib/queries/public";

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
    const requestedPage = Number(searchParams.get("page") ?? "1");
    const requestedPageSize = Number(searchParams.get("pageSize") ?? "10");
    const page = Number.isFinite(requestedPage) ? requestedPage : 1;
    const pageSize = Number.isFinite(requestedPageSize) ? requestedPageSize : 10;
    const season = searchParams.get("season") ?? "current";

    const result = await getMatchHistoryCardsPage(organizationId, {
      page,
      pageSize,
      season
    });
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": PUBLIC_CACHE_HEADER
      }
    });
  } catch (error) {
    logPublicApiError("organization matches", error);
    const message = getPublicApiErrorMessage(error, "No se pudo obtener el historial.");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
