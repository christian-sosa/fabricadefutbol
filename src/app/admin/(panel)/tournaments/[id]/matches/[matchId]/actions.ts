"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assertTournamentMembershipAction, getTournamentSlugById } from "@/lib/auth/tournaments";
import { saveTournamentMatchSheet } from "@/lib/domain/tournament-workflow";
import { toUserMessage } from "@/lib/errors";
import { isNextRedirectError } from "@/lib/next-redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TournamentMatchSheetInput } from "@/types/domain";

const matchSheetSchema = z.object({
  mvpEntryKey: z.string().min(1, "Debes seleccionar la figura del partido."),
  stats: z
    .array(
      z.object({
        entryKey: z.string().min(1),
        teamId: z.string().uuid(),
        playerId: z.string().uuid().nullable().optional(),
        playerName: z.string().min(1, "Cada fila debe tener nombre."),
        goals: z.coerce.number().int().min(0),
        yellowCards: z.coerce.number().int().min(0),
        redCards: z.coerce.number().int().min(0)
      })
    )
    .min(1, "Debes cargar al menos una fila en el acta.")
});

function buildMatchSheetPath(params: {
  tournamentId: string;
  matchId: string;
  error?: string;
  success?: string;
}) {
  const basePath = `/admin/tournaments/${params.tournamentId}/matches/${params.matchId}`;
  const searchParams = new URLSearchParams();
  if (params.error) searchParams.set("error", params.error);
  if (params.success) searchParams.set("success", params.success);
  const search = searchParams.toString();
  return search ? `${basePath}?${search}` : basePath;
}

export async function saveTournamentMatchSheetAction(
  tournamentId: string,
  matchId: string,
  formData: FormData
) {
  try {
    const admin = await assertTournamentMembershipAction(tournamentId);
    const payloadRaw = String(formData.get("sheetPayload") ?? "");
    if (!payloadRaw) {
      redirect(buildMatchSheetPath({ tournamentId, matchId, error: "Falta el payload del acta." }));
    }

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(payloadRaw);
    } catch {
      redirect(buildMatchSheetPath({ tournamentId, matchId, error: "El acta enviada es invalida." }));
    }

    const normalizedPayload = matchSheetSchema.safeParse(parsedPayload);
    if (!normalizedPayload.success) {
      redirect(
        buildMatchSheetPath({
          tournamentId,
          matchId,
          error: normalizedPayload.error.issues[0]?.message ?? "El acta enviada es invalida."
        })
      );
    }

    const homeScore = Number(formData.get("homeScore"));
    const awayScore = Number(formData.get("awayScore"));
    const notesValue = String(formData.get("notes") ?? "");
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
      redirect(buildMatchSheetPath({ tournamentId, matchId, error: "El marcador enviado es invalido." }));
    }

    const input: TournamentMatchSheetInput = {
      homeScore,
      awayScore,
      notes: notesValue,
      mvpEntryKey: normalizedPayload.data.mvpEntryKey,
      stats: normalizedPayload.data.stats
    };

    const supabase = await createSupabaseServerClient();
    await saveTournamentMatchSheet({
      supabase: supabase as never,
      adminId: admin.userId,
      tournamentId,
      matchId,
      input
    });

    const slug = await getTournamentSlugById(tournamentId);
    revalidatePath(`/admin/tournaments/${tournamentId}`);
    revalidatePath(`/admin/tournaments/${tournamentId}/matches/${matchId}`);
    revalidatePath(`/tournaments/${slug}`);
    revalidatePath(`/tournaments/${slug}/matches/${matchId}`);
    redirect(buildMatchSheetPath({ tournamentId, matchId, success: "Acta guardada correctamente." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(
      buildMatchSheetPath({
        tournamentId,
        matchId,
        error: toUserMessage(error, "No se pudo guardar el acta.")
      })
    );
  }
}
