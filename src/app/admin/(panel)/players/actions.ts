"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assertOrganizationAdminAction, getOrganizationQueryKeyById } from "@/lib/auth/admin";
import { getPlayerPhotosBucket, getSupabaseDbSchema } from "@/lib/env";
import { toUserMessage } from "@/lib/errors";
import { isNextRedirectError } from "@/lib/next-redirect";
import { withOrgQuery } from "@/lib/org";
import {
  assertPlayerPhotoUploadAllowed,
  registerPlayerPhotoUploadEvent
} from "@/lib/player-photo-upload-limits";
import { normalizeSkillLevel } from "@/lib/domain/skill-level";
import {
  getOrganizationPlayerPhotoObjectPath,
  inferPlayerPhotoExtension,
  MAX_PLAYER_PHOTO_SIZE_MB,
  optimizePlayerAvatarImage
} from "@/lib/player-photos";
import { refreshOrganizationPublicSnapshotSafe } from "@/lib/queries/public";
import { REPLACEABLE_IMAGE_UPLOAD_CACHE_CONTROL } from "@/lib/storage-image-responses";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createSchema = z.object({
  organizationId: z.string().uuid(),
  fullName: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  skillLevel: z.coerce.number().int().min(1, "El nivel debe estar entre 1 y 5.").max(5, "El nivel debe estar entre 1 y 5.")
});

const deleteSchema = z.object({
  organizationId: z.string().uuid(),
  deletePlayerId: z.string().uuid()
});

const photoSchema = z.object({
  organizationId: z.string().uuid(),
  playerId: z.string().uuid()
});

const rowSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  skillLevel: z.number().int().min(1, "El nivel debe estar entre 1 y 5.").max(5, "El nivel debe estar entre 1 y 5."),
  currentRating: z.number().positive("El rendimiento debe ser un numero positivo.")
});

function parseDecimalField(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "")
    .trim()
    .replace(",", ".");

  return Number(normalized);
}

function withMessage(organizationId: string, error: string | null) {
  const basePath = withOrgQuery("/admin/players", organizationId);
  if (!error) return basePath;
  const separator = basePath.includes("?") ? "&" : "?";
  return `${basePath}${separator}error=${encodeURIComponent(error)}&refresh=${Date.now()}`;
}

function withSuccess(organizationId: string, success: string | null) {
  const basePath = withOrgQuery("/admin/players", organizationId);
  if (!success) return basePath;
  const separator = basePath.includes("?") ? "&" : "?";
  return `${basePath}${separator}success=${encodeURIComponent(success)}&refresh=${Date.now()}`;
}

function getOptionalPhotoFile(formData: FormData) {
  const file = formData.get("photo");
  return file instanceof File && file.size > 0 ? file : null;
}

function validatePlayerPhotoFile(file: File, organizationQueryKey: string) {
  const sizeLimitBytes = MAX_PLAYER_PHOTO_SIZE_MB * 1024 * 1024;
  if (file.size > sizeLimitBytes) {
    redirect(withMessage(organizationQueryKey, `La imagen no puede superar ${MAX_PLAYER_PHOTO_SIZE_MB} MB.`));
  }

  const extension = inferPlayerPhotoExtension(file);
  if (!extension) {
    redirect(withMessage(organizationQueryKey, "Formato no soportado. Usa JPG, JPEG, PNG o WEBP."));
  }
}

