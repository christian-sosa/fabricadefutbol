"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assertClubWriteAction, getClubSlugById } from "@/lib/auth/clubs";
import { validateClubMatchSheet, type ClubLineupRole, type ClubMatchSheetParticipantInput } from "@/lib/domain/clubs";
import { getPlayerPhotosBucket, getSupabaseDbSchema, getTeamLogosBucket } from "@/lib/env";
import { toUserMessage } from "@/lib/errors";
import { datetimeLocalToMatchIso } from "@/lib/match-datetime";
import { isNextRedirectError } from "@/lib/next-redirect";
import { normalizeEmail, slugifyClubName } from "@/lib/org";
import {
  assertPlayerPhotoUploadAllowed,
  registerPlayerPhotoUploadEvent
} from "@/lib/player-photo-upload-limits";
import {
  getClubPlayerPhotoObjectPath,
  inferPlayerPhotoExtension,
  MAX_PLAYER_PHOTO_SIZE_MB,
  optimizePlayerAvatarImage
} from "@/lib/player-photos";
import { refreshClubPublicSnapshot } from "@/lib/queries/clubs";
import { REPLACEABLE_IMAGE_UPLOAD_CACHE_CONTROL } from "@/lib/storage-image-responses";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getClubLogoObjectPath,
  isSupportedTeamLogoFile,
  MAX_TEAM_LOGO_SIZE_MB,
  optimizeTeamLogoImage
} from "@/lib/team-logos";

const updateClubSchema = z.object({
  name: z.string().min(2, "El nombre del club debe tener al menos 2 caracteres.").max(100),
  description: z.string().max(500).optional(),
  homeVenue: z.string().max(120).optional(),
  isPublic: z.boolean().default(false)
});

const playerSchema = z.object({
  fullName: z.string().min(2, "El jugador debe tener al menos 2 caracteres.").max(80),
  nickname: z.string().max(40).optional(),
  position: z.string().max(30).optional(),
  shirtNumber: z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? Number(value) : null),
    z.number().int().min(1).max(99).nullable()
  ),
  notes: z.string().max(300).optional()
});

const playerToggleSchema = z.object({
  playerId: z.string().uuid(),
  active: z.boolean()
});

const teamSchema = z.object({
  name: z.string().min(2, "El equipo debe tener al menos 2 caracteres.").max(80),
  shortName: z.string().max(20).optional(),
  notes: z.string().max(300).optional()
});

const competitionSchema = z.object({
  name: z.string().min(2, "El torneo debe tener al menos 2 caracteres.").max(80),
  notes: z.string().max(300).optional()
});

const playerPhotoSchema = z.object({
  playerId: z.string().uuid()
});

const rosterSchema = z.object({
  teamId: z.string().uuid()
});

const matchSchema = z.object({
  teamId: z.string().uuid(),
  competitionId: z.string().uuid("Elegir donde se jugo el partido."),
  playedAt: z.string().min(1, "Carga la fecha del partido."),
  opponentName: z.string().min(2, "Carga el rival.").max(100),
  venue: z.string().max(120).optional(),
  goalsFor: z.coerce.number().int().min(0),
  goalsAgainst: z.coerce.number().int().min(0),
  notes: z.string().max(500).optional()
});

const clubAdminInviteSchema = z.object({
  email: z.string().email("Ingresa un email valido.")
});

const removeClubAdminSchema = z.object({
  adminId: z.string().uuid()
});

const clubAdminInviteDeleteSchema = z.object({
  inviteId: z.string().uuid()
});

function buildClubDetailPath(params: {
  clubId: string;
  tab?: string;
  error?: string;
  success?: string;
}) {
  const basePath = `/admin/clubs/${params.clubId}`;
  const searchParams = new URLSearchParams();
  if (params.tab) searchParams.set("tab", params.tab);
  if (params.error) searchParams.set("error", params.error);
  if (params.success) searchParams.set("success", params.success);
  const search = searchParams.toString();
  return search ? `${basePath}?${search}` : basePath;
}

function parseRole(value: FormDataEntryValue | null): ClubLineupRole {
  if (value === "substitute" || value === "present") return value;
  return "starter";
}

function parseOptionalRole(value: FormDataEntryValue | null): ClubLineupRole | null {
  if (value === "starter" || value === "substitute" || value === "present") return value;
  return null;
}

function parseStatValue(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" && value.trim() ? Number(value) : 0;
  return Number.isInteger(raw) && raw >= 0 ? raw : 0;
}

