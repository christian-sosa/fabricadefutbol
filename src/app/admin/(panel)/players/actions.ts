"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { z } from "zod";

import { assertOrganizationAdminAction, getOrganizationQueryKeyById } from "@/lib/auth/admin";
import { isNextRedirectError } from "@/lib/next-redirect";
import { withOrgQuery } from "@/lib/org";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createSchema = z.object({
  organizationId: z.string().uuid(),
  fullName: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  initialRank: z.coerce.number().int().positive().max(999)
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
const PLAYER_PHOTOS_BUCKET = "player-photos";
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
  return `${basePath}${separator}error=${encodeURIComponent(error)}`;
}

function withSuccess(organizationId: string, success: string | null) {
  const basePath = withOrgQuery("/admin/players", organizationId);
  if (!success) return basePath;
  const separator = basePath.includes("?") ? "&" : "?";
  return `${basePath}${separator}success=${encodeURIComponent(success)}`;
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

function getPlayerPhotoObjectPath(organizationId: string, playerId: string) {
  return `${organizationId}/${playerId}.webp`;
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

async function ensureSequentialRanks(rows: Array<z.infer<typeof rowSchema>>) {
  const sortedRanks = [...rows.map((row) => row.initialRank)].sort((a, b) => a - b);
  const hasSequentialRanks = sortedRanks.every((rank, index) => rank === index + 1);

  if (!hasSequentialRanks) {
    throw new Error("Los ranks deben ser secuenciales y unicos (1, 2, 3, ...). Ajusta la planilla antes de guardar.");
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

    await ensureSequentialRanks(rows);

    const idsSet = new Set(rows.map((row) => row.id));
    if (idsSet.size !== rows.length) {
      redirect(withMessage(organizationQueryKey, "Hay IDs de jugadores duplicados en la planilla."));
    }

    const supabase = await createSupabaseServerClient();

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const { error: tempError } = await supabase
        .from("players")
        .update({ initial_rank: 10000 + index })
        .eq("id", row.id)
        .eq("organization_id", organizationId);

      if (tempError) {
        redirect(withMessage(organizationQueryKey, tempError.message));
      }
    }

    for (const row of rows) {
      const { error: saveError } = await supabase
        .from("players")
        .update({
          full_name: row.fullName,
          initial_rank: row.initialRank,
          current_rating: Number(row.currentRating.toFixed(2)),
          active: row.active
        })
        .eq("id", row.id)
        .eq("organization_id", organizationId);

      if (saveError) {
        redirect(withMessage(organizationQueryKey, saveError.message));
      }
    }

    revalidatePath("/admin/players");
    revalidatePath("/players");
    revalidatePath("/ranking");
    revalidatePath("/");
    redirect(withSuccess(organizationQueryKey, "Se guardaron todos los cambios de la planilla."));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : "No se pudo guardar la planilla.";
    redirect(withMessage(organizationId, message));
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
    const objectPath = getPlayerPhotoObjectPath(parsed.data.organizationId, parsed.data.playerId);
    const { error: uploadError } = await supabase.storage
      .from(PLAYER_PHOTOS_BUCKET)
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
    redirect(withSuccess(organizationQueryKey, "Foto actualizada correctamente en Supabase Storage."));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : "No se pudo subir la foto.";
    redirect(withMessage(String(formData.get("organizationId") ?? ""), message));
  }
}
