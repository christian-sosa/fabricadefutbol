import { NextResponse } from "next/server";

import { getPlayersWithStats } from "@/lib/queries/public";

export async function GET(
  _: Request,
  context: {
    params: { organizationId: string };
  }
) {
  const organizationId = context.params.organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: "organizationId es requerido." }, { status: 400 });
  }

  try {
    const standings = await getPlayersWithStats(organizationId);
    return NextResponse.json({
      organizationId,
      standings
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo obtener la tabla.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