function parseBulkPlayerLine(line: string, lineNumber: number) {
  const columns = line.includes("|")
    ? line.split("|").map((column) => column.trim())
    : [line.trim(), "", "", "", ""];
  const [fullName = "", nickname = "", position = "", shirtNumber = "", ...notesParts] = columns;
  const parsed = playerSchema.safeParse({
    fullName,
    nickname,
    position,
    shirtNumber,
    notes: notesParts.join(" | ")
  });

  if (!parsed.success) {
    return {
      error: `Linea ${lineNumber}: ${parsed.error.issues[0]?.message ?? "formato invalido."}`,
      row: null
    };
  }

  return {
    error: null,
    row: {
      fullName: parsed.data.fullName.trim(),
      nickname: parsed.data.nickname?.trim() || null,
      position: parsed.data.position?.trim() || null,
      shirtNumber: parsed.data.shirtNumber,
      notes: parsed.data.notes?.trim() || null
    }
  };
}

function buildInviteExpiresAt() {
  return new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
}

async function revalidateClubPaths(clubId: string) {
  const slug = await getClubSlugById(clubId);
  revalidatePath("/admin/clubs");
  revalidatePath(`/admin/clubs/${clubId}`);
  revalidatePath(`/clubs/${slug}`);
}

async function clubAlreadyHasAdminWithEmail(params: {
  clubId: string;
  normalizedEmail: string;
}) {
  const supabaseAdmin = createSupabaseAdminClient();
  if (!supabaseAdmin) return false;

  const { data: memberships, error: membershipsError } = await supabaseAdmin
    .from("club_admins")
    .select("admin_id")
    .eq("club_id", params.clubId);

  if (membershipsError) {
    throw new Error(membershipsError.message);
  }

  const adminIds = Array.from(new Set((memberships ?? []).map((row) => String(row.admin_id))));
  if (!adminIds.length) return false;

  const resolved = await Promise.all(
    adminIds.map(async (adminId) => {
      const { data } = await supabaseAdmin.auth.admin.getUserById(adminId);
      return normalizeEmail(data?.user?.email ?? "");
    })
  );

  return resolved.some((email) => email === params.normalizedEmail);
}

async function refreshAndRevalidate(clubId: string) {
  await refreshClubPublicSnapshot(clubId);
  await revalidateClubPaths(clubId);
}

function getRequiredFile(formData: FormData, fieldName: string) {
  const file = formData.get(fieldName);
  return file instanceof File && file.size > 0 ? file : null;
}

function validateClubPlayerPhotoFile(file: File, clubId: string) {
  const sizeLimitBytes = MAX_PLAYER_PHOTO_SIZE_MB * 1024 * 1024;
  if (file.size > sizeLimitBytes) {
    redirect(buildClubDetailPath({ clubId, tab: "players", error: `La imagen no puede superar ${MAX_PLAYER_PHOTO_SIZE_MB} MB.` }));
  }

  const extension = inferPlayerPhotoExtension(file);
  if (!extension) {
    redirect(buildClubDetailPath({ clubId, tab: "players", error: "Formato no soportado. Usa JPG, JPEG, PNG o WEBP." }));
  }
}

function validateClubLogoFile(file: File, clubId: string) {
  const sizeLimitBytes = MAX_TEAM_LOGO_SIZE_MB * 1024 * 1024;
  if (file.size > sizeLimitBytes) {
    redirect(buildClubDetailPath({ clubId, tab: "summary", error: `El escudo no puede superar ${MAX_TEAM_LOGO_SIZE_MB} MB.` }));
  }

  if (!isSupportedTeamLogoFile(file)) {
    redirect(buildClubDetailPath({ clubId, tab: "summary", error: "Formato no soportado para el escudo. Usa JPG, PNG, WEBP o SVG." }));
  }
}

