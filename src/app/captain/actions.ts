"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assertCaptainTeamAction } from "@/lib/auth/captains";
import { getTournamentSlugById } from "@/lib/auth/tournaments";
import { MAX_TOURNAMENT_PLAYERS_PER_TEAM } from "@/lib/constants";
import { getPlayerPhotosBucket, getSupabaseDbSchema } from "@/lib/env";
import { toUserMessage } from "@/lib/errors";
import { isNextRedirectError } from "@/lib/next-redirect";
import {
  getTournamentPlayerPhotoObjectPath,
  inferPlayerPhotoExtension,
  MAX_PLAYER_PHOTO_SIZE_MB,
  optimizePlayerAvatarImage
} from "@/lib/player-photos";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const captainPlayerSchema = z.object({
  tournamentId: z.string().uuid(),
  teamId: z.string().uuid(),
  fullName: z.string().min(2, "El jugador debe tener al menos 2 caracteres.").max(80),
  shirtNumber: z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? Number(value) : null),
    z.number().int().positive().max(99).nullable()
  ),
  position: z.string().max(30).optional()
});

const captainPlayerUpdateSchema = captainPlayerSchema.extend({
  playerId: z.string().uuid()
});

const captainPlayerDeleteSchema = z.object({
  tournamentId: z.string().uuid(),
  teamId: z.string().uuid(),
  playerId: z.string().uuid()
});

const captainPlayerPhotoSchema = z.object({
  tournamentId: z.string().uuid(),
  teamId: z.string().uuid(),
  playerId: z.string().uuid()
});

function buildCaptainPanelPath(params: {
  tournamentId: string;
  teamId: string;
  error?: string;
  success?: string;
}) {
  const searchParams = new URLSearchParams({
    tournament: params.tournamentId,
    team: params.teamId
  });
  if (params.error) searchParams.set("error", params.error);
  if (params.success) searchParams.set("success", params.success);
  return `/captain?${searchParams.toString()}`;
}

async function revalidateCaptainPaths(tournamentId: string) {
  const tournamentSlug = await getTournamentSlugById(tournamentId);
  revalidatePath("/captain");
  revalidatePath("/tournaments");
  revalidatePath(`/tournaments/${tournamentSlug}`);
}

