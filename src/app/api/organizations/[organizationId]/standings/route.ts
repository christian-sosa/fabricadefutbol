import { NextResponse } from "next/server";

import { getPlayersWithStats } from "@/lib/queries/public";

const PUBLIC_CACHE_HEADER = "public, s-maxage=60, stale-while-revalidate=300";

export async function GET(
  _: Request,
  context: {
    params: Promise<{ organizationId: string }>;
  }
) {
  const { organizationId } = await context.params;
  if (!organizationId) {
    return NextResponse.json({ error: "organizationId es requerido." }, { status: 400 });
  }

  try {
    const standings = await getPlayersWithStats(organizationId);
    return NextResponse.json({
      organizationId,
      standings
    }, {
      headers: {
        "Cache-Control": PUBLIC_CACHE_HEADER
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo obtener la tabla.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
