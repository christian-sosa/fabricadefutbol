"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assertOrganizationAdminAction, getOrganizationQueryKeyById } from "@/lib/auth/admin";
import {
  confirmTeamOption,
  regenerateDraftTeamOptions,
  saveConfirmedMatchLineup,
  saveMatchResult
} from "@/lib/domain/match-workflow";
import { datetimeLocalToMatchIso } from "@/lib/match-datetime";
import { isNextRedirectError } from "@/lib/next-redirect";
import { withOrgQuery } from "@/lib/org";
import { refreshOrganizationPublicSnapshotSafe } from "@/lib/queries/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const confirmSchema = z.object({
  optionId: z.string().uuid()
});

const resultSchema = z.object({
  scoreA: z.coerce.number().int().nonnegative(),
  scoreB: z.coerce.number().int().nonnegative(),
  notes: z.string().optional(),
  lineupPayload: z.string().optional()
});

const lineupAdjustmentPayloadSchema = z.object({
  lineupPayload: z.string().min(1, "La formacion final enviada es invalida.")
});

const lineupSchema = z.object({
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
        rating: z.coerce.number().positive(),
        team: z.enum(["A", "B"])
      })
    )
    .optional(),
  handicapTeam: z.union([z.enum(["A", "B"]), z.null()]).optional()
});

const lineupAdjustmentSchema = z.object({
  assignments: z
    .array(
      z.object({
        participantId: z.string().min(1),
        team: z.enum(["A", "B", "OUT"])
      })
    )
    .min(1),
  newPlayers: z
    .array(
      z.object({
        playerId: z.string().uuid(),
        team: z.enum(["A", "B"])
      })
    )
    .optional(),
  newGuests: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        rating: z.coerce.number().positive(),
        team: z.enum(["A", "B"])
      })
    )
    .optional()
});

const updateMatchSchema = z.object({
  scheduledAt: z.string().min(1, "La fecha es obligatoria."),
  location: z.string().optional(),
  status: z.enum(["draft", "confirmed", "finished", "cancelled"])
});

function buildPath(matchId: string, organizationKey: string, error?: string) {
  const basePath = withOrgQuery(`/admin/matches/${matchId}`, organizationKey);
  if (!error) return basePath;
  const separator = basePath.includes("?") ? "&" : "?";
  return `${basePath}${separator}error=${encodeURIComponent(error)}`;
}

function revalidateMatchPaths(matchId: string) {
  revalidatePath("/admin");
  revalidatePath(`/admin/matches/${matchId}`);
  revalidatePath("/matches");
  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/upcoming");
  revalidatePath("/players");
  revalidatePath("/ranking");
}

export async function regenerateOptionsAction(matchId: string, organizationId: string) {
  const organizationQueryKey = await getOrganizationQueryKeyById(organizationId);
  try {
    const admin = await assertOrganizationAdminAction(organizationId);
    const supabase = await createSupabaseServerClient();
    await regenerateDraftTeamOptions({
      supabase,
      adminId: admin.userId,
      matchId,
      organizationId
    });
    revalidateMatchPaths(matchId);
    redirect(buildPath(matchId, organizationQueryKey));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : "No se pudo regenerar equipos.";
    redirect(buildPath(matchId, organizationQueryKey, message));
  }
}

export async function confirmOptionAction(matchId: string, organizationId: string, formData: FormData) {
  const organizationQueryKey = await getOrganizationQueryKeyById(organizationId);
  try {
    await assertOrganizationAdminAction(organizationId);
    const parsed = confirmSchema.safeParse({
      optionId: formData.get("optionId")
    });
    if (!parsed.success) {
      redirect(buildPath(matchId, organizationQueryKey, parsed.error.issues[0]?.message ?? "Opcion invalida."));
    }

    const supabase = await createSupabaseServerClient();
    await confirmTeamOption({
      supabase,
      matchId,
      optionId: parsed.data.optionId,
      organizationId
    });

    revalidateMatchPaths(matchId);
    redirect(buildPath(matchId, organizationQueryKey));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : "No se pudo confirmar la opcion.";
    redirect(buildPath(matchId, organizationQueryKey, message));
  }
}

export async function saveResultAction(matchId: string, organizationId: string, formData: FormData) {
  const organizationQueryKey = await getOrganizationQueryKeyById(organizationId);
  try {
    const admin = await assertOrganizationAdminAction(organizationId);
    const parsed = resultSchema.safeParse({
      scoreA: formData.get("scoreA"),
      scoreB: formData.get("scoreB"),
      notes: formData.get("notes"),
      lineupPayload: formData.get("lineupPayload")
    });
    if (!parsed.success) {
      redirect(buildPath(matchId, organizationQueryKey, parsed.error.issues[0]?.message ?? "Resultado invalido."));
    }

    let parsedLineup: z.infer<typeof lineupSchema> | undefined;
    if (parsed.data.lineupPayload) {
      let rawPayload: unknown;
      try {
        rawPayload = JSON.parse(parsed.data.lineupPayload);
      } catch {
        redirect(buildPath(matchId, organizationQueryKey, "La formacion final enviada es invalida."));
      }

      const parsedPayload = lineupSchema.safeParse(rawPayload);
      if (!parsedPayload.success) {
        redirect(
          buildPath(
            matchId,
            organizationQueryKey,
            parsedPayload.error.issues[0]?.message ?? "La formacion final enviada es invalida."
          )
        );
      }
      parsedLineup = parsedPayload.data;
    }

    const supabase = await createSupabaseServerClient();
    await saveMatchResult({
      supabase,
      adminId: admin.userId,
      matchId,
      organizationId,
      resultInput: {
        scoreA: parsed.data.scoreA,
        scoreB: parsed.data.scoreB,
        notes: parsed.data.notes,
        lineup: parsedLineup
      }
    });

    await refreshOrganizationPublicSnapshotSafe(organizationId);
    revalidateMatchPaths(matchId);
    redirect(buildPath(matchId, organizationQueryKey));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : "No se pudo guardar resultado.";
    redirect(buildPath(matchId, organizationQueryKey, message));
  }
}

