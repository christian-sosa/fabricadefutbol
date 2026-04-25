import sharp from "sharp";

export const MAX_LEAGUE_LOGO_SIZE_MB = 10;
export const LEAGUE_LOGO_SIZE_PX = 512;
export const LEAGUE_LOGO_QUALITY = 88;
export const LEAGUE_LOGO_CACHE_CONTROL = "no-store";
export const LEAGUE_LOGO_PLACEHOLDER_CACHE_CONTROL = "no-store";

const LEAGUE_LOGO_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);

export function isSupportedLeagueLogoFile(file: File) {
  if (LEAGUE_LOGO_CONTENT_TYPES.has(file.type)) {
    return true;
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ["jpg", "jpeg", "png", "webp", "svg"].includes(extension);
}

export function getLeagueLogoObjectPath(schemaName: string, leagueId: string) {
  return `${schemaName}/leagues/${leagueId}.webp`;
}

export function getLeagueLogoUrl(leagueId: string) {
  return `/api/league-logo/${leagueId}`;
}

export function buildLeagueLogoPlaceholderSvg(leagueName: string) {
  const initials = leagueName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((segment) => segment[0] ?? "")
    .join("")
    .toUpperCase() || "LF";

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="${leagueName}">
      <defs>
        <linearGradient id="league-logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f172a" />
          <stop offset="100%" stop-color="#14532d" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="28" fill="url(#league-logo-gradient)" />
      <circle cx="64" cy="64" r="44" fill="rgba(255,255,255,0.08)" />
      <text
        x="64"
        y="74"
        text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif"
        font-size="34"
        font-weight="700"
        fill="#e2e8f0"
      >
        ${initials}
      </text>
    </svg>
  `.trim();
}

export async function optimizeLeagueLogoImage(file: File) {
  const sourceBuffer = Buffer.from(await file.arrayBuffer());

  return sharp(sourceBuffer)
    .rotate()
    .resize(LEAGUE_LOGO_SIZE_PX, LEAGUE_LOGO_SIZE_PX, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .webp({ quality: LEAGUE_LOGO_QUALITY })
    .toBuffer();
}
