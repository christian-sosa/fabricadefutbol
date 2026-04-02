"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assertAdminAction } from "@/lib/auth/admin";
import { confirmTeamOption, regenerateDraftTeamOptions, saveMatchResult } from "@/lib/domain/match-workflow";
import { isNextRedirectError } from "@/lib/next-redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const confirmSchema = z.object({
  optionId: z.string().uuid()
});

const resultSchema = z.object({
  scoreA: z.coerce.number().int().nonnegative(),
  scoreB: z.coerce.number().int().nonnegative(),
  notes: z.string().optional()
});

const updateMatchSchema = z.object({
  scheduledAt: z.string().min(1, "La fecha es obligatoria."),
  location: z.string().optional(),
  status: z.enum(["draft", "confirmed", "finished", "cancelled"])
});

function buildPath(matchId: string, error?: string) {
  if (!error) return `/admin/matches/${matchId}`;
  return `/admin/matches/${matchId}?error=${encodeURIComponent(error)}`;
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

export async function regenerateOptionsAction(matchId: string) {
  try {
    const admin = await assertAdminAction();
    const supabase = await createSupabaseServerClient();
    await regenerateDraftTeamOptions({
      supabase,
      adminId: admin.userId,
      matchId
    });
    revalidateMatchPaths(matchId);
    redirect(buildPath(matchId));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : "No se pudo regenerar equipos.";
    redirect(buildPath(matchId, message));
  }
}

export async function confirmOptionAction(matchId: string, formData: FormData) {
  try {
    await assertAdminAction();
    const parsed = confirmSchema.safeParse({
      optionId: formData.get("optionId")
    });
    if (!parsed.success) {
      redirect(buildPath(matchId, parsed.error.issues[0]?.message ?? "Opción inválida."));
    }

    const supabase = await createSupabaseServerClient();
    await confirmTeamOption({
      supabase,
      matchId,
      optionId: parsed.data.optionId
    });

    revalidateMatchPaths(matchId);
    redirect(buildPath(matchId));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : "No se pudo confirmar la opción.";
    redirect(buildPath(matchId, message));
  }
}

export async function saveResultAction(matchId: string, formData: FormData) {
  try {
    const admin = await assertAdminAction();
    const parsed = resultSchema.safeParse({
      scoreA: formData.get("scoreA"),
      scoreB: formData.get("scoreB"),
      notes: formData.get("notes")
    });
    if (!parsed.success) {
      redirect(buildPath(matchId, parsed.error.issues[0]?.message ?? "Resultado inválido."));
    }

    const supabase = await createSupabaseServerClient();
    await saveMatchResult({
      supabase,
      adminId: admin.userId,
      matchId,
      resultInput: {
        scoreA: parsed.data.scoreA,
        scoreB: parsed.data.scoreB,
        notes: parsed.data.notes
      }
    });

    revalidateMatchPaths(matchId);
    redirect(buildPath(matchId));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : "No se pudo guardar resultado.";
    redirect(buildPath(matchId, message));
  }
}

export async function updateMatchAction(matchId: string, formData: FormData) {
  try {
    await assertAdminAction();
    const parsed = updateMatchSchema.safeParse({
      scheduledAt: formData.get("scheduledAt"),
      location: formData.get("location"),
      status: formData.get("status")
    });

    if (!parsed.success) {
      redirect(buildPath(matchId, parsed.error.issues[0]?.message ?? "Datos inválidos."));
    }

    const supabase = await createSupabaseServerClient();
    const payload: {
      scheduled_at: string;
      location: string | null;
      status: "draft" | "confirmed" | "finished" | "cancelled";
      finished_at?: string | null;
    } = {
      scheduled_at: new Date(parsed.data.scheduledAt).toISOString(),
      location: parsed.data.location || null,
      status: parsed.data.status
    };

    if (parsed.data.status === "finished") {
      payload.finished_at = new Date().toISOString();
    }

    if (parsed.data.status === "cancelled") {
      payload.finished_at = null;
    }

    const { error } = await supabase.from("matches").update(payload).eq("id", matchId);
    if (error) {
      redirect(buildPath(matchId, error.message));
    }

    revalidateMatchPaths(matchId);
    redirect(buildPath(matchId));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : "No se pudo actualizar partido.";
    redirect(buildPath(matchId, message));
  }
}
