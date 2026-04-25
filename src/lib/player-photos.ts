import path from "node:path";

import sharp from "sharp";

export const MAX_PLAYER_PHOTO_SIZE_MB = 20;
export const PLAYER_AVATAR_SIZE_PX = 400;
export const PLAYER_AVATAR_QUALITY = 80;

export const PHOTO_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;

export const CONTENT_TYPE_BY_EXTENSION: Record<(typeof PHOTO_EXTENSIONS)[number], string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp"
};

const CONTENT_TYPE_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

export const PLAYER_PHOTO_CACHE_CONTROL =
  "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400";
export const PLAYER_PHOTO_PLACEHOLDER_CACHE_CONTROL = "public, max-age=86400, immutable";

export function inferPlayerPhotoExtension(file: File) {
  if (file.type in CONTENT_TYPE_EXTENSION) {
    return CONTENT_TYPE_EXTENSION[file.type] as keyof typeof CONTENT_TYPE_EXTENSION;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension) return null;
  if (["jpg", "jpeg", "png", "webp"].includes(extension)) return extension;
  return null;
}

export function getOrganizationPlayerPhotoObjectPath(
  schemaName: string,
  organizationId: string,
  playerId: string
) {
  return `${schemaName}/${organizationId}/${playerId}.webp`;
}

export function getTournamentPlayerPhotoObjectPath(
  schemaName: string,
  tournamentId: string,
  playerId: string
) {
  return `${schemaName}/tournaments/${tournamentId}/${playerId}.webp`;
}

export function getCompetitionPlayerPhotoObjectPath(
  schemaName: string,
  competitionId: string,
  playerId: string
) {
  return `${schemaName}/competitions/${competitionId}/${playerId}.webp`;
}

export function getLegacyPhotoPath(playerId: string, extension: (typeof PHOTO_EXTENSIONS)[number]) {
  return path.join(process.cwd(), "public", "players", `${playerId}.${extension}`);
}

export function getPlayerPhotoPlaceholderPath() {
  return path.join(process.cwd(), "public", "avatar-placeholder.svg");
}

export async function optimizePlayerAvatarImage(file: File) {
  const sourceBuffer = Buffer.from(await file.arrayBuffer());
  const optimizedBuffer = await sharp(sourceBuffer)
    .rotate()
    .resize(PLAYER_AVATAR_SIZE_PX, PLAYER_AVATAR_SIZE_PX, {
      fit: "cover",
      position: "center"
    })
    .webp({ quality: PLAYER_AVATAR_QUALITY })
    .toBuffer();

  return optimizedBuffer;
}
