"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { SERVER_ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { recordAnalyticsEvent } from "@/lib/analytics/server";
import { assertOrganizationAdminAction, getOrganizationQueryKeyById } from "@/lib/auth/admin";
import {
  confirmTeamOption,
  regenerateDraftTeamOptions,
  saveConfirmedMatchLineup,
  saveMatchResult
} from "@/lib/domain/match-workflow";
import { parseGuestSkillLevelValue } from "@/lib/domain/skill-level";
import { matchScorersSchema } from "@/lib/domain/match-scorers";
import { matchDateAndTimeToIso, matchIsoToDateInput } from "@/lib/match-datetime";
import { isNextRedirectError } from "@/lib/next-redirect";
import { withOrgQuery } from "@/lib/org";
import { refreshOrganizationPublicSnapshotSafe } from "@/lib/queries/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeTeamLabel, TEAM_LABEL_MAX_LENGTH } from "@/lib/team-labels";

const confirmSchema = z.object({
  optionId: z.string().uuid(),
  teamALabel: z.string().max(TEAM_LABEL_MAX_LENGTH, `El nombre del primer equipo no puede superar ${TEAM_LABEL_MAX_LENGTH} caracteres.`).optional(),
  teamBLabel: z.string().max(TEAM_LABEL_MAX_LENGTH, `El nombre del segundo equipo no puede superar ${TEAM_LABEL_MAX_LENGTH} caracteres.`).optional()
});

const resultSchema = z.object({
  expectedVersion: z.coerce.number().int().nonnegative(),
  scoreA: z.coerce.number().int().nonnegative(),
  scoreB: z.coerce.number().int().nonnegative(),
  notes: z.string().optional(),
  mvpParticipantId: z.string().optional(),
  scorersPayload: z.string().optional(),
  lineupPayload: z.string().optional()
});

const lineupAdjustmentPayloadSchema = z.object({
  expectedVersion: z.coerce.number().int().nonnegative(),
  lineupPayload: z.string().min(1, "La formacion final enviada es invalida.")
});

const guestSkillLevelSchema = z.coerce
  .number()
  .refine(
    (value) => parseGuestSkillLevelValue(value) !== null,
    "Selecciona un nivel equivalente valido para cada invitado."
  );

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
        clientId: z.string().optional(),
        name: z.string().trim().min(1),
        rating: guestSkillLevelSchema,
        team: z.enum(["A", "B"])
      })
    )
    .optional(),
  newPlayers: z
    .array(
      z.object({
        playerId: z.string().uuid(),
        team: z.enum(["A", "B"])
      })
    )
    .optional(),
  absencePenaltyParticipantIds: z.array(z.string().min(1)).optional(),
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
        clientId: z.string().optional(),
        name: z.string().trim().min(1),
        rating: guestSkillLevelSchema,
        team: z.enum(["A", "B"])
      })
    )
    .optional()
});

const updateMatchSchema = z.object({
  scheduledDate: z.string().optional(),
  scheduledTime: z.string().min(1, "La hora es obligatoria."),
  location: z.string().optional()
});

const updateTeamLabelsSchema = z.object({
  teamALabel: z.string().max(TEAM_LABEL_MAX_LENGTH, `El nombre del primer equipo no puede superar ${TEAM_LABEL_MAX_LENGTH} caracteres.`).optional(),
  teamBLabel: z.string().max(TEAM_LABEL_MAX_LENGTH, `El nombre del segundo equipo no puede superar ${TEAM_LABEL_MAX_LENGTH} caracteres.`).optional()
});

function buildPath(matchId: string, organizationKey: string, error?: string) {
  const basePath = withOrgQuery(`/admin/matches/${matchId}`, organizationKey);
  if (!error) return basePath;
  const separator = basePath.includes("?") ? "&" : "?";
  return `${basePath}${separator}error=${encodeURIComponent(error)}`;
}

