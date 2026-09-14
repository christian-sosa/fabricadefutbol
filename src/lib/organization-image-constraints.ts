// Keep the prepared file below the platform's 4.5 MB request limit, including multipart fields.
export const MAX_ORGANIZATION_IMAGE_SIZE_MB = 3;
export const MAX_ORGANIZATION_IMAGE_SIZE_BYTES = MAX_ORGANIZATION_IMAGE_SIZE_MB * 1024 * 1024;
export const MAX_ORGANIZATION_IMAGE_SOURCE_SIZE_MB = 20;
export const MAX_ORGANIZATION_IMAGE_SOURCE_SIZE_BYTES = MAX_ORGANIZATION_IMAGE_SOURCE_SIZE_MB * 1024 * 1024;
export const ORGANIZATION_IMAGE_WIDTH_PX = 1200;
export const ORGANIZATION_IMAGE_HEIGHT_PX = 675;
export const ORGANIZATION_IMAGE_QUALITY = 78;
export const MAX_ORGANIZATION_IMAGE_PIXELS = 40_000_000;

export function isSupportedOrganizationImageFile(file: File) {
  if (file.type) return ["image/jpeg", "image/png", "image/webp"].includes(file.type);
  return /\.(jpe?g|png|webp)$/i.test(file.name);
}
