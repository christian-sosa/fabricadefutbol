import type { ClubRecord } from "@/lib/domain/clubs";

export const CLUB_SITE_SECTION_KEYS = [
  "catalog",
  "teamData",
  "activity",
  "teams",
  "matches",
  "playerStats",
  "records"
] as const;

export type ClubSiteSectionKey = (typeof CLUB_SITE_SECTION_KEYS)[number];

export type ClubSiteSectionVisibility = Record<ClubSiteSectionKey, boolean>;

export type ClubSiteFontFamily = "system" | "inter" | "montserrat" | "oswald";

export type ClubProductContactChannel = "whatsapp" | "instagram" | "custom";

export type ClubProductStatus = "available" | "sold_out" | "preorder" | "hidden";

export type ClubSiteSettingsRow = {
  club_id: string;
  enabled?: boolean | null;
  published?: boolean | null;
  domain?: string | null;
  hero_image_path?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
  font_family?: string | null;
  whatsapp_url_or_phone?: string | null;
  instagram_url?: string | null;
  section_visibility?: unknown;
  created_at?: string;
  updated_at?: string;
};

export type ClubSiteSettings = {
  clubId: string;
  enabled: boolean;
  published: boolean;
  domain: string | null;
  heroImagePath: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: ClubSiteFontFamily;
  whatsappUrlOrPhone: string | null;
  instagramUrl: string | null;
  sectionVisibility: ClubSiteSectionVisibility;
};

export type ClubProductRecord = {
  id: string;
  club_id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  image_path: string | null;
  price_label: string | null;
  status: ClubProductStatus | string;
  visible: boolean;
  sort_order: number;
  contact_channel: ClubProductContactChannel | string;
  contact_url: string | null;
  contact_message: string | null;
  created_at: string;
  updated_at: string;
};

export const DEFAULT_CLUB_SITE_SECTION_VISIBILITY: ClubSiteSectionVisibility = {
  catalog: true,
  teamData: true,
  activity: true,
  teams: true,
  matches: true,
  playerStats: true,
  records: true
};

export const DEFAULT_CLUB_SITE_COLORS = {
  primary: "#ff9900",
  secondary: "#0a0908",
  accent: "#25D366"
} as const;

const CLUB_SITE_FONTS = new Set<ClubSiteFontFamily>(["system", "inter", "montserrat", "oswald"]);

function cleanText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeHexColor(value: unknown, fallback: string) {
  const raw = cleanText(value);
  if (!raw) return fallback;
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw;
  return fallback;
}

function normalizeBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function normalizeFontFamily(value: unknown): ClubSiteFontFamily {
  const normalized = cleanText(value)?.toLowerCase();
  return CLUB_SITE_FONTS.has(normalized as ClubSiteFontFamily)
    ? (normalized as ClubSiteFontFamily)
    : "system";
}

function normalizeSectionVisibility(value: unknown): ClubSiteSectionVisibility {
  const source = typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : {};

  return CLUB_SITE_SECTION_KEYS.reduce<ClubSiteSectionVisibility>((visibility, key) => {
    visibility[key] = typeof source[key] === "boolean"
      ? Boolean(source[key])
      : DEFAULT_CLUB_SITE_SECTION_VISIBILITY[key];
    return visibility;
  }, { ...DEFAULT_CLUB_SITE_SECTION_VISIBILITY });
}

