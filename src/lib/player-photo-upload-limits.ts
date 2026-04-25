import { addMonths, formatDistanceStrict } from "date-fns";
import { es } from "date-fns/locale";

export const PLAYER_PHOTO_UPLOAD_COOLDOWN_MONTHS = 3;
export const PLAYER_PHOTO_TARGET_LIMIT = 2;
export const CAPTAIN_PLAYER_PHOTO_TOTAL_LIMIT = 40;

export type PlayerPhotoUploaderRole = "organization_admin" | "league_admin" | "captain";
export type PlayerPhotoTargetType = "organization_player" | "competition_player";

export type PlayerPhotoUploadPolicy = {
  targetLimit: number;
  totalLimit: number | null;
  cooldownMonths: number;
};

type PlayerPhotoUploadEventRow = {
  created_at: string;
  uploader_id: string;
  uploader_role: PlayerPhotoUploaderRole;
  target_type: PlayerPhotoTargetType;
  target_player_id: string;
};

type PlayerPhotoUploadSelectResult = Promise<{
  data: PlayerPhotoUploadEventRow[] | null;
  error: { message: string } | null;
}>;

type PlayerPhotoUploadSelectChain = {
  eq: (column: string, value: string) => PlayerPhotoUploadSelectChain;
  gte: (column: string, value: string) => PlayerPhotoUploadSelectChain;
  order: (column: string, options?: { ascending?: boolean }) => PlayerPhotoUploadSelectResult;
};

export function getPlayerPhotoUploadPolicy(role: PlayerPhotoUploaderRole): PlayerPhotoUploadPolicy {
  return {
    targetLimit: PLAYER_PHOTO_TARGET_LIMIT,
    totalLimit: role === "captain" ? CAPTAIN_PLAYER_PHOTO_TOTAL_LIMIT : null,
    cooldownMonths: PLAYER_PHOTO_UPLOAD_COOLDOWN_MONTHS
  };
}

export function getPlayerPhotoUploadWindowStart(params: {
  now: Date;
  cooldownMonths: number;
}) {
  return addMonths(params.now, -params.cooldownMonths);
}

export function buildPhotoUploadCooldownMessage(params: {
  label: string;
  limit: number;
  oldestAt: string;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const resetAt = addMonths(new Date(params.oldestAt), PLAYER_PHOTO_UPLOAD_COOLDOWN_MONTHS);
  const relative =
    resetAt > now
      ? formatDistanceStrict(resetAt, now, { locale: es, addSuffix: true })
      : "muy pronto";

  return `Ya alcanzaste el limite de ${params.limit} ${params.label}. Podras volver a subir ${relative}.`;
}

export async function assertPlayerPhotoUploadAllowed(params: {
  supabase: {
    from: (table: "player_photo_upload_events") => {
      select: (columns: string) => PlayerPhotoUploadSelectChain;
    };
  };
  uploaderId: string;
  uploaderRole: PlayerPhotoUploaderRole;
  targetPlayerId: string;
  targetType: PlayerPhotoTargetType;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const policy = getPlayerPhotoUploadPolicy(params.uploaderRole);
  const windowStart = getPlayerPhotoUploadWindowStart({
    now,
    cooldownMonths: policy.cooldownMonths
  });

  const { data: rows, error } = await params.supabase
    .from("player_photo_upload_events")
    .select("created_at, uploader_id, uploader_role, target_type, target_player_id")
    .eq("uploader_id", params.uploaderId)
    .eq("uploader_role", params.uploaderRole)
    .gte("created_at", windowStart.toISOString())
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const uploadRows: PlayerPhotoUploadEventRow[] = rows ?? [];
  const targetUploads = uploadRows.filter(
    (row) =>
      row.target_type === params.targetType &&
      row.target_player_id === params.targetPlayerId
  );

  if (targetUploads.length >= policy.targetLimit) {
    throw new Error(
      buildPhotoUploadCooldownMessage({
        label: "reemplazos para este jugador",
        limit: policy.targetLimit,
        oldestAt: targetUploads[0].created_at,
        now
      })
    );
  }

  if (policy.totalLimit !== null && uploadRows.length >= policy.totalLimit) {
    throw new Error(
      buildPhotoUploadCooldownMessage({
        label: "fotos en este periodo",
        limit: policy.totalLimit,
        oldestAt: uploadRows[0].created_at,
        now
      })
    );
  }
}

export async function registerPlayerPhotoUploadEvent(params: {
  supabase: {
    from: (table: "player_photo_upload_events") => {
      insert: (value: {
        uploader_id: string;
        uploader_role: PlayerPhotoUploaderRole;
        target_type: PlayerPhotoTargetType;
        target_player_id: string;
      }) => Promise<{ error: { message: string } | null }>;
    };
  };
  uploaderId: string;
  uploaderRole: PlayerPhotoUploaderRole;
  targetPlayerId: string;
  targetType: PlayerPhotoTargetType;
}) {
  const { error } = await params.supabase.from("player_photo_upload_events").insert({
    uploader_id: params.uploaderId,
    uploader_role: params.uploaderRole,
    target_type: params.targetType,
    target_player_id: params.targetPlayerId
  });

  if (error) {
    throw new Error(error.message);
  }
}
