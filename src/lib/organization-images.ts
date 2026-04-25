import sharp from "sharp";

import { escapeXmlAttribute, escapeXmlText } from "@/lib/xml";

export const MAX_ORGANIZATION_IMAGE_SIZE_MB = 20;
export const ORGANIZATION_IMAGE_WIDTH_PX = 1600;
export const ORGANIZATION_IMAGE_HEIGHT_PX = 900;
export const ORGANIZATION_IMAGE_QUALITY = 84;
export const ORGANIZATION_IMAGE_CACHE_CONTROL = "no-store";
export const ORGANIZATION_IMAGE_PLACEHOLDER_CACHE_CONTROL = "no-store";

const ORGANIZATION_IMAGE_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function isSupportedOrganizationImageFile(file: File) {
  if (ORGANIZATION_IMAGE_CONTENT_TYPES.has(file.type)) {
    return true;
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ["jpg", "jpeg", "png", "webp"].includes(extension);
}

export function getOrganizationImageObjectPath(schemaName: string, organizationId: string) {
  return `${schemaName}/organizations/${organizationId}.webp`;
}

export function getOrganizationImageUrl(organizationId: string) {
  return `/api/organization-image/${organizationId}`;
}

export function buildOrganizationImagePlaceholderSvg(organizationName: string) {
  const safeOrganizationName = escapeXmlText(organizationName);
  const safeOrganizationNameAttribute = escapeXmlAttribute(organizationName);
  const initials =
    organizationName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((segment) => segment[0] ?? "")
      .join("")
      .toUpperCase() || "GR";
  const safeInitials = escapeXmlText(initials);

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" role="img" aria-label="${safeOrganizationNameAttribute}">
      <defs>
        <linearGradient id="group-photo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f172a" />
          <stop offset="45%" stop-color="#14532d" />
          <stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" rx="42" fill="url(#group-photo-gradient)" />
      <circle cx="1260" cy="220" r="160" fill="rgba(255,255,255,0.07)" />
      <circle cx="320" cy="720" r="220" fill="rgba(255,255,255,0.06)" />
      <text
        x="112"
        y="170"
        font-family="Arial, Helvetica, sans-serif"
        font-size="42"
        font-weight="700"
        fill="rgba(226,232,240,0.82)"
      >
        Fabrica de Futbol
      </text>
      <text
        x="112"
        y="792"
        font-family="Arial, Helvetica, sans-serif"
        font-size="160"
        font-weight="700"
        fill="#f8fafc"
      >
        ${safeInitials}
      </text>
      <text
        x="112"
        y="854"
        font-family="Arial, Helvetica, sans-serif"
        font-size="46"
        font-weight="500"
        fill="rgba(226,232,240,0.9)"
      >
        ${safeOrganizationName}
      </text>
    </svg>
  `.trim();
}

export async function optimizeOrganizationImage(file: File) {
  const sourceBuffer = Buffer.from(await file.arrayBuffer());

  return sharp(sourceBuffer)
    .rotate()
    .resize(ORGANIZATION_IMAGE_WIDTH_PX, ORGANIZATION_IMAGE_HEIGHT_PX, {
      fit: "cover",
      position: "attention"
    })
    .webp({ quality: ORGANIZATION_IMAGE_QUALITY })
    .toBuffer();
}
