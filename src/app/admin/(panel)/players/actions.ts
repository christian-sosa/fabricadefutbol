"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { z } from "zod";

import { assertOrganizationAdminAction, getOrganizationQueryKeyById } from "@/lib/auth/admin";
import { getPlayerPhotosBucket, getSupabaseDbSchema } from "@/lib/env";
import { isNextRedirectError } from "@/lib/next-redirect";
import { withOrgQuery } from "@/lib/org";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createSchema = z.object({
  organizationId: z.string().uuid(),
  fullName: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  initialRank: z.coerce.number().int().positive().max(999)
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
  fullName: z.string().min(3),
  initialRank: z.number().int().positive(),
  currentRating: z.number().positive(),
  active: z.boolean()
});

const MAX_PHOTO_SIZE_MB = 20;
const PLAYER_AVATAR_SIZE_PX = 400;
const PLAYER_AVATAR_QUALITY = 80;

const CONTENT_TYPE_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

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

function inferFileExtension(file: File) {
  if (file.type in CONTENT_TYPE_EXTENSION) {
    return CONTENT_TYPE_EXTENSION[file.type] as keyof typeof CONTENT_TYPE_EXTENSION;
  }

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  if (["jpg", "jpeg", "png", "webp"].includes(ext)) return ext;
  return null;
}

function getPlayerPhotoObjectPath(schema: string, organizationId: string, playerId: string) {
  return `${schema}/${organizationId}/${playerId}.webp`;
}

async function optimizePlayerAvatarImage(file: File) {
  const sourceBuffer = Buffer.from(await file.arrayBuffer());
  const optimized = await sharp(sourceBuffer)
    .rotate()
    .resize(PLAYER_AVATAR_SIZE_PX, PLAYER_AVATAR_SIZE_PX, { fit: "cover", position: "center" })
    .webp({ quality: PLAYER_AVATAR_QUALITY })
    .toBuffer();

  return optimized;
}

function buildRankAssignments(params: {
  rows: Array<z.infer<typeof rowSchema>>;
  originalRankById: Map<string, number>;
}) {
  const { rows, originalRankById } = params;
  const rowById = new Map(rows.map((row) => [row.id, row]));

  const orderedIds = [...rows]
    .sort((a, b) => {
      const aRank = originalRankById.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bRank = originalRankById.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return aRank - bRank;
    })
    .map((row) => row.id);

  const rankMoves = rows
    .map((row) => ({
      id: row.id,
      originalRank: originalRankById.get(row.id),
      targetRank: row.initialRank
    }))
    .filter((move) => typeof move.originalRank === "number" && move.originalRank !== move.targetRank)
    .sort((a, b) => (a.originalRank ?? 0) - (b.originalRank ?? 0));

  for (const move of rankMoves) {
    const currentIndex = orderedIds.indexOf(move.id);
    if (currentIndex < 0) continue;

    const targetIndex = Math.min(Math.max(move.targetRank, 1), orderedIds.length) - 1;
    if (targetIndex === currentIndex) continue;

    orderedIds.splice(currentIndex, 1);
    orderedIds.splice(targetIndex, 0, move.id);
  }

  return orderedIds.map((id, index) => {
    const row = rowById.get(id);
    if (!row) {
      throw new Error("No se pudo reordenar el ranking por datos incompletos.");
    }

    return {
      row,
      finalRank: index + 1
    };
  });
}

async function persistRankAssignments(params: {
  organizationId: string;
  organizationQueryKey: string;
  assignments: ReturnType<typeof buildRankAssignments>;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
}) {
  const { assignments, organizationId, organizationQueryKey, supabase } = params;

  for (let index = 0; index < assignments.length; index += 1) {
    const row = assignments[index].row;
    const { error: tempError } = await supabase
      .from("players")
      .update({ initial_rank: 10000 + index })
      .eq("id", row.id)
      .eq("organization_id", organizationId);

    if (tempError) {
      redirect(withMessage(organizationQueryKey, tempError.message));
    }
  }

  for (const assignment of assignments) {
    const row = assignment.row;
    const { error: saveError } = await supabase
      .from("players")
      .update({
        full_name: row.fullName,
        initial_rank: assignment.finalRank,
        current_rating: Number(row.currentRating.toFixed(2)),
        active: row.active
      })
      .eq("id", row.id)
      .eq("organization_id", organizationId);

    if (saveError) {
      redirect(withMessage(organizationQueryKey, saveError.message));
    }
  }
}