export function normalizeClubSiteSettings(
  row: Partial<ClubSiteSettingsRow> | null | undefined,
  club: Pick<ClubRecord, "id">
): ClubSiteSettings {
  return {
    clubId: row?.club_id ?? club.id,
    enabled: normalizeBoolean(row?.enabled),
    published: normalizeBoolean(row?.published),
    domain: cleanText(row?.domain)?.replace(/^https?:\/\//i, "").replace(/\/+$/, "") ?? null,
    heroImagePath: cleanText(row?.hero_image_path),
    primaryColor: normalizeHexColor(row?.primary_color, DEFAULT_CLUB_SITE_COLORS.primary),
    secondaryColor: normalizeHexColor(row?.secondary_color, DEFAULT_CLUB_SITE_COLORS.secondary),
    accentColor: normalizeHexColor(row?.accent_color, DEFAULT_CLUB_SITE_COLORS.accent),
    fontFamily: normalizeFontFamily(row?.font_family),
    whatsappUrlOrPhone: cleanText(row?.whatsapp_url_or_phone),
    instagramUrl: cleanText(row?.instagram_url),
    sectionVisibility: normalizeSectionVisibility(row?.section_visibility)
  };
}

export function buildClubSitePublicHref(
  club: Pick<ClubRecord, "slug">,
  settings: Pick<ClubSiteSettings, "domain">,
  path = "/"
) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (settings.domain) {
    return new URL(normalizedPath, `https://${settings.domain}`).toString().replace(/\/$/, normalizedPath === "/" ? "" : "/");
  }
  if (normalizedPath === "/") return `/clubs/${club.slug}`;
  return `/clubs/${club.slug}${normalizedPath}`;
}

export function normalizeClubSiteHost(host: string | null | undefined) {
  return String(host ?? "").trim().toLowerCase().replace(/^https?:\/\//i, "").replace(/^www\./, "").split(":")[0] ?? "";
}

export function isClubSiteCustomDomainHost(
  host: string | null | undefined,
  settings: Pick<ClubSiteSettings, "domain">
) {
  const requestHost = normalizeClubSiteHost(host);
  const configuredHost = normalizeClubSiteHost(settings.domain);
  return Boolean(requestHost && configuredHost && requestHost === configuredHost);
}

function normalizeContactChannel(value: unknown): ClubProductContactChannel {
  return value === "instagram" || value === "custom" ? value : "whatsapp";
}

function buildWhatsAppHref(target: string | null, message: string) {
  const encodedMessage = encodeURIComponent(message);
  if (!target) return `https://wa.me/?text=${encodedMessage}`;
  if (/^https?:\/\//i.test(target)) {
    const separator = target.includes("?") ? "&" : "?";
    return `${target}${separator}text=${encodedMessage}`;
  }
  const phone = target.replace(/[^\d]/g, "");
  return phone ? `https://wa.me/${phone}?text=${encodedMessage}` : `https://wa.me/?text=${encodedMessage}`;
}

export function buildClubProductContactHref<Product extends Pick<ClubProductRecord, "contact_channel" | "contact_message" | "contact_url" | "name">>({
  clubName = "La Quinta",
  product,
  settings
}: {
  clubName?: string;
  product: Product;
  settings: Pick<ClubSiteSettings, "instagramUrl" | "whatsappUrlOrPhone">;
}) {
  const channel = normalizeContactChannel(product.contact_channel);
  const customUrl = cleanText(product.contact_url);
  const message = cleanText(product.contact_message) ?? `Hola ${clubName}, quiero consultar por ${product.name}.`;

  if (channel === "instagram") {
    return customUrl ?? settings.instagramUrl ?? "";
  }

  if (channel === "custom" && customUrl) {
    return customUrl;
  }

  return buildWhatsAppHref(customUrl ?? settings.whatsappUrlOrPhone, message);
}

export function filterVisibleClubProducts(products: ClubProductRecord[]) {
  return products
    .filter((product) => product.visible && product.status !== "hidden")
    .sort((left, right) => {
      if (left.sort_order !== right.sort_order) return left.sort_order - right.sort_order;
      return left.name.localeCompare(right.name, "es");
    });
}

export function formatClubSiteFontFamily(fontFamily: ClubSiteFontFamily) {
  switch (fontFamily) {
    case "inter":
      return "Inter, ui-sans-serif, system-ui, sans-serif";
    case "montserrat":
      return "Montserrat, Inter, ui-sans-serif, system-ui, sans-serif";
    case "oswald":
      return "Oswald, Impact, Inter, ui-sans-serif, system-ui, sans-serif";
    case "system":
      return "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif";
  }
}