async function savePlayerPhotoForAdmin({
  supabase,
  adminUserId,
  organizationId,
  organizationQueryKey,
  playerId,
  file,
  validatePlayer = true
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  adminUserId: string;
  organizationId: string;
  organizationQueryKey: string;
  playerId: string;
  file: File;
  validatePlayer?: boolean;
}) {
  validatePlayerPhotoFile(file, organizationQueryKey);

  if (validatePlayer) {
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id")
      .eq("id", playerId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (playerError || !player) {
      redirect(withMessage(organizationQueryKey, "No se encontro el jugador en el grupo seleccionado."));
    }
  }

  await assertPlayerPhotoUploadAllowed({
    supabase: supabase as never,
    uploaderId: adminUserId,
    uploaderRole: "organization_admin",
    targetPlayerId: playerId,
    targetType: "organization_player"
  });

  const optimizedBuffer = await optimizePlayerAvatarImage(file);
  const objectPath = getOrganizationPlayerPhotoObjectPath(getSupabaseDbSchema(), organizationId, playerId);
  const bucketName = getPlayerPhotosBucket();
  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(objectPath, optimizedBuffer, {
      upsert: true,
      contentType: "image/webp",
      cacheControl: REPLACEABLE_IMAGE_UPLOAD_CACHE_CONTROL
    });

  if (uploadError) {
    console.error("[players] storage upload failed", {
      organizationId,
      playerId,
      message: uploadError.message
    });
    redirect(withMessage(organizationQueryKey, "No se pudo guardar la foto en Storage. Intenta nuevamente."));
  }

  await registerPlayerPhotoUploadEvent({
    supabase: supabase as never,
    uploaderId: adminUserId,
    uploaderRole: "organization_admin",
    targetPlayerId: playerId,
    targetType: "organization_player"
  });
}

export async function createPlayerAction(formData: FormData) {
  try {
    const parsed = createSchema.safeParse({
      organizationId: formData.get("organizationId"),
      fullName: formData.get("fullName"),
      skillLevel: formData.get("skillLevel")
    });

    if (!parsed.success) {
      redirect(
        withMessage(
          String(formData.get("organizationId") ?? ""),
          parsed.error.issues[0]?.message ?? "Datos invalidos."
        )
      );
    }

    const admin = await assertOrganizationAdminAction(parsed.data.organizationId);
    const organizationQueryKey = await getOrganizationQueryKeyById(parsed.data.organizationId);
    const photoFile = getOptionalPhotoFile(formData);
    if (photoFile) {
      validatePlayerPhotoFile(photoFile, organizationQueryKey);
    }
    const supabase = await createSupabaseServerClient();

    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("id, initial_rank, display_order")
      .eq("organization_id", parsed.data.organizationId)
      .order("initial_rank", { ascending: false });

    if (playersError) {
      redirect(withMessage(organizationQueryKey, playersError.message));
    }

    const existingPlayers = players ?? [];
    const nextInitialRank =
      Math.max(0, ...existingPlayers.map((player) => Number(player.initial_rank) || 0)) + 1;
    const nextDisplayOrder =
      Math.max(
        0,
        ...existingPlayers.map((player) => Number(player.display_order ?? player.initial_rank) || 0)
      ) + 1;

    const { data: createdPlayer, error } = await supabase
      .from("players")
      .insert({
        organization_id: parsed.data.organizationId,
        full_name: parsed.data.fullName,
        initial_rank: nextInitialRank,
        skill_level: normalizeSkillLevel(parsed.data.skillLevel),
        display_order: nextDisplayOrder
      })
      .select("id")
      .single();
    if (error || !createdPlayer) {
      redirect(withMessage(organizationQueryKey, toUserMessage(error, "No se pudo crear al jugador.")));
    }

    if (photoFile) {
      await savePlayerPhotoForAdmin({
        supabase,
        adminUserId: admin.userId,
        organizationId: parsed.data.organizationId,
        organizationQueryKey,
        playerId: createdPlayer.id,
        file: photoFile,
        validatePlayer: false
      });
    }

    await refreshOrganizationPublicSnapshotSafe(parsed.data.organizationId);
    revalidatePath("/admin/players");
    revalidatePath("/players");
    revalidatePath("/ranking");
    revalidatePath("/");
    if (photoFile) {
      revalidatePath(`/players/${createdPlayer.id}`);
      revalidatePath(`/api/player-photo/${createdPlayer.id}`);
    }
    redirect(withSuccess(organizationQueryKey, photoFile ? "Jugador creado correctamente con foto." : "Jugador creado correctamente."));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(withMessage(String(formData.get("organizationId") ?? ""), toUserMessage(error, "Error inesperado al crear jugador.")));
  }
}

export async function bulkUpdatePlayersAction(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");

  try {
    if (!organizationId) {
      redirect(withMessage("", "Falta el grupo activo."));
    }

    await assertOrganizationAdminAction(organizationId);
    const organizationQueryKey = await getOrganizationQueryKeyById(organizationId);

    const playerIds = formData.getAll("playerId").map((value) => String(value));
    const fullNames = formData.getAll("fullName").map((value) => String(value));
    const skillLevels = formData.getAll("skillLevel").map((value) => Number(value));
    const currentRatings = formData.getAll("currentRating").map((value) => parseDecimalField(value));

    if (
      !playerIds.length ||
      playerIds.length !== fullNames.length ||
      playerIds.length !== skillLevels.length ||
      playerIds.length !== currentRatings.length
    ) {
      redirect(withMessage(organizationQueryKey, "La planilla enviada es invalida o incompleta."));
    }

    const rows = playerIds.map((id, index) => {
      const parsedRow = rowSchema.safeParse({
        id,
        fullName: fullNames[index],
        skillLevel: skillLevels[index],
        currentRating: currentRatings[index]
      });

      if (!parsedRow.success) {
        redirect(
          withMessage(
            organizationQueryKey,
            parsedRow.error.issues[0]?.message ?? `No se pudo validar la fila de ${fullNames[index] || "un jugador"}.`
          )
        );
      }

      return parsedRow.data;
    });

    const idsSet = new Set(rows.map((row) => row.id));
    if (idsSet.size !== rows.length) {
      redirect(withMessage(organizationQueryKey, "Hay IDs de jugadores duplicados en la planilla."));
    }

    const supabase = await createSupabaseServerClient();
    const { data: currentPlayers, error: currentPlayersError } = await supabase
      .from("players")
      .select("id")
      .eq("organization_id", organizationId);

    if (currentPlayersError) {
      redirect(withMessage(organizationQueryKey, currentPlayersError.message));
    }

    const currentPlayerIds = new Set((currentPlayers ?? []).map((player) => player.id));
    if (currentPlayerIds.size !== rows.length || rows.some((row) => !currentPlayerIds.has(row.id))) {
      redirect(
        withMessage(
          organizationQueryKey,
          "La planilla cambio mientras editabas. Recarga la pagina y vuelve a intentar."
        )
      );
    }

    for (const row of rows) {
      const { error: saveError } = await supabase
        .from("players")
        .update({
          full_name: row.fullName,
          skill_level: normalizeSkillLevel(row.skillLevel),
          current_rating: Math.round(row.currentRating)
        })
        .eq("id", row.id)
        .eq("organization_id", organizationId);

      if (saveError) {
        redirect(withMessage(organizationQueryKey, saveError.message));
      }
    }

    await refreshOrganizationPublicSnapshotSafe(organizationId);
    revalidatePath("/admin/players");
    revalidatePath("/players");
    revalidatePath("/ranking");
    revalidatePath("/");
    redirect(withSuccess(organizationQueryKey, "Se guardaron todos los cambios de la planilla."));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(withMessage(organizationId, toUserMessage(error, "No se pudo guardar la planilla.")));
  }
}

export async function deletePlayerAction(formData: FormData) {
  try {
    const parsed = deleteSchema.safeParse({
      organizationId: formData.get("organizationId"),
      deletePlayerId: formData.get("deletePlayerId")
    });

    if (!parsed.success) {
      redirect(
        withMessage(
          String(formData.get("organizationId") ?? ""),
          parsed.error.issues[0]?.message ?? "Datos invalidos."
        )
      );
    }

    await assertOrganizationAdminAction(parsed.data.organizationId);
    const organizationQueryKey = await getOrganizationQueryKeyById(parsed.data.organizationId);
    const supabase = await createSupabaseServerClient();

    const { data: playerToDelete, error: playerError } = await supabase
      .from("players")
      .select("id, full_name")
      .eq("id", parsed.data.deletePlayerId)
      .eq("organization_id", parsed.data.organizationId)
      .maybeSingle();

    if (playerError || !playerToDelete) {
      redirect(withMessage(organizationQueryKey, "No se encontro el jugador seleccionado."));
    }

    const { error: deleteError } = await supabase
      .from("players")
      .delete()
      .eq("id", parsed.data.deletePlayerId)
      .eq("organization_id", parsed.data.organizationId);

    if (deleteError) {
      const cannotDeleteDueToHistory = deleteError.code === "23503";
      redirect(
        withMessage(
          organizationQueryKey,
          cannotDeleteDueToHistory
            ? "No se puede eliminar este jugador porque esta vinculado a partidos ya registrados."
            : toUserMessage(deleteError, "No se pudo eliminar el jugador.")
        )
      );
    }

    await refreshOrganizationPublicSnapshotSafe(parsed.data.organizationId);
    revalidatePath("/admin/players");
    revalidatePath("/players");
    revalidatePath("/ranking");
    revalidatePath("/");
    redirect(withSuccess(organizationQueryKey, `Jugador ${playerToDelete.full_name} eliminado.`));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(withMessage(String(formData.get("organizationId") ?? ""), toUserMessage(error, "No se pudo eliminar el jugador.")));
  }
}

export async function uploadPlayerPhotoAction(formData: FormData) {
  try {
    const parsed = photoSchema.safeParse({
      organizationId: formData.get("organizationId"),
      playerId: formData.get("playerId")
    });

    if (!parsed.success) {
      redirect(
        withMessage(
          String(formData.get("organizationId") ?? ""),
          parsed.error.issues[0]?.message ?? "Datos invalidos."
        )
      );
    }

    const admin = await assertOrganizationAdminAction(parsed.data.organizationId);
    const organizationQueryKey = await getOrganizationQueryKeyById(parsed.data.organizationId);

    const file = formData.get("photo");
    if (!(file instanceof File) || file.size <= 0) {
      redirect(withMessage(organizationQueryKey, "Selecciona una imagen para subir."));
    }

    const supabase = await createSupabaseServerClient();
    await savePlayerPhotoForAdmin({
      supabase,
      adminUserId: admin.userId,
      organizationId: parsed.data.organizationId,
      organizationQueryKey,
      playerId: parsed.data.playerId,
      file
    });

    revalidatePath("/admin/players");
    revalidatePath("/players");
    revalidatePath("/ranking");
    revalidatePath(`/players/${parsed.data.playerId}`);
    revalidatePath(`/api/player-photo/${parsed.data.playerId}`);
    redirect(withSuccess(organizationQueryKey, "Foto subida correctamente."));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(withMessage(String(formData.get("organizationId") ?? ""), toUserMessage(error, "No se pudo subir la foto.")));
  }
}