function buildAdminMatchesPath(organizationKey: string, success?: string) {
  const basePath = withOrgQuery("/admin/matches?view=edit", organizationKey);
  if (!success) return basePath;
  const separator = basePath.includes("?") ? "&" : "?";
  return `${basePath}${separator}success=${encodeURIComponent(success)}`;
}

function buildPublicMatchPath(matchId: string, organizationKey: string) {
  return withOrgQuery(`/matches/${matchId}`, organizationKey);
}

function revalidateMatchPaths(matchId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/matches");
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
      optionId: formData.get("optionId"),
      teamALabel: String(formData.get("teamALabel") ?? ""),
      teamBLabel: String(formData.get("teamBLabel") ?? "")
    });
    if (!parsed.success) {
      redirect(buildPath(matchId, organizationQueryKey, parsed.error.issues[0]?.message ?? "Opcion invalida."));
    }

    const supabase = await createSupabaseServerClient();
    await confirmTeamOption({
      supabase,
      matchId,
      optionId: parsed.data.optionId,
      organizationId,
      teamALabel: normalizeTeamLabel(parsed.data.teamALabel),
      teamBLabel: normalizeTeamLabel(parsed.data.teamBLabel)
    });

    revalidateMatchPaths(matchId);
    redirect(buildPublicMatchPath(matchId, organizationQueryKey));
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
      expectedVersion: formData.get("expectedVersion"),
      scoreA: formData.get("scoreA"),
      scoreB: formData.get("scoreB"),
      notes: formData.get("notes"),
      mvpParticipantId: formData.get("mvpParticipantId"),
      scorersPayload: formData.get("scorersPayload") ?? undefined,
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

    let scorers: z.infer<typeof matchScorersSchema> | undefined;
    if (parsed.data.scorersPayload !== undefined) {
      try { scorers = matchScorersSchema.parse(JSON.parse(parsed.data.scorersPayload)); }
      catch { throw new Error("Revisá los goleadores: usá cantidades enteras positivas y un registro por participante."); }
    }
    const supabase = await createSupabaseServerClient();
    const outcome = await saveMatchResult({
      supabase,
      adminId: admin.userId,
      matchId,
      organizationId,
      resultInput: {
        expectedVersion: parsed.data.expectedVersion,
        scoreA: parsed.data.scoreA,
        scoreB: parsed.data.scoreB,
        notes: parsed.data.notes,
        mvpParticipantId: parsed.data.mvpParticipantId?.trim() || null,
        scorers,
        lineup: parsedLineup
      }
    });

    if (outcome.firstFinished) await recordAnalyticsEvent({
      eventName: SERVER_ANALYTICS_EVENTS.matchFinished,
      source: "server_action",
      adminId: admin.userId,
      organizationId,
      entityType: "match",
      entityId: matchId,
      path: buildPath(matchId, organizationQueryKey),
      properties: {
        scoreA: parsed.data.scoreA,
        scoreB: parsed.data.scoreB
      }
    });

    await refreshOrganizationPublicSnapshotSafe(organizationId);
    revalidateMatchPaths(matchId);
    redirect(buildAdminMatchesPath(organizationQueryKey, "Resultado guardado."));
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
      expectedVersion: formData.get("expectedVersion"),
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
      expectedVersion: parsedPayload.data.expectedVersion,
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
      scheduledDate: String(formData.get("scheduledDate") ?? ""),
      scheduledTime: String(formData.get("scheduledTime") ?? ""),
      location: formData.get("location")
    });

    if (!parsed.success) {
      redirect(buildPath(matchId, organizationQueryKey, parsed.error.issues[0]?.message ?? "Datos invalidos."));
    }

    const supabase = await createSupabaseServerClient();
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("id, status, season_id, scheduled_at, result_version")
      .eq("id", matchId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (matchError) throw new Error(matchError.message);
    if (!match) throw new Error("No se encontro el partido para el grupo seleccionado.");

    const previousDate = matchIsoToDateInput(match.scheduled_at);
    const payload: {
      scheduled_at: string;
      location: string | null;
    } = {
      scheduled_at: matchDateAndTimeToIso(parsed.data.scheduledDate, parsed.data.scheduledTime, previousDate),
      location: parsed.data.location || null
    };

    if (match.status === "finished") {
      const { data: season, error: seasonError } = match.season_id
        ? await supabase.from("organization_seasons").select("starts_at, ends_at")
            .eq("id", match.season_id).eq("organization_id", organizationId).maybeSingle()
        : { data: null, error: null };
      if (seasonError) throw new Error(seasonError.message);
      if (match.season_id && !season) throw new Error("No se encontro la temporada de este partido.");
      const nextDate = matchIsoToDateInput(payload.scheduled_at);
      const startsAt = season?.starts_at ?? `${previousDate.slice(0, 4)}-01-01`;
      const endsAt = season?.ends_at ?? `${previousDate.slice(0, 4)}-12-31`;
      if (nextDate !== previousDate && (nextDate < startsAt || nextDate > endsAt)) {
        throw new Error("La fecha de un partido finalizado debe quedar en la misma temporada.");
      }
    }

    const { data: updated, error } = await supabase
      .from("matches")
      .update(payload)
      .eq("id", matchId)
      .eq("organization_id", organizationId)
      .eq("status", match.status)
      .eq("result_version", match.result_version)
      .select("id")
      .maybeSingle();
    if (error) {
      redirect(buildPath(matchId, organizationQueryKey, error.message));
    }
    if (!updated) throw new Error("El partido cambio mientras lo editabas. Recarga para revisar la ultima version.");

    await refreshOrganizationPublicSnapshotSafe(organizationId);
    revalidateMatchPaths(matchId);
    redirect(buildPath(matchId, organizationQueryKey));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : "No se pudo actualizar partido.";
    redirect(buildPath(matchId, organizationQueryKey, message));
  }
}

