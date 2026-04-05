import { NextResponse } from "next/server";

import { getMatchHistoryCards } from "@/lib/queries/public";

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
    const matches = await getMatchHistoryCards(organizationId);
    return NextResponse.json({
      organizationId,
      matches
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo obtener el historial.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
