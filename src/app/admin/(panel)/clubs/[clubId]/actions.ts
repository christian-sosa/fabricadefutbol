"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assertClubWriteAction, getClubSlugById } from "@/lib/auth/clubs";
import {
  CLUB_PLAYER_POSITIONS,
  normalizeClubPlayerPosition,
  splitClubMatchCost,
  validateClubMatchSheet,
  type ClubLineupRole,
  type ClubPaymentStatus,
  type ClubMatchSheetParticipantInput
} from "@/lib/domain/clubs";
import { getPlayerPhotosBucket, getSupabaseDbSchema, getTeamLogosBucket } from "@/lib/env";
import { toUserMessage } from "@/lib/errors";
import { matchDateAndTimeToIso } from "@/lib/match-datetime";
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
  homeVenue: z.string().max(120).optional()
});

function normalizePlayerPositionForSchema(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  return normalizeClubPlayerPosition(value) ?? "__invalid_position__";
}

const playerPositionSchema = z.preprocess(
  normalizePlayerPositionForSchema,
  z.enum(CLUB_PLAYER_POSITIONS).nullable()
);
const matchModalitySchema = z.enum(["5v5", "6v6", "7v7", "9v9", "11v11"]);

const playerSchema = z.object({
  fullName: z.string().min(2, "El jugador debe tener al menos 2 caracteres.").max(80),
  nickname: z.string().max(40).optional(),
  position: playerPositionSchema,
  shirtNumber: z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? Number(value) : null),
    z.number().int().min(1).max(99).nullable()
  ),
  defaultPaymentAmount: z.string().max(30).optional(),
  notes: z.string().max(300).optional()
});

const playerToggleSchema = z.object({
  playerId: z.string().uuid(),
  active: z.boolean()
});

const competitionToggleSchema = z.object({
  competitionId: z.string().uuid(),
  active: z.boolean()
});

const teamSchema = z.object({
  name: z.string().min(2, "El equipo debe tener al menos 2 caracteres.").max(80),
  shortName: z.string().max(20).optional(),
  modality: matchModalitySchema,
  notes: z.string().max(300).optional()
});

const teamUpdateSchema = teamSchema.extend({
  teamId: z.string().uuid(),
  active: z.boolean()
});

const competitionSchema = z.object({
  name: z.string().min(2, "El torneo debe tener al menos 2 caracteres.").max(80),
  notes: z.string().max(300).optional()
});

const playerPhotoSchema = z.object({
  playerId: z.string().uuid()
});

const playerPaymentSchema = z.object({
  playerId: z.string().uuid(),
  defaultPaymentAmount: z.string().max(30).optional()
});

const rosterSchema = z.object({
  teamId: z.string().uuid()
});

const teamPlayerSchema = rosterSchema.extend({
  playerId: z.string().uuid()
});

const matchSchema = z.object({
  teamId: z.string().uuid(),
  competitionId: z.string().uuid("Elegir donde se jugo el partido."),
  modality: matchModalitySchema,
  playedDate: z.string().optional(),
  playedTime: z.string().min(1, "Carga la hora del partido."),
  opponentName: z.string().min(2, "Carga el rival.").max(100),
  venue: z.string().max(120).optional(),
  goalsFor: z.coerce.number().int().min(0),
  goalsAgainst: z.coerce.number().int().min(0),
  fieldCostAmount: z.preprocess(
    (value) => (typeof value === "string" ? value : ""),
    z.string().max(30)
  ),
  notes: z.string().max(500).optional()
});

const matchFinanceSchema = z.object({
  matchId: z.string().uuid()
});

const callupSchema = z.object({
  teamId: z.string().uuid(),
  scheduledDate: z.string().optional(),
  scheduledTime: z.string().min(1, "Carga la hora de la convocatoria."),
  opponentName: z.string().max(100).optional(),
  venue: z.string().max(120).optional(),
  idealPlayerCount: z.coerce.number().int().min(1).max(30),
  maxPlayerCount: z.coerce.number().int().min(1).max(30),
  targetPaymentCount: z.coerce.number().int().min(0).max(30),
  fullPaymentAmount: z.string().max(30),
  fieldCostAmount: z.string().max(30),
  notes: z.string().max(500).optional()
});

