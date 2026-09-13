// Browser-safe limits shared by the upload control and server validation.
export const MAX_PLAYER_PHOTO_SIZE_MB = 5;
export const MAX_PLAYER_PHOTO_SIZE_BYTES = MAX_PLAYER_PHOTO_SIZE_MB * 1024 * 1024;
export const MAX_PLAYER_PHOTO_SOURCE_SIZE_MB = 20;
export const MAX_PLAYER_PHOTO_SOURCE_SIZE_BYTES = MAX_PLAYER_PHOTO_SOURCE_SIZE_MB * 1024 * 1024;
export const MAX_PLAYER_PHOTO_PIXELS = 40_000_000;
export const PLAYER_AVATAR_SIZE_PX = 320;
export const PLAYER_AVATAR_QUALITY = 72;

export function isSupportedPlayerPhoto(file: Pick<File, "name" | "type">) {
  if (["image/jpeg", "image/png", "image/webp"].includes(file.type)) return true;
  return !file.type && /\.(jpe?g|png|webp)$/i.test(file.name);
}