export async function saveLineupBeforeResultAction(
  matchId: string,
  organizationId: string,
  formData: FormData
) {
  const organizationQueryKey = await getOrganizationQueryKeyById(organizationId);
  try {
    await assertOrganizationAdminAction(organizationId);
    const parsedPayload = lineupAdjustmentPayloadSchema.safeParse({
      lineupPayload: formData.get("lineupPayload")
    });
    if (!parsedPayload.success) {
      redirect(
        buildPath(
          matchId,
          organizationQueryKey,
          parsedPayload.error.issues[0]?.message ?? "La formacion final enviada es invalida."
        )
      );
    }

    let rawPayload: unknown;
    try {
      rawPayload = JSON.parse(parsedPayload.data.lineupPayload);
    } catch {
      redirect(buildPath(matchId, organizationQueryKey, "La formacion final enviada es invalida."));
    }

    const parsedLineup = lineupAdjustmentSchema.safeParse(rawPayload);
    if (!parsedLineup.success) {
      redirect(
        buildPath(
          matchId,
          organizationQueryKey,
          parsedLineup.error.issues[0]?.message ?? "La formacion final enviada es invalida."
        )
      );
    }

    const supabase = await createSupabaseServerClient();
    await saveConfirmedMatchLineup({
      supabase,
      matchId,
      organizationId,
      lineupInput: parsedLineup.data
    });

    revalidateMatchPaths(matchId);
    redirect(buildPath(matchId, organizationQueryKey));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : "No se pudo guardar la formacion final.";
    redirect(buildPath(matchId, organizationQueryKey, message));
  }
}

export async function updateMatchAction(matchId: string, organizationId: string, formData: FormData) {
  const organizationQueryKey = await getOrganizationQueryKeyById(organizationId);
  try {
    await assertOrganizationAdminAction(organizationId);
    const parsed = updateMatchSchema.safeParse({
      scheduledAt: formData.get("scheduledAt"),
      location: formData.get("location"),
      status: formData.get("status")
    });

    if (!parsed.success) {
      redirect(buildPath(matchId, organizationQueryKey, parsed.error.issues[0]?.message ?? "Datos invalidos."));
    }

    const supabase = await createSupabaseServerClient();
    const payload: {
      scheduled_at: string;
      location: string | null;
      status: "draft" | "confirmed" | "finished" | "cancelled";
      finished_at?: string | null;
    } = {
      scheduled_at: datetimeLocalToMatchIso(parsed.data.scheduledAt),
      location: parsed.data.location || null,
      status: parsed.data.status
    };

    if (parsed.data.status === "finished") {
      payload.finished_at = new Date().toISOString();
    }

    if (parsed.data.status === "cancelled") {
      payload.finished_at = null;
    }

    const { error } = await supabase
      .from("matches")
      .update(payload)
      .eq("id", matchId)
      .eq("organization_id", organizationId);
    if (error) {
      redirect(buildPath(matchId, organizationQueryKey, error.message));
    }

    await refreshOrganizationPublicSnapshotSafe(organizationId);
    revalidateMatchPaths(matchId);
    redirect(buildPath(matchId, organizationQueryKey));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : "No se pudo actualizar partido.";
    redirect(buildPath(matchId, organizationQueryKey, message));
  }
}

export async function deleteMatchAction(matchId: string, organizationId: string) {
  const organizationQueryKey = await getOrganizationQueryKeyById(organizationId);
  try {
    await assertOrganizationAdminAction(organizationId);

    const supabase = await createSupabaseServerClient();
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("id, status")
      .eq("id", matchId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (matchError) {
      redirect(buildPath(matchId, organizationQueryKey, matchError.message));
    }

    if (!match) {
      redirect(buildPath(matchId, organizationQueryKey, "No se encontro el partido."));
    }

    const isDraft = match.status === "draft";
    const isConfirmed = match.status === "confirmed";
    if (!isDraft && !isConfirmed) {
      redirect(buildPath(matchId, organizationQueryKey, "Solo puedes borrar partidos en borrador o confirmados sin jugar."));
    }

    if (isConfirmed) {
      const { data: result, error: resultError } = await supabase
        .from("match_result")
        .select("id")
        .eq("match_id", matchId)
        .maybeSingle();

      if (resultError) {
        redirect(buildPath(matchId, organizationQueryKey, resultError.message));
      }

      if (result) {
        redirect(buildPath(matchId, organizationQueryKey, "No puedes borrar un partido confirmado que ya tiene resultado."));
      }
    }

    const { error: deleteError } = await supabase
      .from("matches")
      .delete()
      .eq("id", matchId)
      .eq("organization_id", organizationId);
    if (deleteError) {
      redirect(buildPath(matchId, organizationQueryKey, deleteError.message));
    }

    await refreshOrganizationPublicSnapshotSafe(organizationId);
    revalidatePath("/admin");
    revalidatePath("/matches");
    revalidatePath("/upcoming");
    revalidatePath("/players");
    revalidatePath("/ranking");
    redirect(withOrgQuery("/admin", organizationQueryKey));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : "No se pudo borrar partido.";
    redirect(buildPath(matchId, organizationQueryKey, message));
  }
}