export async function updateMatchTeamLabelsAction(matchId: string, organizationId: string, formData: FormData) {
  const organizationQueryKey = await getOrganizationQueryKeyById(organizationId);
  try {
    await assertOrganizationAdminAction(organizationId);
    const parsed = updateTeamLabelsSchema.safeParse({
      teamALabel: normalizeTeamLabel(String(formData.get("teamALabel") ?? "")) ?? undefined,
      teamBLabel: normalizeTeamLabel(String(formData.get("teamBLabel") ?? "")) ?? undefined
    });

    if (!parsed.success) {
      redirect(buildPath(matchId, organizationQueryKey, parsed.error.issues[0]?.message ?? "Datos invalidos."));
    }

    const supabase = await createSupabaseServerClient();
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("id, confirmed_option_id")
      .eq("id", matchId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (matchError) {
      redirect(buildPath(matchId, organizationQueryKey, matchError.message));
    }

    if (!match?.confirmed_option_id) {
      redirect(buildPath(matchId, organizationQueryKey, "Primero confirma una opcion de equipos para nombrarlos."));
    }

    const { error } = await supabase
      .from("matches")
      .update({
        team_a_label: normalizeTeamLabel(parsed.data.teamALabel),
        team_b_label: normalizeTeamLabel(parsed.data.teamBLabel)
      })
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
    const message = error instanceof Error ? error.message : "No se pudieron guardar los nombres de equipos.";
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

    const { data: deletedMatch, error: deleteError } = await supabase
      .from("matches")
      .delete()
      .eq("id", matchId)
      .eq("organization_id", organizationId)
      .in("status", ["draft", "confirmed"])
      .select("id")
      .maybeSingle();
    if (deleteError) {
      redirect(buildPath(matchId, organizationQueryKey, deleteError.message));
    }

    if (!deletedMatch) redirect(buildPath(matchId, organizationQueryKey, "El partido cambio mientras lo editabas. Recarga antes de continuar."));

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
