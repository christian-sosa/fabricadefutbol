import sharp from "sharp";
import { MAX_PLAYER_PHOTO_PIXELS, MAX_PLAYER_PHOTO_SIZE_BYTES, PLAYER_AVATAR_SIZE_PX, PLAYER_AVATAR_QUALITY, isSupportedPlayerPhoto } from "@/lib/photo-constraints";
export { MAX_PLAYER_PHOTO_SIZE_MB, PLAYER_AVATAR_SIZE_PX, PLAYER_AVATAR_QUALITY } from "@/lib/photo-constraints";

const CONTENT_TYPE_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

export function inferPlayerPhotoExtension(file: File) {
  if (!isSupportedPlayerPhoto(file)) return null;
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
  playerId: string,
  revision?: string
) {
  if (revision) return `${schemaName}/${organizationId}/${playerId}/${revision}.webp`;
  return `${schemaName}/${organizationId}/${playerId}.webp`;
}

export function isOrganizationPlayerPhotoObjectPath(path: string, schema: string, organizationId: string, playerId: string) {
  if (path === getOrganizationPlayerPhotoObjectPath(schema, organizationId, playerId) || path === `${organizationId}/${playerId}.webp`) return true;
  const prefix = `${schema}/${organizationId}/${playerId}/`;
  return path.startsWith(prefix) && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/i.test(path.slice(prefix.length));
}

export async function optimizePlayerAvatarImage(file: File) {
  if (!isSupportedPlayerPhoto(file) || file.size <= 0) throw new Error("Seleccioná una imagen JPG, PNG o WEBP válida.");
  if (file.size > MAX_PLAYER_PHOTO_SIZE_BYTES) throw new Error("La imagen preparada no puede superar 5 MB.");
  const sourceBuffer = Buffer.from(await file.arrayBuffer());
  const optimizedBuffer = await sharp(sourceBuffer, { limitInputPixels: MAX_PLAYER_PHOTO_PIXELS })
    .rotate()
    .resize(PLAYER_AVATAR_SIZE_PX, PLAYER_AVATAR_SIZE_PX, {
      fit: "cover",
      position: "center"
    })
    .webp({ quality: PLAYER_AVATAR_QUALITY })
    .toBuffer();

  return optimizedBuffer;
}