const callupPlayerSchema = z.object({
  callupId: z.string().uuid(),
  playerId: z.string().uuid(),
  status: z.enum(["", "confirmed", "tentative", "out", "injured", "waitlist"]),
  expectedAmount: z.string().max(30).optional(),
  notes: z.string().max(300).optional()
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
  callupId?: string;
  tab?: string;
  teamId?: string;
  view?: string;
  error?: string;
  success?: string;
}) {
  const basePath = `/admin/clubs/${params.clubId}`;
  const searchParams = new URLSearchParams();
  if (params.tab) searchParams.set("tab", params.tab);
  if (params.teamId) searchParams.set("teamId", params.teamId);
  if (params.callupId) searchParams.set("callupId", params.callupId);
  if (params.view) searchParams.set("view", params.view);
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

function parsePaymentStatus(value: FormDataEntryValue | null): ClubPaymentStatus {
  if (value === "paid" || value === "partial" || value === "unpaid") return value;
  return "unpaid";
}

function parseCurrencyAmountToCents(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const compact = raw.replace(/\s/g, "");
  const normalized = compact.includes(",") && compact.includes(".")
    ? compact.lastIndexOf(",") > compact.lastIndexOf(".")
      ? compact.replace(/\./g, "").replace(",", ".")
      : compact.replace(/,/g, "")
    : compact.replace(",", ".");
  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

function resolvePaidCents(params: {
  expectedCents: number;
  paidAmountCents: number;
  status: ClubPaymentStatus;
}) {
  if (params.expectedCents <= 0) return { paidCents: 0, error: null };
  if (params.status === "paid") return { paidCents: params.expectedCents, error: null };
  if (params.status === "unpaid") return { paidCents: 0, error: null };
  if (params.paidAmountCents <= 0) {
    return { paidCents: 0, error: "Para un pago parcial carga un monto mayor a 0." };
  }
  if (params.paidAmountCents >= params.expectedCents) {
    return { paidCents: params.paidAmountCents, error: "El pago parcial debe ser menor a lo que corresponde pagar." };
  }

  return { paidCents: params.paidAmountCents, error: null };
}

function parseBulkPlayerLine(line: string, lineNumber: number) {
  const columns = line.includes(";")
    ? line.split(";").map((column) => column.trim())
    : [line.trim(), "", "", "", ""];
  const [fullName = "", nickname = "", position = "", shirtNumber = "", ...notesParts] = columns;
  const parsed = playerSchema.safeParse({
    fullName,
    nickname,
    position,
    shirtNumber,
    notes: notesParts.join(";")
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const message = issue?.path[0] === "position"
      ? "La posicion debe ser arquero, defensor, volante o delantero."
      : issue?.message ?? "formato invalido.";
    return {
      error: `Linea ${lineNumber}: ${message}`,
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
      homeVenue: formData.get("homeVenue")
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
        home_venue: parsed.data.homeVenue?.trim() || null
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
      defaultPaymentAmount: String(formData.get("defaultPaymentAmount") ?? ""),
      notes: formData.get("notes")
    });

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const message = issue?.path[0] === "position"
        ? "La posicion debe ser arquero, defensor, volante o delantero."
        : issue?.message ?? "Datos invalidos.";
      redirect(buildClubDetailPath({ clubId, tab: "players", error: message }));
    }

    const defaultPaymentCents = parseCurrencyAmountToCents(formData.get("defaultPaymentAmount"));
    if (defaultPaymentCents === null) {
      redirect(buildClubDetailPath({ clubId, tab: "players", error: "El aporte habitual debe ser un numero valido." }));
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("club_players").insert({
      club_id: clubId,
      full_name: parsed.data.fullName.trim(),
      nickname: parsed.data.nickname?.trim() || null,
      position: parsed.data.position?.trim() || null,
      shirt_number: parsed.data.shirtNumber,
      default_payment_cents: defaultPaymentCents || null,
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

export async function updateClubPlayerPaymentAction(clubId: string, formData: FormData) {
  try {
    await assertClubWriteAction(clubId);
    const parsed = playerPaymentSchema.safeParse({
      playerId: formData.get("playerId"),
      defaultPaymentAmount: String(formData.get("defaultPaymentAmount") ?? "")
    });

    if (!parsed.success) {
      redirect(buildClubDetailPath({ clubId, tab: "players", error: "Falta el jugador a actualizar." }));
    }

    const defaultPaymentCents = parseCurrencyAmountToCents(formData.get("defaultPaymentAmount"));
    if (defaultPaymentCents === null) {
      redirect(buildClubDetailPath({ clubId, tab: "players", error: "El aporte habitual debe ser un numero valido." }));
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("club_players")
      .update({ default_payment_cents: defaultPaymentCents || null })
      .eq("id", parsed.data.playerId)
      .eq("club_id", clubId);

    if (error) {
      redirect(buildClubDetailPath({ clubId, tab: "players", error: toUserMessage(error, "No se pudo actualizar el aporte del jugador.") }));
    }

    await refreshAndRevalidate(clubId);
    redirect(buildClubDetailPath({ clubId, tab: "players", view: "pool", success: "Aporte habitual actualizado." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildClubDetailPath({ clubId, tab: "players", error: toUserMessage(error, "No se pudo actualizar el aporte del jugador.") }));
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

export async function toggleClubCompetitionAction(clubId: string, formData: FormData) {
  try {
    await assertClubWriteAction(clubId);
    const parsed = competitionToggleSchema.safeParse({
      competitionId: formData.get("competitionId"),
      active: formData.get("active") === "true"
    });

    if (!parsed.success) {
      redirect(buildClubDetailPath({ clubId, tab: "competitions", error: "Falta el torneo a actualizar." }));
    }

    const supabase = await createSupabaseServerClient();
    const { data: competition, error } = await supabase
      .from("club_competitions")
      .update({ active: parsed.data.active })
      .eq("id", parsed.data.competitionId)
      .eq("club_id", clubId)
      .select("id")
      .maybeSingle();

    if (error || !competition) {
      redirect(buildClubDetailPath({ clubId, tab: "competitions", error: toUserMessage(error, "No se pudo actualizar el torneo.") }));
    }

    await refreshAndRevalidate(clubId);
    redirect(buildClubDetailPath({ clubId, tab: "competitions", success: parsed.data.active ? "Torneo reactivado." : "Torneo dado de baja." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildClubDetailPath({ clubId, tab: "competitions", error: toUserMessage(error, "No se pudo actualizar el torneo.") }));
  }
}

export async function addClubTeamAction(clubId: string, formData: FormData) {
  try {
    await assertClubWriteAction(clubId);
    const parsed = teamSchema.safeParse({
      name: formData.get("name"),
      shortName: formData.get("shortName"),
      modality: formData.get("modality"),
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
      modality: parsed.data.modality,
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

export async function updateClubTeamAction(clubId: string, formData: FormData) {
  try {
    await assertClubWriteAction(clubId);
    const parsed = teamUpdateSchema.safeParse({
      teamId: formData.get("teamId"),
      name: formData.get("name"),
      shortName: formData.get("shortName"),
      modality: formData.get("modality"),
      active: formData.get("active") === "true",
      notes: formData.get("notes")
    });

    if (!parsed.success) {
      redirect(buildClubDetailPath({ clubId, tab: "teams", error: parsed.error.issues[0]?.message ?? "Datos invalidos." }));
    }

    const supabase = await createSupabaseServerClient();
    const { data: team, error } = await supabase
      .from("club_teams")
      .update({
        name: parsed.data.name.trim(),
        short_name: parsed.data.shortName?.trim() || null,
        modality: parsed.data.modality,
        notes: parsed.data.notes?.trim() || null,
        active: parsed.data.active
      })
      .eq("id", parsed.data.teamId)
      .eq("club_id", clubId)
      .select("id")
      .maybeSingle();

    if (error || !team) {
      const userMessage =
        error?.code === "23505"
          ? "Ya existe un equipo con ese nombre en el club."
          : toUserMessage(error, "No se pudo actualizar el equipo.");
      redirect(buildClubDetailPath({ clubId, tab: "teams", teamId: parsed.data.teamId, error: userMessage }));
    }

    await refreshAndRevalidate(clubId);
    redirect(buildClubDetailPath({ clubId, tab: "teams", teamId: parsed.data.teamId, success: "Equipo actualizado." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildClubDetailPath({ clubId, tab: "teams", error: toUserMessage(error, "No se pudo actualizar el equipo.") }));
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

export async function addClubTeamPlayersAction(clubId: string, formData: FormData) {
  try {
    await assertClubWriteAction(clubId);
    const parsed = rosterSchema.safeParse({
      teamId: formData.get("teamId")
    });

    if (!parsed.success) {
      redirect(buildClubDetailPath({ clubId, tab: "teams", error: "Falta el equipo." }));
    }

    const selectedPlayerIds = Array.from(new Set(
      formData
        .getAll("playerIds")
        .map((value) => String(value))
        .filter(Boolean)
    ));
    if (!selectedPlayerIds.length) {
      redirect(buildClubDetailPath({ clubId, tab: "teams", teamId: parsed.data.teamId, error: "Selecciona al menos un jugador para agregar." }));
    }

    const supabase = await createSupabaseServerClient();
    const [
      { data: team, error: teamError },
      { data: validPlayers, error: validPlayersError },
      { data: existingRows, error: existingError }
    ] = await Promise.all([
      supabase.from("club_teams").select("id").eq("id", parsed.data.teamId).eq("club_id", clubId).maybeSingle(),
      supabase.from("club_players").select("id").eq("club_id", clubId).eq("active", true).in("id", selectedPlayerIds),
      supabase.from("club_team_players").select("id, club_player_id").eq("club_team_id", parsed.data.teamId)
    ]);

    if (teamError || !team) {
      redirect(buildClubDetailPath({ clubId, tab: "teams", teamId: parsed.data.teamId, error: "No se encontro el equipo dentro de este club." }));
    }
    if (validPlayersError) {
      redirect(buildClubDetailPath({ clubId, tab: "teams", teamId: parsed.data.teamId, error: toUserMessage(validPlayersError, "No se pudieron validar los jugadores.") }));
    }
    if ((validPlayers ?? []).length !== selectedPlayerIds.length) {
      redirect(buildClubDetailPath({ clubId, tab: "teams", teamId: parsed.data.teamId, error: "Solo puedes agregar jugadores activos de este club." }));
    }
    if (existingError) {
      redirect(buildClubDetailPath({ clubId, tab: "teams", teamId: parsed.data.teamId, error: toUserMessage(existingError, "No se pudo leer el plantel actual.") }));
    }

    const existingPlayerIds = new Set((existingRows ?? []).map((row) => String(row.club_player_id)));
    const rowsToInsert = Array.from(selectedPlayerIds)
      .filter((playerId) => !existingPlayerIds.has(playerId))
      .map((playerId) => ({
        club_team_id: parsed.data.teamId,
        club_player_id: playerId
      }));

    if (!rowsToInsert.length) {
      redirect(buildClubDetailPath({ clubId, tab: "teams", teamId: parsed.data.teamId, success: "No habia jugadores nuevos para agregar." }));
    }

    if (rowsToInsert.length) {
      const { error } = await supabase.from("club_team_players").insert(rowsToInsert);
      if (error) {
        redirect(buildClubDetailPath({ clubId, tab: "teams", teamId: parsed.data.teamId, error: toUserMessage(error, "No se pudieron agregar jugadores al equipo.") }));
      }
    }

    await refreshAndRevalidate(clubId);
    redirect(buildClubDetailPath({ clubId, tab: "teams", teamId: parsed.data.teamId, success: "Jugadores agregados al equipo." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildClubDetailPath({ clubId, tab: "teams", error: toUserMessage(error, "No se pudieron agregar jugadores al equipo.") }));
  }
}

export async function removeClubTeamPlayerAction(clubId: string, formData: FormData) {
  try {
    await assertClubWriteAction(clubId);
    const parsed = teamPlayerSchema.safeParse({
      playerId: formData.get("playerId"),
      teamId: formData.get("teamId")
    });

    if (!parsed.success) {
      redirect(buildClubDetailPath({ clubId, tab: "teams", error: "Falta el jugador o el equipo." }));
    }

    const supabase = await createSupabaseServerClient();
    const { data: team, error: teamError } = await supabase
      .from("club_teams")
      .select("id")
      .eq("id", parsed.data.teamId)
      .eq("club_id", clubId)
      .maybeSingle();

    if (teamError || !team) {
      redirect(buildClubDetailPath({ clubId, tab: "teams", teamId: parsed.data.teamId, error: "No se encontro el equipo dentro de este club." }));
    }

    const { error } = await supabase
      .from("club_team_players")
      .delete()
      .eq("club_team_id", parsed.data.teamId)
      .eq("club_player_id", parsed.data.playerId);

    if (error) {
      redirect(buildClubDetailPath({ clubId, tab: "teams", teamId: parsed.data.teamId, error: toUserMessage(error, "No se pudo quitar el jugador del equipo.") }));
    }

    await refreshAndRevalidate(clubId);
    redirect(buildClubDetailPath({ clubId, tab: "teams", teamId: parsed.data.teamId, success: "Jugador quitado del equipo." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildClubDetailPath({ clubId, tab: "teams", error: toUserMessage(error, "No se pudo quitar el jugador del equipo.") }));
  }
}

export async function addClubMatchAction(clubId: string, formData: FormData) {
  try {
    const admin = await assertClubWriteAction(clubId);
    const parsed = matchSchema.safeParse({
      teamId: formData.get("teamId"),
      competitionId: formData.get("competitionId"),
      modality: formData.get("modality"),
      playedDate: String(formData.get("playedDate") ?? ""),
      playedTime: String(formData.get("playedTime") ?? ""),
      opponentName: formData.get("opponentName"),
      venue: formData.get("venue"),
      goalsFor: formData.get("goalsFor"),
      goalsAgainst: formData.get("goalsAgainst"),
      fieldCostAmount: formData.get("fieldCostAmount"),
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
    const participants: Array<
      ClubMatchSheetParticipantInput & {
        displayName: string;
        paidAmountCents: number;
        paymentStatus: ClubPaymentStatus;
      }
    > = [];

    for (const playerId of selectedPlayerIds) {
      if (!playersById.has(playerId)) continue;
      const paidAmountCents = parseCurrencyAmountToCents(formData.get(`playerPaidAmount:${playerId}`));
      if (paidAmountCents === null) {
        redirect(buildClubDetailPath({ clubId, tab: "matches", error: "El monto pagado de cancha debe ser un numero valido." }));
      }

      participants.push({
        playerId,
        role: playerRolesById.get(playerId) ?? "starter",
        goals: parseStatValue(formData.get(`playerGoals:${playerId}`)),
        assists: parseStatValue(formData.get(`playerAssists:${playerId}`)),
        isMvp: mvpKey === `player:${playerId}`,
        displayName: playersById.get(playerId) ?? "Jugador",
        paidAmountCents,
        paymentStatus: parsePaymentStatus(formData.get(`playerPaymentStatus:${playerId}`))
      });
    }

    for (let index = 1; index <= 6; index += 1) {
      const guestName = String(formData.get(`guestName:${index}`) ?? "").trim();
      if (!guestName) continue;
      const paidAmountCents = parseCurrencyAmountToCents(formData.get(`guestPaidAmount:${index}`));
      if (paidAmountCents === null) {
        redirect(buildClubDetailPath({ clubId, tab: "matches", error: "El monto pagado de cancha debe ser un numero valido." }));
      }
      participants.push({
        guestName,
        role: parseRole(formData.get(`guestRole:${index}`)),
        goals: parseStatValue(formData.get(`guestGoals:${index}`)),
        assists: parseStatValue(formData.get(`guestAssists:${index}`)),
        isMvp: mvpKey === `guest:${index}`,
        displayName: guestName,
        paidAmountCents,
        paymentStatus: parsePaymentStatus(formData.get(`guestPaymentStatus:${index}`))
      });
    }

    const [{ data: team, error: teamError }, { data: competition, error: competitionError }] = await Promise.all([
      supabase
        .from("club_teams")
        .select("id, modality")
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
    if (team.modality !== parsed.data.modality) {
      redirect(buildClubDetailPath({ clubId, tab: "matches", error: "La modalidad del equipo cambio. Recarga la pagina y vuelve a intentar." }));
    }

    const validationErrors = validateClubMatchSheet({
      modality: team.modality,
      goalsFor: parsed.data.goalsFor,
      goalsAgainst: parsed.data.goalsAgainst,
      participants
    });

    if (validationErrors.length) {
      redirect(buildClubDetailPath({ clubId, tab: "matches", error: validationErrors[0] }));
    }

    const fieldCostCents = parseCurrencyAmountToCents(formData.get("fieldCostAmount"));
    if (fieldCostCents === null) {
      redirect(buildClubDetailPath({ clubId, tab: "matches", error: "El costo de cancha debe ser un numero valido." }));
    }

    const paymentDrafts = splitClubMatchCost(
      fieldCostCents,
      participants.map((_, index) => String(index))
    ).map((share, index) => {
      const participant = participants[index];
      const resolvedPayment = resolvePaidCents({
        expectedCents: share.expectedCents,
        paidAmountCents: participant.paidAmountCents,
        status: participant.paymentStatus
      });

      return {
        expectedCents: share.expectedCents,
        paidCents: resolvedPayment.paidCents,
        error: resolvedPayment.error
      };
    });
    const firstPaymentError = paymentDrafts.find((draft) => draft.error)?.error;
    if (firstPaymentError) {
      redirect(buildClubDetailPath({ clubId, tab: "matches", error: firstPaymentError }));
    }

    const { data: match, error: matchError } = await supabase
      .from("club_matches")
      .insert({
        club_id: clubId,
        club_team_id: parsed.data.teamId,
        club_competition_id: parsed.data.competitionId,
        modality: team.modality,
        played_at: matchDateAndTimeToIso(parsed.data.playedDate, parsed.data.playedTime),
        opponent_name: parsed.data.opponentName.trim(),
        venue: parsed.data.venue?.trim() || null,
        goals_for: parsed.data.goalsFor,
        goals_against: parsed.data.goalsAgainst,
        field_cost_cents: fieldCostCents,
        field_cost_currency: "ARS",
        status: "played",
        notes: parsed.data.notes?.trim() || null,
        created_by: admin.userId
      })
      .select("id")
      .single();

    if (matchError || !match) {
      redirect(buildClubDetailPath({ clubId, tab: "matches", error: toUserMessage(matchError, "No se pudo crear el partido.") }));
    }

    const insertedLineups: Array<{ index: number; lineupId: string }> = [];
    for (const [index, participant] of participants.entries()) {
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
      insertedLineups.push({ index, lineupId: String(lineup.id) });

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

    const paidAt = new Date().toISOString();
    const paymentRows = insertedLineups.map((lineup) => {
      const draft = paymentDrafts[lineup.index];
      return {
        match_id: match.id,
        lineup_id: lineup.lineupId,
        expected_cents: draft.expectedCents,
        paid_cents: draft.paidCents,
        paid_at: draft.paidCents > 0 ? paidAt : null,
        updated_by: admin.userId
      };
    });

    if (paymentRows.length) {
      const { error: paymentError } = await supabase.from("club_match_payments").insert(paymentRows);
      if (paymentError) {
        redirect(buildClubDetailPath({ clubId, tab: "matches", error: toUserMessage(paymentError, "No se pudieron guardar los pagos de cancha.") }));
      }
    }

    await refreshAndRevalidate(clubId);
    redirect(buildClubDetailPath({ clubId, tab: "matches", success: "Partido cargado." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildClubDetailPath({ clubId, tab: "matches", error: toUserMessage(error, "No se pudo cargar el partido.") }));
  }
}

export async function updateClubMatchFinanceAction(clubId: string, formData: FormData) {
  const tab = formData.get("returnTab") === "matches" ? "matches" : "finances";
  try {
    const admin = await assertClubWriteAction(clubId);
    const parsed = matchFinanceSchema.safeParse({
      matchId: formData.get("matchId")
    });

    if (!parsed.success) {
      redirect(buildClubDetailPath({ clubId, tab, error: "Falta el partido a actualizar." }));
    }

    const supabase = await createSupabaseServerClient();
    const { data: match, error: matchError } = await supabase
      .from("club_matches")
      .select("id")
      .eq("id", parsed.data.matchId)
      .eq("club_id", clubId)
      .maybeSingle();

    if (matchError || !match) {
      redirect(buildClubDetailPath({ clubId, tab, error: "No se encontro el partido dentro de este club." }));
    }

    const { data: payments, error: paymentsError } = await supabase
      .from("club_match_payments")
      .select("id, expected_cents, paid_at")
      .eq("match_id", parsed.data.matchId);

    if (paymentsError) {
      redirect(buildClubDetailPath({ clubId, tab, error: toUserMessage(paymentsError, "No se pudieron leer los pagos del partido.") }));
    }

    const now = new Date().toISOString();
    for (const payment of payments ?? []) {
      const paidAmountCents = parseCurrencyAmountToCents(formData.get(`paidAmount:${payment.id}`));
      if (paidAmountCents === null) {
        redirect(buildClubDetailPath({ clubId, tab, error: "El monto pagado de cancha debe ser un numero valido." }));
      }

      const resolvedPayment = resolvePaidCents({
        expectedCents: Number(payment.expected_cents ?? 0),
        paidAmountCents,
        status: parsePaymentStatus(formData.get(`paymentStatus:${payment.id}`))
      });
      if (resolvedPayment.error) {
        redirect(buildClubDetailPath({ clubId, tab, error: resolvedPayment.error }));
      }

      const notes = String(formData.get(`paymentNotes:${payment.id}`) ?? "").trim();
      const { error: updateError } = await supabase
        .from("club_match_payments")
        .update({
          paid_cents: resolvedPayment.paidCents,
          paid_at: resolvedPayment.paidCents > 0 ? payment.paid_at ?? now : null,
          notes: notes || null,
          updated_by: admin.userId
        })
        .eq("id", payment.id)
        .eq("match_id", parsed.data.matchId);

      if (updateError) {
        redirect(buildClubDetailPath({ clubId, tab, error: toUserMessage(updateError, "No se pudieron actualizar los pagos de cancha.") }));
      }
    }

    await revalidateClubPaths(clubId);
    redirect(buildClubDetailPath({ clubId, tab, success: "Pagos de cancha actualizados." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildClubDetailPath({ clubId, tab, error: toUserMessage(error, "No se pudieron actualizar los pagos de cancha.") }));
  }
}

export async function addClubCallupAction(clubId: string, formData: FormData) {
  try {
    const admin = await assertClubWriteAction(clubId);
    const parsed = callupSchema.safeParse({
      teamId: formData.get("teamId"),
      scheduledDate: String(formData.get("scheduledDate") ?? ""),
      scheduledTime: String(formData.get("scheduledTime") ?? ""),
      opponentName: formData.get("opponentName"),
      venue: formData.get("venue"),
      idealPlayerCount: formData.get("idealPlayerCount"),
      maxPlayerCount: formData.get("maxPlayerCount"),
      targetPaymentCount: formData.get("targetPaymentCount"),
      fullPaymentAmount: String(formData.get("fullPaymentAmount") ?? ""),
      fieldCostAmount: String(formData.get("fieldCostAmount") ?? ""),
      notes: formData.get("notes")
    });

    if (!parsed.success) {
      redirect(buildClubDetailPath({ clubId, tab: "callups", error: parsed.error.issues[0]?.message ?? "Datos invalidos." }));
    }
    if (parsed.data.maxPlayerCount < parsed.data.idealPlayerCount) {
      redirect(buildClubDetailPath({ clubId, tab: "callups", error: "El maximo de jugadores no puede ser menor al ideal." }));
    }

    const fullPaymentCents = parseCurrencyAmountToCents(formData.get("fullPaymentAmount"));
    const fieldCostCents = parseCurrencyAmountToCents(formData.get("fieldCostAmount"));
    if (fullPaymentCents === null || fullPaymentCents <= 0) {
      redirect(buildClubDetailPath({ clubId, tab: "callups", error: "El pago completo debe ser un numero mayor a 0." }));
    }
    if (fieldCostCents === null) {
      redirect(buildClubDetailPath({ clubId, tab: "callups", error: "El costo de cancha debe ser un numero valido." }));
    }

    const supabase = await createSupabaseServerClient();
    const { data: team, error: teamError } = await supabase
      .from("club_teams")
      .select("id")
      .eq("id", parsed.data.teamId)
      .eq("club_id", clubId)
      .eq("active", true)
      .maybeSingle();

    if (teamError || !team) {
      redirect(buildClubDetailPath({ clubId, tab: "callups", error: "No se encontro el equipo activo dentro de este club." }));
    }

    const { data: callup, error } = await supabase
      .from("club_callups")
      .insert({
        club_id: clubId,
        club_team_id: parsed.data.teamId,
        scheduled_at: matchDateAndTimeToIso(parsed.data.scheduledDate, parsed.data.scheduledTime),
        opponent_name: parsed.data.opponentName?.trim() || null,
        venue: parsed.data.venue?.trim() || null,
        ideal_player_count: parsed.data.idealPlayerCount,
        max_player_count: parsed.data.maxPlayerCount,
        target_payment_count: parsed.data.targetPaymentCount,
        full_payment_cents: fullPaymentCents,
        field_cost_cents: fieldCostCents,
        notes: parsed.data.notes?.trim() || null,
        created_by: admin.userId
      })
      .select("id")
      .single();

    if (error || !callup) {
      redirect(buildClubDetailPath({ clubId, tab: "callups", error: toUserMessage(error, "No se pudo crear la convocatoria.") }));
    }

    await revalidateClubPaths(clubId);
    redirect(buildClubDetailPath({ clubId, tab: "callups", callupId: String(callup.id), success: "Convocatoria creada." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildClubDetailPath({ clubId, tab: "callups", error: toUserMessage(error, "No se pudo crear la convocatoria.") }));
  }
}

export async function updateClubCallupPlayerAction(clubId: string, formData: FormData) {
  try {
    await assertClubWriteAction(clubId);
    const parsed = callupPlayerSchema.safeParse({
      callupId: formData.get("callupId"),
      playerId: formData.get("playerId"),
      status: formData.get("status"),
      expectedAmount: String(formData.get("expectedAmount") ?? ""),
      notes: formData.get("notes")
    });

    if (!parsed.success) {
      redirect(buildClubDetailPath({ clubId, tab: "callups", error: "Datos invalidos para la convocatoria." }));
    }

    const supabase = await createSupabaseServerClient();
    const [{ data: callup, error: callupError }, { data: player, error: playerError }] = await Promise.all([
      supabase
        .from("club_callups")
        .select("id")
        .eq("id", parsed.data.callupId)
        .eq("club_id", clubId)
        .maybeSingle(),
      supabase
        .from("club_players")
        .select("id")
        .eq("id", parsed.data.playerId)
        .eq("club_id", clubId)
        .maybeSingle()
    ]);

    if (callupError || !callup) {
      redirect(buildClubDetailPath({ clubId, tab: "callups", error: "No se encontro la convocatoria dentro de este club." }));
    }
    if (playerError || !player) {
      redirect(buildClubDetailPath({ clubId, tab: "callups", callupId: parsed.data.callupId, error: "No se encontro el jugador dentro de este club." }));
    }

    if (!parsed.data.status) {
      const { error } = await supabase
        .from("club_callup_players")
        .delete()
        .eq("callup_id", parsed.data.callupId)
        .eq("club_player_id", parsed.data.playerId);
      if (error) {
        redirect(buildClubDetailPath({ clubId, tab: "callups", callupId: parsed.data.callupId, error: toUserMessage(error, "No se pudo quitar el jugador de la convocatoria.") }));
      }
      await revalidateClubPaths(clubId);
      redirect(buildClubDetailPath({ clubId, tab: "callups", callupId: parsed.data.callupId, success: "Convocatoria actualizada." }));
    }

    const expectedCents = parseCurrencyAmountToCents(formData.get("expectedAmount"));
    if (expectedCents === null) {
      redirect(buildClubDetailPath({ clubId, tab: "callups", callupId: parsed.data.callupId, error: "El aporte esperado debe ser un numero valido." }));
    }

    const { error } = await supabase.from("club_callup_players").upsert(
      {
        callup_id: parsed.data.callupId,
        club_player_id: parsed.data.playerId,
        status: parsed.data.status,
        expected_cents: expectedCents || null,
        notes: parsed.data.notes?.trim() || null
      },
      { onConflict: "callup_id,club_player_id" }
    );

    if (error) {
      redirect(buildClubDetailPath({ clubId, tab: "callups", callupId: parsed.data.callupId, error: toUserMessage(error, "No se pudo actualizar la convocatoria.") }));
    }

    await revalidateClubPaths(clubId);
    redirect(buildClubDetailPath({ clubId, tab: "callups", callupId: parsed.data.callupId, success: "Convocatoria actualizada." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildClubDetailPath({ clubId, tab: "callups", error: toUserMessage(error, "No se pudo actualizar la convocatoria.") }));
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
