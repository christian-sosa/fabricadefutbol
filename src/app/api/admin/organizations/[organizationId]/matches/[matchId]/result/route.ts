import { NextResponse } from "next/server";
import { z } from "zod";

import { assertOrganizationAdminAction } from "@/lib/auth/admin";
import { saveMatchResult } from "@/lib/domain/match-workflow";
import { toUserMessage } from "@/lib/errors";
import { logError, logInfo, logWarn } from "@/lib/observability/log";
import { refreshOrganizationPublicSnapshotSafe } from "@/lib/queries/public";
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
  const startedAt = Date.now();
  const { organizationId, matchId } = await context.params;
  if (!organizationId || !matchId) {
    logWarn("matches.result.invalid_params", {
      organizationId,
      matchId
    });
    return NextResponse.json({ error: "organizationId y matchId son requeridos." }, { status: 400 });
  }

  try {
    const admin = await assertOrganizationAdminAction(organizationId);
    const body = (await request.json()) as unknown;
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      logWarn("matches.result.invalid_payload", {
        organizationId,
        matchId,
        issue: parsed.error.issues[0]?.message,
        durationMs: Date.now() - startedAt
      });
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

    await refreshOrganizationPublicSnapshotSafe(organizationId);
    logInfo("matches.result.succeeded", {
      organizationId,
      matchId,
      adminId: admin.userId,
      durationMs: Date.now() - startedAt
    });
    return NextResponse.json({
      success: true,
      organizationId,
      matchId
    });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "No se pudo guardar resultado.";
    if (isAuthErrorMessage(rawMessage)) {
      logWarn("matches.result.forbidden", {
        organizationId,
        matchId,
        durationMs: Date.now() - startedAt
      });
      return NextResponse.json({ error: rawMessage }, { status: 403 });
    }
    logError("matches.result.failed", error, {
      organizationId,
      matchId,
      durationMs: Date.now() - startedAt
    });
    return NextResponse.json(
      { error: toUserMessage(error, "No se pudo guardar el resultado del partido.") },
      { status: 500 }
    );
  }
}
