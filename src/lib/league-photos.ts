import sharp from "sharp";

export const MAX_LEAGUE_PHOTO_SIZE_MB = 20;
export const LEAGUE_PHOTO_WIDTH_PX = 1600;
export const LEAGUE_PHOTO_HEIGHT_PX = 900;
export const LEAGUE_PHOTO_QUALITY = 84;
export const LEAGUE_PHOTO_CACHE_CONTROL = "no-store";

const LEAGUE_PHOTO_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function isSupportedLeaguePhotoFile(file: File) {
  if (LEAGUE_PHOTO_CONTENT_TYPES.has(file.type)) {
    return true;
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ["jpg", "jpeg", "png", "webp"].includes(extension);
}

export function getLeaguePhotoObjectPath(schemaName: string, leagueId: string) {
  return `${schemaName}/leagues/${leagueId}.webp`;
}

export function getLeaguePhotoUrl(leagueId: string) {
  return `/api/league-photo/${leagueId}`;
}

export async function optimizeLeaguePhotoImage(file: File) {
  const sourceBuffer = Buffer.from(await file.arrayBuffer());

  return sharp(sourceBuffer)
    .rotate()
    .resize(LEAGUE_PHOTO_WIDTH_PX, LEAGUE_PHOTO_HEIGHT_PX, {
      fit: "cover",
      position: "attention"
    })
    .webp({ quality: LEAGUE_PHOTO_QUALITY })
    .toBuffer();
}