export async function createPlayerAction(formData: FormData) {
  try {
    const parsed = createSchema.safeParse({
      organizationId: formData.get("organizationId"),
      fullName: formData.get("fullName"),
      initialRank: formData.get("initialRank")
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

    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("id, initial_rank")
      .eq("organization_id", parsed.data.organizationId)
      .order("initial_rank", { ascending: false });

    if (playersError) {
      redirect(withMessage(organizationQueryKey, playersError.message));
    }

    const totalPlayers = players?.length ?? 0;
    const rankToUse = Math.min(Math.max(parsed.data.initialRank, 1), totalPlayers + 1);

    const affectedPlayers = (players ?? []).filter((player) => player.initial_rank >= rankToUse);
    for (const player of affectedPlayers) {
      const { error: shiftError } = await supabase
        .from("players")
        .update({ initial_rank: player.initial_rank + 1 })
        .eq("id", player.id)
        .eq("organization_id", parsed.data.organizationId);

      if (shiftError) {
        redirect(withMessage(organizationQueryKey, shiftError.message));
      }
    }

    const { error } = await supabase.from("players").insert({
      organization_id: parsed.data.organizationId,
      full_name: parsed.data.fullName,
      initial_rank: rankToUse
    });
    if (error) {
      redirect(withMessage(organizationQueryKey, error.message));
    }

    revalidatePath("/admin/players");
    revalidatePath("/players");
    revalidatePath("/ranking");
    revalidatePath("/");
    redirect(withSuccess(organizationQueryKey, "Jugador creado correctamente."));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : "Error inesperado al crear jugador.";
    redirect(withMessage(String(formData.get("organizationId") ?? ""), message));
  }
}

export async function bulkUpdatePlayersAction(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");

  try {
    if (!organizationId) {
      redirect(withMessage("", "Falta la organizacion activa."));
    }

    await assertOrganizationAdminAction(organizationId);
    const organizationQueryKey = await getOrganizationQueryKeyById(organizationId);

    const playerIds = formData.getAll("playerId").map((value) => String(value));
    const fullNames = formData.getAll("fullName").map((value) => String(value));
    const initialRanks = formData.getAll("initialRank").map((value) => Number(value));
    const currentRatings = formData.getAll("currentRating").map((value) => Number(value));
    const statuses = formData.getAll("activeStatus").map((value) => String(value));

    if (
      !playerIds.length ||
      playerIds.length !== fullNames.length ||
      playerIds.length !== initialRanks.length ||
      playerIds.length !== currentRatings.length ||
      playerIds.length !== statuses.length
    ) {
      redirect(withMessage(organizationQueryKey, "La planilla enviada es invalida o incompleta."));
    }

    const rows = playerIds.map((id, index) =>
      rowSchema.parse({
        id,
        fullName: fullNames[index],
        initialRank: initialRanks[index],
        currentRating: currentRatings[index],
        active: statuses[index] === "true"
      })
    );

    const idsSet = new Set(rows.map((row) => row.id));
    if (idsSet.size !== rows.length) {
      redirect(withMessage(organizationQueryKey, "Hay IDs de jugadores duplicados en la planilla."));
    }

    const supabase = await createSupabaseServerClient();
    const { data: currentPlayers, error: currentPlayersError } = await supabase
      .from("players")
      .select("id, initial_rank")
      .eq("organization_id", organizationId);

    if (currentPlayersError) {
      redirect(withMessage(organizationQueryKey, currentPlayersError.message));
    }

    const originalRankById = new Map((currentPlayers ?? []).map((player) => [player.id, player.initial_rank]));
    if (originalRankById.size !== rows.length) {
      redirect(
        withMessage(
          organizationQueryKey,
          "La planilla cambio mientras editabas. Recarga la pagina y vuelve a intentar."
        )
      );
    }

    const assignments = buildRankAssignments({ rows, originalRankById });
    const hasRankChanges = assignments.some(
      ({ row, finalRank }) => (originalRankById.get(row.id) ?? finalRank) !== finalRank
    );

    await persistRankAssignments({
      assignments,
      organizationId,
      organizationQueryKey,
      supabase
    });

    // Safeguard: if any rank was persisted incorrectly, force the canonical order.
    const { data: persistedRows, error: persistedRowsError } = await supabase
      .from("players")
      .select("id, initial_rank")
      .eq("organization_id", organizationId);

    if (persistedRowsError) {
      redirect(withMessage(organizationQueryKey, persistedRowsError.message));
    }

    const persistedRankById = new Map((persistedRows ?? []).map((row) => [row.id, row.initial_rank]));
    const mismatchDetected = assignments.some(
      (assignment) => persistedRankById.get(assignment.row.id) !== assignment.finalRank
    );

    if (mismatchDetected) {
      await persistRankAssignments({
        assignments,
        organizationId,
        organizationQueryKey,
        supabase
      });
    }

    revalidatePath("/admin/players");
    revalidatePath("/players");
    revalidatePath("/ranking");
    revalidatePath("/");
    redirect(
      withSuccess(
        organizationQueryKey,
        hasRankChanges
          ? "Se guardaron los cambios y el ranking se reordeno automaticamente."
          : "Se guardaron todos los cambios de la planilla."
      )
    );
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : "No se pudo guardar la planilla.";
    redirect(withMessage(organizationId, message));
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
      .select("id, initial_rank, full_name")
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
            : deleteError.message
        )
      );
    }

    const { data: playersToShift, error: shiftCandidatesError } = await supabase
      .from("players")
      .select("id, initial_rank")
      .eq("organization_id", parsed.data.organizationId)
      .gt("initial_rank", playerToDelete.initial_rank)
      .order("initial_rank", { ascending: true });

    if (shiftCandidatesError) {
      redirect(withMessage(organizationQueryKey, shiftCandidatesError.message));
    }

    for (const player of playersToShift ?? []) {
      const { error: shiftError } = await supabase
        .from("players")
        .update({ initial_rank: player.initial_rank - 1 })
        .eq("id", player.id)
        .eq("organization_id", parsed.data.organizationId);

      if (shiftError) {
        redirect(withMessage(organizationQueryKey, shiftError.message));
      }
    }

    revalidatePath("/admin/players");
    revalidatePath("/players");
    revalidatePath("/ranking");
    revalidatePath("/");
    redirect(withSuccess(organizationQueryKey, `Jugador ${playerToDelete.full_name} eliminado y ranking reordenado.`));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : "No se pudo eliminar el jugador.";
    redirect(withMessage(String(formData.get("organizationId") ?? ""), message));
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

    await assertOrganizationAdminAction(parsed.data.organizationId);
    const organizationQueryKey = await getOrganizationQueryKeyById(parsed.data.organizationId);

    const file = formData.get("photo");
    if (!(file instanceof File) || file.size <= 0) {
      redirect(withMessage(organizationQueryKey, "Selecciona una imagen para subir."));
    }

    const sizeLimitBytes = MAX_PHOTO_SIZE_MB * 1024 * 1024;
    if (file.size > sizeLimitBytes) {
      redirect(withMessage(organizationQueryKey, `La imagen no puede superar ${MAX_PHOTO_SIZE_MB} MB.`));
    }

    const extension = inferFileExtension(file);
    if (!extension) {
      redirect(withMessage(organizationQueryKey, "Formato no soportado. Usa JPG, JPEG, PNG o WEBP."));
    }

    const supabase = await createSupabaseServerClient();
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id")
      .eq("id", parsed.data.playerId)
      .eq("organization_id", parsed.data.organizationId)
      .maybeSingle();

    if (playerError || !player) {
      redirect(withMessage(organizationQueryKey, "No se encontro el jugador en la organizacion seleccionada."));
    }

    const optimizedBuffer = await optimizePlayerAvatarImage(file);
    const objectPath = getPlayerPhotoObjectPath(
      getSupabaseDbSchema(),
      parsed.data.organizationId,
      parsed.data.playerId
    );
    const bucketName = getPlayerPhotosBucket();
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(objectPath, optimizedBuffer, {
        upsert: true,
        contentType: "image/webp",
        cacheControl: "31536000"
      });

    if (uploadError) {
      redirect(withMessage(organizationQueryKey, `No se pudo guardar la foto en Storage: ${uploadError.message}`));
    }

    revalidatePath("/admin/players");
    revalidatePath("/players");
    revalidatePath("/ranking");
    revalidatePath(`/players/${parsed.data.playerId}`);
    revalidatePath(`/api/player-photo/${parsed.data.playerId}`);
    redirect(withSuccess(organizationQueryKey, "Foto subida correctamente."));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : "No se pudo subir la foto.";
    redirect(withMessage(String(formData.get("organizationId") ?? ""), message));
  }
}
