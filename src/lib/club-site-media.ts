import sharp from "sharp";

import type { ClubProductRecord, ClubSiteSettings } from "@/lib/domain/club-sites";

export const MAX_CLUB_SITE_IMAGE_SIZE_MB = 10;
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
    .resize(1800, 1100, {
      fit: "cover",
      position: "center"
    })
    .webp({ quality: 86 })
    .toBuffer();
}

export async function optimizeClubProductImage(file: File) {
  const sourceBuffer = Buffer.from(await file.arrayBuffer());

  return sharp(sourceBuffer)
    .rotate()
    .resize(1000, 1000, {
      fit: "cover",
      position: "center"
    })
    .webp({ quality: 86 })
    .toBuffer();
}
