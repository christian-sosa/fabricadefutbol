import sharp from "sharp";

export const MAX_TEAM_LOGO_SIZE_MB = 10;
export const TEAM_LOGO_SIZE_PX = 512;
export const TEAM_LOGO_QUALITY = 88;
export const TEAM_LOGO_CACHE_CONTROL = "no-store";

const TEAM_LOGO_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);

export function isSupportedTeamLogoFile(file: File) {
  if (TEAM_LOGO_CONTENT_TYPES.has(file.type)) {
    return true;
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ["jpg", "jpeg", "png", "webp", "svg"].includes(extension);
}

export function getTeamLogoObjectPath(schemaName: string, leagueTeamId: string) {
  return `${schemaName}/league-teams/${leagueTeamId}.webp`;
}

export function getTeamLogoUrl(leagueTeamId: string) {
  return `/api/league-team-logo/${leagueTeamId}`;
}

export async function optimizeTeamLogoImage(file: File) {
  const sourceBuffer = Buffer.from(await file.arrayBuffer());

  return sharp(sourceBuffer)
    .rotate()
    .resize(TEAM_LOGO_SIZE_PX, TEAM_LOGO_SIZE_PX, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .webp({ quality: TEAM_LOGO_QUALITY })
    .toBuffer();
}