async function assertCaptainTeamPlayerCapacity(params: {
  tournamentId: string;
  teamId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("tournament_players")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", params.tournamentId)
    .eq("team_id", params.teamId);

  if (error) {
    throw new Error(error.message);
  }

  if ((count ?? 0) >= MAX_TOURNAMENT_PLAYERS_PER_TEAM) {
    throw new Error(`Cada equipo admite hasta ${MAX_TOURNAMENT_PLAYERS_PER_TEAM} jugadores.`);
  }
}

export async function addCaptainTournamentPlayerAction(formData: FormData) {
  const rawTournamentId = String(formData.get("tournamentId") ?? "");
  const rawTeamId = String(formData.get("teamId") ?? "");

  try {
    const parsed = captainPlayerSchema.safeParse({
      tournamentId: formData.get("tournamentId"),
      teamId: formData.get("teamId"),
      fullName: formData.get("fullName"),
      shirtNumber: formData.get("shirtNumber"),
      position: formData.get("position")
    });

    if (!parsed.success) {
      redirect(
        buildCaptainPanelPath({
          tournamentId: rawTournamentId,
          teamId: rawTeamId,
          error: parsed.error.issues[0]?.message ?? "Datos invalidos."
        })
      );
    }

    await assertCaptainTeamAction({
      tournamentId: parsed.data.tournamentId,
      teamId: parsed.data.teamId
    });
    await assertCaptainTeamPlayerCapacity({
      tournamentId: parsed.data.tournamentId,
      teamId: parsed.data.teamId
    });

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("tournament_players").insert({
      tournament_id: parsed.data.tournamentId,
      team_id: parsed.data.teamId,
      full_name: parsed.data.fullName.trim(),
      shirt_number: parsed.data.shirtNumber,
      position: parsed.data.position?.trim() || null,
      active: true
    });

    if (error) {
      redirect(
        buildCaptainPanelPath({
          tournamentId: parsed.data.tournamentId,
          teamId: parsed.data.teamId,
          error: toUserMessage(error, "No se pudo agregar el jugador.")
        })
      );
    }

    await revalidateCaptainPaths(parsed.data.tournamentId);
    redirect(
      buildCaptainPanelPath({
        tournamentId: parsed.data.tournamentId,
        teamId: parsed.data.teamId,
        success: "Jugador agregado al plantel."
      })
    );
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(
      buildCaptainPanelPath({
        tournamentId: rawTournamentId,
        teamId: rawTeamId,
        error: toUserMessage(error, "No se pudo agregar el jugador.")
      })
    );
  }
}

export async function updateCaptainTournamentPlayerAction(formData: FormData) {
  const rawTournamentId = String(formData.get("tournamentId") ?? "");
  const rawTeamId = String(formData.get("teamId") ?? "");

  try {
    const parsed = captainPlayerUpdateSchema.safeParse({
      tournamentId: formData.get("tournamentId"),
      teamId: formData.get("teamId"),
      playerId: formData.get("playerId"),
      fullName: formData.get("fullName"),
      shirtNumber: formData.get("shirtNumber"),
      position: formData.get("position")
    });

    if (!parsed.success) {
      redirect(
        buildCaptainPanelPath({
          tournamentId: rawTournamentId,
          teamId: rawTeamId,
          error: parsed.error.issues[0]?.message ?? "Datos invalidos."
        })
      );
    }

    await assertCaptainTeamAction({
      tournamentId: parsed.data.tournamentId,
      teamId: parsed.data.teamId
    });

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("tournament_players")
      .update({
        full_name: parsed.data.fullName.trim(),
        shirt_number: parsed.data.shirtNumber,
        position: parsed.data.position?.trim() || null
      })
      .eq("id", parsed.data.playerId)
      .eq("tournament_id", parsed.data.tournamentId)
      .eq("team_id", parsed.data.teamId);

    if (error) {
      redirect(
        buildCaptainPanelPath({
          tournamentId: parsed.data.tournamentId,
          teamId: parsed.data.teamId,
          error: toUserMessage(error, "No se pudo actualizar el jugador.")
        })
      );
    }

    await revalidateCaptainPaths(parsed.data.tournamentId);
    redirect(
      buildCaptainPanelPath({
        tournamentId: parsed.data.tournamentId,
        teamId: parsed.data.teamId,
        success: "Jugador actualizado."
      })
    );
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(
      buildCaptainPanelPath({
        tournamentId: rawTournamentId,
        teamId: rawTeamId,
        error: toUserMessage(error, "No se pudo actualizar el jugador.")
      })
    );
  }
}

export async function deleteCaptainTournamentPlayerAction(formData: FormData) {
  const rawTournamentId = String(formData.get("tournamentId") ?? "");
  const rawTeamId = String(formData.get("teamId") ?? "");

  try {
    const parsed = captainPlayerDeleteSchema.safeParse({
      tournamentId: formData.get("tournamentId"),
      teamId: formData.get("teamId"),
      playerId: formData.get("playerId")
    });

    if (!parsed.success) {
      redirect(
        buildCaptainPanelPath({
          tournamentId: rawTournamentId,
          teamId: rawTeamId,
          error: parsed.error.issues[0]?.message ?? "Falta el jugador a eliminar."
        })
      );
    }

    await assertCaptainTeamAction({
      tournamentId: parsed.data.tournamentId,
      teamId: parsed.data.teamId
    });

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("tournament_players")
      .delete()
      .eq("id", parsed.data.playerId)
      .eq("tournament_id", parsed.data.tournamentId)
      .eq("team_id", parsed.data.teamId);

    if (error) {
      redirect(
        buildCaptainPanelPath({
          tournamentId: parsed.data.tournamentId,
          teamId: parsed.data.teamId,
          error: toUserMessage(error, "No se pudo eliminar el jugador.")
        })
      );
    }

    await revalidateCaptainPaths(parsed.data.tournamentId);
    redirect(
      buildCaptainPanelPath({
        tournamentId: parsed.data.tournamentId,
        teamId: parsed.data.teamId,
        success: "Jugador eliminado del plantel."
      })
    );
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(
      buildCaptainPanelPath({
        tournamentId: rawTournamentId,
        teamId: rawTeamId,
        error: toUserMessage(error, "No se pudo eliminar el jugador.")
      })
    );
  }
}

export async function uploadCaptainTournamentPlayerPhotoAction(formData: FormData) {
  const rawTournamentId = String(formData.get("tournamentId") ?? "");
  const rawTeamId = String(formData.get("teamId") ?? "");

  try {
    const parsed = captainPlayerPhotoSchema.safeParse({
      tournamentId: formData.get("tournamentId"),
      teamId: formData.get("teamId"),
      playerId: formData.get("playerId")
    });

    if (!parsed.success) {
      redirect(
        buildCaptainPanelPath({
          tournamentId: rawTournamentId,
          teamId: rawTeamId,
          error: parsed.error.issues[0]?.message ?? "Datos invalidos."
        })
      );
    }

    await assertCaptainTeamAction({
      tournamentId: parsed.data.tournamentId,
      teamId: parsed.data.teamId
    });

    const file = formData.get("photo");
    if (!(file instanceof File) || file.size <= 0) {
      redirect(
        buildCaptainPanelPath({
          tournamentId: parsed.data.tournamentId,
          teamId: parsed.data.teamId,
          error: "Selecciona una imagen para subir."
        })
      );
    }

    const sizeLimitBytes = MAX_PLAYER_PHOTO_SIZE_MB * 1024 * 1024;
    if (file.size > sizeLimitBytes) {
      redirect(
        buildCaptainPanelPath({
          tournamentId: parsed.data.tournamentId,
          teamId: parsed.data.teamId,
          error: `La imagen no puede superar ${MAX_PLAYER_PHOTO_SIZE_MB} MB.`
        })
      );
    }

    const extension = inferPlayerPhotoExtension(file);
    if (!extension) {
      redirect(
        buildCaptainPanelPath({
          tournamentId: parsed.data.tournamentId,
          teamId: parsed.data.teamId,
          error: "Formato no soportado. Usa JPG, JPEG, PNG o WEBP."
        })
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data: player, error: playerError } = await supabase
      .from("tournament_players")
      .select("id")
      .eq("id", parsed.data.playerId)
      .eq("tournament_id", parsed.data.tournamentId)
      .eq("team_id", parsed.data.teamId)
      .maybeSingle();

    if (playerError || !player) {
      redirect(
        buildCaptainPanelPath({
          tournamentId: parsed.data.tournamentId,
          teamId: parsed.data.teamId,
          error: "No se encontro el jugador dentro de tu equipo."
        })
      );
    }

    const optimizedBuffer = await optimizePlayerAvatarImage(file);
    const objectPath = getTournamentPlayerPhotoObjectPath(
      getSupabaseDbSchema(),
      parsed.data.tournamentId,
      parsed.data.playerId
    );
    const bucketName = getPlayerPhotosBucket();
    const { error: uploadError } = await supabase.storage.from(bucketName).upload(objectPath, optimizedBuffer, {
      upsert: true,
      contentType: "image/webp",
      cacheControl: "31536000"
    });

    if (uploadError) {
      redirect(
        buildCaptainPanelPath({
          tournamentId: parsed.data.tournamentId,
          teamId: parsed.data.teamId,
          error: "No se pudo guardar la foto del jugador."
        })
      );
    }

    await revalidateCaptainPaths(parsed.data.tournamentId);
    revalidatePath(`/api/player-photo/${parsed.data.playerId}`);
    redirect(
      buildCaptainPanelPath({
        tournamentId: parsed.data.tournamentId,
        teamId: parsed.data.teamId,
        success: "Foto actualizada."
      })
    );
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(
      buildCaptainPanelPath({
        tournamentId: rawTournamentId,
        teamId: rawTeamId,
        error: toUserMessage(error, "No se pudo subir la foto.")
      })
    );
  }
}