function parseNextSlug(baseSlug: string, existingSlugs: string[]) {
  if (!existingSlugs.includes(baseSlug)) return baseSlug;

  let suffix = 2;
  while (existingSlugs.includes(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseSlug}-${suffix}`;
}

async function resolveUniqueClubCompetitionSlug(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  clubId: string;
  normalizedName: string;
}) {
  const baseSlug = slugifyClubName(params.normalizedName) || `torneo-${Date.now()}`;
  const { data, error } = await params.supabase
    .from("club_competitions")
    .select("slug")
    .eq("club_id", params.clubId)
    .ilike("slug", `${baseSlug}%`);

  if (error) {
    throw new Error(error.message);
  }

  return parseNextSlug(
    baseSlug,
    (data ?? []).map((row) => String(row.slug).toLowerCase())
  );
}

export async function updateClubAction(clubId: string, formData: FormData) {
  try {
    await assertClubWriteAction(clubId);
    const parsed = updateClubSchema.safeParse({
      name: formData.get("name"),
      description: formData.get("description"),
      homeVenue: formData.get("homeVenue"),
      isPublic: formData.get("isPublic") === "on"
    });

    if (!parsed.success) {
      redirect(buildClubDetailPath({ clubId, tab: "summary", error: parsed.error.issues[0]?.message ?? "Datos invalidos." }));
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("clubs")
      .update({
        name: parsed.data.name.trim(),
        description: parsed.data.description?.trim() || null,
        home_venue: parsed.data.homeVenue?.trim() || null,
        is_public: parsed.data.isPublic
      })
      .eq("id", clubId);

    if (error) {
      redirect(buildClubDetailPath({ clubId, tab: "summary", error: toUserMessage(error, "No se pudo actualizar el club.") }));
    }

    await refreshAndRevalidate(clubId);
    redirect(buildClubDetailPath({ clubId, tab: "summary", success: "Club actualizado." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildClubDetailPath({ clubId, tab: "summary", error: toUserMessage(error, "No se pudo actualizar el club.") }));
  }
}

export async function addClubPlayerAction(clubId: string, formData: FormData) {
  try {
    await assertClubWriteAction(clubId);
    const parsed = playerSchema.safeParse({
      fullName: formData.get("fullName"),
      nickname: formData.get("nickname"),
      position: formData.get("position"),
      shirtNumber: formData.get("shirtNumber"),
      notes: formData.get("notes")
    });

    if (!parsed.success) {
      redirect(buildClubDetailPath({ clubId, tab: "players", error: parsed.error.issues[0]?.message ?? "Datos invalidos." }));
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("club_players").insert({
      club_id: clubId,
      full_name: parsed.data.fullName.trim(),
      nickname: parsed.data.nickname?.trim() || null,
      position: parsed.data.position?.trim() || null,
      shirt_number: parsed.data.shirtNumber,
      notes: parsed.data.notes?.trim() || null,
      active: true
    });

    if (error) {
      const userMessage = error.code === "23505" ? "Ya existe un jugador con ese nombre en el club." : toUserMessage(error, "No se pudo agregar el jugador.");
      redirect(buildClubDetailPath({ clubId, tab: "players", error: userMessage }));
    }

    await refreshAndRevalidate(clubId);
    redirect(buildClubDetailPath({ clubId, tab: "players", success: "Jugador agregado." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildClubDetailPath({ clubId, tab: "players", error: toUserMessage(error, "No se pudo agregar el jugador.") }));
  }
}

export async function bulkAddClubPlayersAction(clubId: string, formData: FormData) {
  try {
    await assertClubWriteAction(clubId);
    const raw = String(formData.get("players") ?? "");
    const parsedRows = raw
      .split(/\r?\n/)
      .map((line, index) => ({ line: line.trim(), lineNumber: index + 1 }))
      .filter(({ line }) => line.length > 0)
      .map(({ line, lineNumber }) => parseBulkPlayerLine(line, lineNumber));
    const firstError = parsedRows.find((result) => result.error)?.error;
    if (firstError) {
      redirect(buildClubDetailPath({ clubId, tab: "players", error: firstError }));
    }

    const uniqueRowsByName = new Map(
      parsedRows
        .map((result) => result.row)
        .filter((row): row is NonNullable<typeof row> => Boolean(row))
        .map((row) => [row.fullName.toLowerCase(), row])
    );
    const rows = Array.from(uniqueRowsByName.values());

    if (!rows.length) {
      redirect(buildClubDetailPath({ clubId, tab: "players", error: "Carga al menos un jugador." }));
    }

    const supabase = await createSupabaseServerClient();
    const { data: existingPlayers, error: existingError } = await supabase
      .from("club_players")
      .select("full_name")
      .eq("club_id", clubId);

    if (existingError) {
      redirect(buildClubDetailPath({ clubId, tab: "players", error: toUserMessage(existingError, "No se pudo validar jugadores existentes.") }));
    }

    const existingNames = new Set((existingPlayers ?? []).map((player) => String(player.full_name).trim().toLowerCase()));
    const rowsToInsert = rows
      .filter((row) => !existingNames.has(row.fullName.toLowerCase()))
      .map((row) => ({
        club_id: clubId,
        full_name: row.fullName,
        nickname: row.nickname,
        position: row.position,
        shirt_number: row.shirtNumber,
        notes: row.notes,
        active: true
      }));

    if (!rowsToInsert.length) {
      redirect(buildClubDetailPath({ clubId, tab: "players", success: "No habia jugadores nuevos para cargar." }));
    }

    const { error } = await supabase.from("club_players").insert(rowsToInsert);

    if (error) {
      redirect(buildClubDetailPath({ clubId, tab: "players", error: toUserMessage(error, "No se pudieron cargar los jugadores.") }));
    }

    await refreshAndRevalidate(clubId);
    redirect(buildClubDetailPath({ clubId, tab: "players", success: "Jugadores cargados." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildClubDetailPath({ clubId, tab: "players", error: toUserMessage(error, "No se pudieron cargar los jugadores.") }));
  }
}

export async function toggleClubPlayerAction(clubId: string, formData: FormData) {
  try {
    await assertClubWriteAction(clubId);
    const parsed = playerToggleSchema.safeParse({
      playerId: formData.get("playerId"),
      active: formData.get("active") === "true"
    });

    if (!parsed.success) {
      redirect(buildClubDetailPath({ clubId, tab: "players", error: "Falta el jugador a actualizar." }));
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("club_players")
      .update({ active: parsed.data.active })
      .eq("id", parsed.data.playerId)
      .eq("club_id", clubId);

    if (error) {
      redirect(buildClubDetailPath({ clubId, tab: "players", error: toUserMessage(error, "No se pudo actualizar el jugador.") }));
    }

    await refreshAndRevalidate(clubId);
    redirect(buildClubDetailPath({ clubId, tab: "players", success: "Jugador actualizado." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildClubDetailPath({ clubId, tab: "players", error: toUserMessage(error, "No se pudo actualizar el jugador.") }));
  }
}

export async function uploadClubPlayerPhotoAction(clubId: string, formData: FormData) {
  try {
    const admin = await assertClubWriteAction(clubId);
    const parsed = playerPhotoSchema.safeParse({
      playerId: formData.get("playerId")
    });

    if (!parsed.success) {
      redirect(buildClubDetailPath({ clubId, tab: "players", error: "Falta el jugador." }));
    }

    const file = getRequiredFile(formData, "photo");
    if (!file) {
      redirect(buildClubDetailPath({ clubId, tab: "players", error: "Selecciona una imagen para subir." }));
    }
    validateClubPlayerPhotoFile(file, clubId);

    const supabase = await createSupabaseServerClient();
    const { data: player, error: playerError } = await supabase
      .from("club_players")
      .select("id")
      .eq("id", parsed.data.playerId)
      .eq("club_id", clubId)
      .maybeSingle();

    if (playerError || !player) {
      redirect(buildClubDetailPath({ clubId, tab: "players", error: "No se encontro el jugador en este club." }));
    }

    await assertPlayerPhotoUploadAllowed({
      supabase: supabase as never,
      uploaderId: admin.userId,
      uploaderRole: "club_admin",
      targetPlayerId: parsed.data.playerId,
      targetType: "club_player"
    });

    const optimizedBuffer = await optimizePlayerAvatarImage(file);
    const objectPath = getClubPlayerPhotoObjectPath(getSupabaseDbSchema(), clubId, parsed.data.playerId);
    const { error: uploadError } = await supabase.storage
      .from(getPlayerPhotosBucket())
      .upload(objectPath, optimizedBuffer, {
        upsert: true,
        contentType: "image/webp",
        cacheControl: REPLACEABLE_IMAGE_UPLOAD_CACHE_CONTROL
      });

    if (uploadError) {
      redirect(buildClubDetailPath({ clubId, tab: "players", error: toUserMessage(uploadError, "No se pudo guardar la foto.") }));
    }

    const { error: updateError } = await supabase
      .from("club_players")
      .update({ photo_path: objectPath })
      .eq("id", parsed.data.playerId)
      .eq("club_id", clubId);

    if (updateError) {
      redirect(buildClubDetailPath({ clubId, tab: "players", error: toUserMessage(updateError, "No se pudo vincular la foto al jugador.") }));
    }

    await registerPlayerPhotoUploadEvent({
      supabase: supabase as never,
      uploaderId: admin.userId,
      uploaderRole: "club_admin",
      targetPlayerId: parsed.data.playerId,
      targetType: "club_player"
    });

    revalidatePath(`/api/player-photo/${parsed.data.playerId}`);
    await revalidateClubPaths(clubId);
    redirect(buildClubDetailPath({ clubId, tab: "players", success: "Foto subida correctamente." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildClubDetailPath({ clubId, tab: "players", error: toUserMessage(error, "No se pudo subir la foto.") }));
  }
}

export async function addClubCompetitionAction(clubId: string, formData: FormData) {
  try {
    await assertClubWriteAction(clubId);
    const parsed = competitionSchema.safeParse({
      name: formData.get("name"),
      notes: formData.get("notes")
    });

    if (!parsed.success) {
      redirect(buildClubDetailPath({ clubId, tab: "competitions", error: parsed.error.issues[0]?.message ?? "Datos invalidos." }));
    }

    const supabase = await createSupabaseServerClient();
    const normalizedName = parsed.data.name.trim();
    const slug = await resolveUniqueClubCompetitionSlug({
      supabase,
      clubId,
      normalizedName
    });
    const { error } = await supabase.from("club_competitions").insert({
      club_id: clubId,
      name: normalizedName,
      slug,
      notes: parsed.data.notes?.trim() || null,
      active: true
    });

    if (error) {
      const userMessage = error.code === "23505" ? "Ya existe un torneo con ese nombre en el club." : toUserMessage(error, "No se pudo agregar el torneo.");
      redirect(buildClubDetailPath({ clubId, tab: "competitions", error: userMessage }));
    }

    await refreshAndRevalidate(clubId);
    redirect(buildClubDetailPath({ clubId, tab: "competitions", success: "Torneo agregado." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildClubDetailPath({ clubId, tab: "competitions", error: toUserMessage(error, "No se pudo agregar el torneo.") }));
  }
}

export async function addClubTeamAction(clubId: string, formData: FormData) {
  try {
    await assertClubWriteAction(clubId);
    const parsed = teamSchema.safeParse({
      name: formData.get("name"),
      shortName: formData.get("shortName"),
      notes: formData.get("notes")
    });

    if (!parsed.success) {
      redirect(buildClubDetailPath({ clubId, tab: "teams", error: parsed.error.issues[0]?.message ?? "Datos invalidos." }));
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("club_teams").insert({
      club_id: clubId,
      name: parsed.data.name.trim(),
      short_name: parsed.data.shortName?.trim() || null,
      notes: parsed.data.notes?.trim() || null,
      active: true
    });

    if (error) {
      const userMessage =
        error.code === "23505"
          ? "Ya existe un equipo con ese nombre en el club."
          : toUserMessage(error, "No se pudo agregar el equipo.");
      redirect(buildClubDetailPath({ clubId, tab: "teams", error: userMessage }));
    }

    await refreshAndRevalidate(clubId);
    redirect(buildClubDetailPath({ clubId, tab: "teams", success: "Equipo agregado." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildClubDetailPath({ clubId, tab: "teams", error: toUserMessage(error, "No se pudo agregar el equipo.") }));
  }
}

export async function uploadClubLogoAction(clubId: string, formData: FormData) {
  try {
    await assertClubWriteAction(clubId);
    const file = getRequiredFile(formData, "logo");
    if (!file) {
      redirect(buildClubDetailPath({ clubId, tab: "summary", error: "Selecciona una imagen para subir." }));
    }
    validateClubLogoFile(file, clubId);

    const supabase = await createSupabaseServerClient();
    const { data: club, error: clubError } = await supabase
      .from("clubs")
      .select("id")
      .eq("id", clubId)
      .maybeSingle();

    if (clubError || !club) {
      redirect(buildClubDetailPath({ clubId, tab: "summary", error: "No se encontro el club." }));
    }

    const optimizedBuffer = await optimizeTeamLogoImage(file);
    const objectPath = getClubLogoObjectPath(getSupabaseDbSchema(), clubId);
    const { error: uploadError } = await supabase.storage
      .from(getTeamLogosBucket())
      .upload(objectPath, optimizedBuffer, {
        upsert: true,
        contentType: "image/webp",
        cacheControl: REPLACEABLE_IMAGE_UPLOAD_CACHE_CONTROL
      });

    if (uploadError) {
      redirect(buildClubDetailPath({ clubId, tab: "summary", error: toUserMessage(uploadError, "No se pudo guardar el escudo.") }));
    }

    const { error: updateError } = await supabase
      .from("clubs")
      .update({ logo_path: objectPath })
      .eq("id", clubId);

    if (updateError) {
      redirect(buildClubDetailPath({ clubId, tab: "summary", error: toUserMessage(updateError, "No se pudo vincular el escudo al club.") }));
    }

    revalidatePath(`/api/club-logo/${clubId}`);
    await refreshAndRevalidate(clubId);
    redirect(buildClubDetailPath({ clubId, tab: "summary", success: "Escudo subido correctamente." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildClubDetailPath({ clubId, tab: "summary", error: toUserMessage(error, "No se pudo subir el escudo.") }));
  }
}

export async function syncClubTeamRosterAction(clubId: string, formData: FormData) {
  try {
    await assertClubWriteAction(clubId);
    const parsed = rosterSchema.safeParse({
      teamId: formData.get("teamId")
    });

    if (!parsed.success) {
      redirect(buildClubDetailPath({ clubId, tab: "teams", error: "Falta el equipo." }));
    }

    const selectedPlayerIds = new Set(
      formData
        .getAll("playerIds")
        .map((value) => String(value))
        .filter(Boolean)
    );
    const supabase = await createSupabaseServerClient();
    const [{ data: team, error: teamError }, { data: existingRows, error: existingError }] = await Promise.all([
      supabase.from("club_teams").select("id").eq("id", parsed.data.teamId).eq("club_id", clubId).maybeSingle(),
      supabase.from("club_team_players").select("id, club_player_id").eq("club_team_id", parsed.data.teamId)
    ]);

    if (teamError || !team) {
      redirect(buildClubDetailPath({ clubId, tab: "teams", error: "No se encontro el equipo dentro de este club." }));
    }
    if (existingError) {
      redirect(buildClubDetailPath({ clubId, tab: "teams", error: toUserMessage(existingError, "No se pudo leer el plantel actual.") }));
    }

    const existingByPlayerId = new Map((existingRows ?? []).map((row) => [String(row.club_player_id), String(row.id)]));
    const rowsToInsert = Array.from(selectedPlayerIds)
      .filter((playerId) => !existingByPlayerId.has(playerId))
      .map((playerId) => ({
        club_team_id: parsed.data.teamId,
        club_player_id: playerId
      }));
    const rowsToDelete = (existingRows ?? []).filter((row) => !selectedPlayerIds.has(String(row.club_player_id)));

    if (rowsToInsert.length) {
      const { error } = await supabase.from("club_team_players").insert(rowsToInsert);
      if (error) {
        redirect(buildClubDetailPath({ clubId, tab: "teams", error: toUserMessage(error, "No se pudieron agregar jugadores al equipo.") }));
      }
    }

    if (rowsToDelete.length) {
      const { error } = await supabase
        .from("club_team_players")
        .delete()
        .in("id", rowsToDelete.map((row) => row.id));
      if (error) {
        redirect(buildClubDetailPath({ clubId, tab: "teams", error: toUserMessage(error, "No se pudo actualizar el plantel.") }));
      }
    }

    await refreshAndRevalidate(clubId);
    redirect(buildClubDetailPath({ clubId, tab: "teams", success: "Plantel actualizado." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildClubDetailPath({ clubId, tab: "teams", error: toUserMessage(error, "No se pudo actualizar el plantel.") }));
  }
}

export async function addClubMatchAction(clubId: string, formData: FormData) {
  try {
    const admin = await assertClubWriteAction(clubId);
    const parsed = matchSchema.safeParse({
      teamId: formData.get("teamId"),
      competitionId: formData.get("competitionId"),
      playedAt: formData.get("playedAt"),
      opponentName: formData.get("opponentName"),
      venue: formData.get("venue"),
      goalsFor: formData.get("goalsFor"),
      goalsAgainst: formData.get("goalsAgainst"),
      notes: formData.get("notes")
    });

    if (!parsed.success) {
      redirect(buildClubDetailPath({ clubId, tab: "matches", error: parsed.error.issues[0]?.message ?? "Datos invalidos." }));
    }

    const playerRolesById = new Map<string, ClubLineupRole>();
    for (const [key, value] of formData.entries()) {
      if (!key.startsWith("playerRole:")) continue;
      const playerId = key.slice("playerRole:".length);
      const role = parseOptionalRole(value);
      if (playerId && role) playerRolesById.set(playerId, role);
    }

    const selectedPlayerIds = Array.from(playerRolesById.keys());
    const supabase = await createSupabaseServerClient();
    const { data: players, error: playersError } = selectedPlayerIds.length
      ? await supabase
          .from("club_players")
          .select("id, full_name")
          .eq("club_id", clubId)
          .in("id", selectedPlayerIds)
      : { data: [], error: null };

    if (playersError) {
      redirect(buildClubDetailPath({ clubId, tab: "matches", error: toUserMessage(playersError, "No se pudieron validar los jugadores.") }));
    }

    const playersById = new Map((players ?? []).map((player) => [String(player.id), String(player.full_name)]));
    const mvpKey = String(formData.get("mvp") ?? "");
    const participants: Array<ClubMatchSheetParticipantInput & { displayName: string }> = [];

    for (const playerId of selectedPlayerIds) {
      if (!playersById.has(playerId)) continue;

      participants.push({
        playerId,
        role: playerRolesById.get(playerId) ?? "starter",
        goals: parseStatValue(formData.get(`playerGoals:${playerId}`)),
        assists: parseStatValue(formData.get(`playerAssists:${playerId}`)),
        isMvp: mvpKey === `player:${playerId}`,
        displayName: playersById.get(playerId) ?? "Jugador"
      });
    }

    for (let index = 1; index <= 6; index += 1) {
      const guestName = String(formData.get(`guestName:${index}`) ?? "").trim();
      if (!guestName) continue;
      participants.push({
        guestName,
        role: parseRole(formData.get(`guestRole:${index}`)),
        goals: parseStatValue(formData.get(`guestGoals:${index}`)),
        assists: parseStatValue(formData.get(`guestAssists:${index}`)),
        isMvp: mvpKey === `guest:${index}`,
        displayName: guestName
      });
    }

    const validationErrors = validateClubMatchSheet({
      goalsFor: parsed.data.goalsFor,
      goalsAgainst: parsed.data.goalsAgainst,
      participants
    });

    if (validationErrors.length) {
      redirect(buildClubDetailPath({ clubId, tab: "matches", error: validationErrors[0] }));
    }

    const [{ data: team, error: teamError }, { data: competition, error: competitionError }] = await Promise.all([
      supabase
        .from("club_teams")
        .select("id")
        .eq("id", parsed.data.teamId)
        .eq("club_id", clubId)
        .maybeSingle(),
      supabase
        .from("club_competitions")
        .select("id")
        .eq("id", parsed.data.competitionId)
        .eq("club_id", clubId)
        .eq("active", true)
        .maybeSingle()
    ]);

    if (teamError || !team) {
      redirect(buildClubDetailPath({ clubId, tab: "matches", error: "No se encontro el equipo dentro de este club." }));
    }
    if (competitionError || !competition) {
      redirect(buildClubDetailPath({ clubId, tab: "matches", error: "No se encontro el torneo del club para este partido." }));
    }

    const { data: match, error: matchError } = await supabase
      .from("club_matches")
      .insert({
        club_id: clubId,
        club_team_id: parsed.data.teamId,
        club_competition_id: parsed.data.competitionId,
        played_at: datetimeLocalToMatchIso(parsed.data.playedAt),
        opponent_name: parsed.data.opponentName.trim(),
        venue: parsed.data.venue?.trim() || null,
        goals_for: parsed.data.goalsFor,
        goals_against: parsed.data.goalsAgainst,
        status: "played",
        notes: parsed.data.notes?.trim() || null,
        created_by: admin.userId
      })
      .select("id")
      .single();

    if (matchError || !match) {
      redirect(buildClubDetailPath({ clubId, tab: "matches", error: toUserMessage(matchError, "No se pudo crear el partido.") }));
    }

    for (const participant of participants) {
      const { data: lineup, error: lineupError } = await supabase
        .from("club_match_lineups")
        .insert({
          match_id: match.id,
          club_player_id: participant.playerId ?? null,
          guest_name: participant.guestName ?? null,
          display_name: participant.displayName,
          role: participant.role
        })
        .select("id")
        .single();

      if (lineupError || !lineup) {
        redirect(buildClubDetailPath({ clubId, tab: "matches", error: toUserMessage(lineupError, "No se pudo guardar la alineacion.") }));
      }

      const { error: statError } = await supabase.from("club_match_player_stats").insert({
        match_id: match.id,
        lineup_id: lineup.id,
        goals: participant.goals,
        assists: participant.assists,
        is_mvp: Boolean(participant.isMvp)
      });

      if (statError) {
        redirect(buildClubDetailPath({ clubId, tab: "matches", error: toUserMessage(statError, "No se pudieron guardar las estadisticas.") }));
      }
    }

    await refreshAndRevalidate(clubId);
    redirect(buildClubDetailPath({ clubId, tab: "matches", success: "Partido cargado." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildClubDetailPath({ clubId, tab: "matches", error: toUserMessage(error, "No se pudo cargar el partido.") }));
  }
}

export async function inviteClubAdminAction(clubId: string, formData: FormData) {
  try {
    const admin = await assertClubWriteAction(clubId);
    const parsed = clubAdminInviteSchema.safeParse({
      email: formData.get("email")
    });

    if (!parsed.success) {
      redirect(buildClubDetailPath({ clubId, tab: "admins", error: parsed.error.issues[0]?.message ?? "Datos invalidos." }));
    }

    const normalizedEmail = normalizeEmail(parsed.data.email);
    if (normalizedEmail === admin.email) {
      redirect(buildClubDetailPath({ clubId, tab: "admins", error: "Tu usuario ya administra este club." }));
    }

    if (await clubAlreadyHasAdminWithEmail({ clubId, normalizedEmail })) {
      redirect(buildClubDetailPath({ clubId, tab: "admins", error: "Ese email ya administra este club." }));
    }

    const supabase = await createSupabaseServerClient();
    const [
      { data: clubRow, error: clubError },
      { data: adminRows, error: adminRowsError },
      { data: inviteRows, error: inviteRowsError }
    ] = await Promise.all([
      supabase.from("clubs").select("created_by").eq("id", clubId).maybeSingle(),
      supabase.from("club_admins").select("admin_id").eq("club_id", clubId),
      supabase.from("club_admin_invites").select("id, expires_at").eq("club_id", clubId).eq("status", "pending")
    ]);

    if (clubError || !clubRow) {
      redirect(buildClubDetailPath({ clubId, tab: "admins", error: toUserMessage(clubError, "No se pudo verificar el club actual.") }));
    }
    if (adminRowsError) {
      redirect(buildClubDetailPath({ clubId, tab: "admins", error: toUserMessage(adminRowsError, "No se pudo verificar los admins actuales.") }));
    }
    if (inviteRowsError) {
      redirect(buildClubDetailPath({ clubId, tab: "admins", error: toUserMessage(inviteRowsError, "No se pudo verificar invitaciones pendientes.") }));
    }

    const currentAdminIds = new Set(
      (adminRows ?? []).map((row) => String(row.admin_id ?? "")).filter(Boolean)
    );
    if (clubRow.created_by) {
      currentAdminIds.add(String(clubRow.created_by));
    }

    const activePendingInvites = (inviteRows ?? []).filter((row) => {
      const expiresAt = Date.parse(row.expires_at);
      return !Number.isFinite(expiresAt) || expiresAt > Date.now();
    });
    if (currentAdminIds.size + activePendingInvites.length >= 4) {
      redirect(buildClubDetailPath({ clubId, tab: "admins", error: "Este club ya alcanzo el maximo de 4 administradores." }));
    }

    await supabase
      .from("club_admin_invites")
      .delete()
      .eq("club_id", clubId)
      .eq("email", normalizedEmail)
      .eq("status", "pending")
      .lte("expires_at", new Date().toISOString());

    const { error: inviteError } = await supabase.from("club_admin_invites").insert({
      club_id: clubId,
      email: normalizedEmail,
      invited_by: admin.userId,
      status: "pending",
      expires_at: buildInviteExpiresAt()
    });

    if (inviteError) {
      const userMessage =
        inviteError.code === "23505"
          ? "Ese email ya tiene una invitacion pendiente."
          : toUserMessage(inviteError, "No se pudo generar la invitacion.");
      redirect(buildClubDetailPath({ clubId, tab: "admins", error: userMessage }));
    }

    await revalidateClubPaths(clubId);
    redirect(buildClubDetailPath({ clubId, tab: "admins", success: "Invitacion de admin preparada." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildClubDetailPath({ clubId, tab: "admins", error: toUserMessage(error, "No se pudo generar la invitacion.") }));
  }
}

export async function revokeClubAdminInviteAction(clubId: string, formData: FormData) {
  try {
    await assertClubWriteAction(clubId);
    const parsed = clubAdminInviteDeleteSchema.safeParse({
      inviteId: formData.get("inviteId")
    });

    if (!parsed.success) {
      redirect(buildClubDetailPath({ clubId, tab: "admins", error: "Falta la invitacion a cancelar." }));
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("club_admin_invites")
      .delete()
      .eq("id", parsed.data.inviteId)
      .eq("club_id", clubId);

    if (error) {
      redirect(buildClubDetailPath({ clubId, tab: "admins", error: toUserMessage(error, "No se pudo cancelar la invitacion.") }));
    }

    await revalidateClubPaths(clubId);
    redirect(buildClubDetailPath({ clubId, tab: "admins", success: "Invitacion cancelada." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildClubDetailPath({ clubId, tab: "admins", error: toUserMessage(error, "No se pudo cancelar la invitacion.") }));
  }
}

export async function removeClubAdminAction(clubId: string, formData: FormData) {
  try {
    const actingAdmin = await assertClubWriteAction(clubId);
    const parsed = removeClubAdminSchema.safeParse({
      adminId: formData.get("adminId")
    });

    if (!parsed.success) {
      redirect(buildClubDetailPath({ clubId, tab: "admins", error: "Falta el admin a quitar." }));
    }

    if (actingAdmin.userId === parsed.data.adminId) {
      redirect(buildClubDetailPath({ clubId, tab: "admins", error: "No puedes quitarte a vos mismo como admin de este club." }));
    }

    const supabase = await createSupabaseServerClient();
    const [{ data: clubRow, error: clubError }, { data: adminRows, error: adminRowsError }] =
      await Promise.all([
        supabase.from("clubs").select("created_by").eq("id", clubId).maybeSingle(),
        supabase.from("club_admins").select("admin_id").eq("club_id", clubId)
      ]);

    if (clubError || !clubRow) {
      redirect(buildClubDetailPath({ clubId, tab: "admins", error: toUserMessage(clubError, "No se pudo verificar el club actual.") }));
    }
    if (adminRowsError) {
      redirect(buildClubDetailPath({ clubId, tab: "admins", error: toUserMessage(adminRowsError, "No se pudo contar los admins actuales.") }));
    }

    if (clubRow.created_by && parsed.data.adminId === String(clubRow.created_by)) {
      redirect(buildClubDetailPath({ clubId, tab: "admins", error: "El creador del club conserva permisos de owner y no puede quitarse desde admins." }));
    }

    const activeAdminIds = new Set(
      (adminRows ?? []).map((row) => String(row.admin_id ?? "")).filter(Boolean)
    );
    if (clubRow.created_by) {
      activeAdminIds.add(String(clubRow.created_by));
    }

    if (activeAdminIds.size <= 1) {
      redirect(buildClubDetailPath({ clubId, tab: "admins", error: "El club debe mantener al menos 1 admin activo." }));
    }

    const { error } = await supabase
      .from("club_admins")
      .delete()
      .eq("club_id", clubId)
      .eq("admin_id", parsed.data.adminId);

    if (error) {
      redirect(buildClubDetailPath({ clubId, tab: "admins", error: toUserMessage(error, "No se pudo quitar al administrador.") }));
    }

    await revalidateClubPaths(clubId);
    redirect(buildClubDetailPath({ clubId, tab: "admins", success: "Administrador quitado." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildClubDetailPath({ clubId, tab: "admins", error: toUserMessage(error, "No se pudo quitar al administrador.") }));
  }
}
