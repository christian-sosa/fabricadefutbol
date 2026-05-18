import sharp from "sharp";

import type { ClubProductRecord, ClubSiteSettings } from "@/lib/domain/club-sites";

export const MAX_CLUB_SITE_HERO_IMAGE_SIZE_MB = 30;
export const MAX_CLUB_PRODUCT_IMAGE_SIZE_MB = 10;
export const CLUB_SITE_HERO_WIDTH_PX = 2400;
export const CLUB_SITE_HERO_HEIGHT_PX = 1600;
export const CLUB_SITE_HERO_QUALITY = 92;
export const CLUB_PRODUCT_IMAGE_SIZE_PX = 1000;
export const CLUB_PRODUCT_IMAGE_QUALITY = 86;
export const CLUB_SITE_HERO_CACHE_CONTROL = "no-store";
export const CLUB_PRODUCT_IMAGE_CACHE_CONTROL = "no-store";

const CLUB_SITE_IMAGE_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function isSupportedClubSiteImageFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (CLUB_SITE_IMAGE_CONTENT_TYPES.has(file.type)) return true;
  return ["jpg", "jpeg", "png", "webp"].includes(extension);
}

export function getClubSiteHeroObjectPath(schemaName: string, clubId: string) {
  return `${schemaName}/clubs/${clubId}/hero.webp`;
}

export function getClubProductImageObjectPath(schemaName: string, clubId: string, productId: string) {
  return `${schemaName}/clubs/${clubId}/products/${productId}.webp`;
}

export function getClubSiteHeroUrl(
  clubId: string,
  settings?: Pick<ClubSiteSettings, "heroImagePath"> | null
) {
  if (settings?.heroImagePath?.startsWith("/")) return settings.heroImagePath;
  return `/api/club-site-hero/${clubId}`;
}

export function getClubProductImageUrl(product: Pick<ClubProductRecord, "id" | "image_path">) {
  if (product.image_path?.startsWith("/")) return product.image_path;
  return product.image_path ? `/api/club-product-image/${product.id}` : null;
}

export async function optimizeClubSiteHeroImage(file: File) {
  const sourceBuffer = Buffer.from(await file.arrayBuffer());

  return sharp(sourceBuffer)
    .rotate()
    .resize(CLUB_SITE_HERO_WIDTH_PX, CLUB_SITE_HERO_HEIGHT_PX, {
      fit: "inside",
      withoutEnlargement: true
    })
    .webp({ quality: CLUB_SITE_HERO_QUALITY })
    .toBuffer();
}

export async function optimizeClubProductImage(file: File) {
  const sourceBuffer = Buffer.from(await file.arrayBuffer());

  return sharp(sourceBuffer)
    .rotate()
    .resize(CLUB_PRODUCT_IMAGE_SIZE_PX, CLUB_PRODUCT_IMAGE_SIZE_PX, {
      fit: "cover",
      position: "center"
    })
    .webp({ quality: CLUB_PRODUCT_IMAGE_QUALITY })
    .toBuffer();
}
