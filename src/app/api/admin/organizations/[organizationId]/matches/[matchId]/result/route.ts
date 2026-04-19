import { NextResponse } from "next/server";
import { z } from "zod";

import { assertOrganizationAdminAction } from "@/lib/auth/admin";
import { saveMatchResult } from "@/lib/domain/match-workflow";
import { toUserMessage } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  scoreA: z.number().int().nonnegative(),
  scoreB: z.number().int().nonnegative(),
  notes: z.string().optional(),
  lineup: z
    .object({
      assignments: z
        .array(
          z.object({
            participantId: z.string().min(1),
            team: z.enum(["A", "B", "OUT"])
          })
        )
        .min(1),
      newGuests: z
        .array(
          z.object({
            name: z.string().trim().min(1),
            rating: z.number().positive(),
            team: z.enum(["A", "B"])
          })
        )
        .optional(),
      handicapTeam: z.union([z.enum(["A", "B"]), z.null()]).optional()
    })
    .optional()
});

function isAuthErrorMessage(message: string) {
  return /no autorizado|debes iniciar sesion/i.test(message);
}

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ organizationId: string; matchId: string }>;
  }
) {
  const { organizationId, matchId } = await context.params;
  if (!organizationId || !matchId) {
    return NextResponse.json({ error: "organizationId y matchId son requeridos." }, { status: 400 });
  }

  try {
    const admin = await assertOrganizationAdminAction(organizationId);
    const body = (await request.json()) as unknown;
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Payload invalido." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    await saveMatchResult({
      supabase,
      adminId: admin.userId,
      matchId,
      organizationId,
      resultInput: parsed.data
    });

    return NextResponse.json({
      success: true,
      organizationId,
      matchId
    });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "No se pudo guardar resultado.";
    if (isAuthErrorMessage(rawMessage)) {
      return NextResponse.json({ error: rawMessage }, { status: 403 });
    }
    // Log detalle tecnico en servidor; al cliente un mensaje mapeado en espanol.
    console.error("[match-result] PATCH fallo", {
      organizationId,
      matchId,
      message: rawMessage
    });
    return NextResponse.json(
      { error: toUserMessage(error, "No se pudo guardar el resultado del partido.") },
      { status: 500 }
    );
  }
}
