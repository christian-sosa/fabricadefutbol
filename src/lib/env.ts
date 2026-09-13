type SupabaseTargetEnv = "development" | "production";

const NEXT_PUBLIC_ENV = {
  NEXT_PUBLIC_SUPABASE_TARGET_ENV: process.env.NEXT_PUBLIC_SUPABASE_TARGET_ENV,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_URL_DEV: process.env.NEXT_PUBLIC_SUPABASE_URL_DEV,
  NEXT_PUBLIC_SUPABASE_URL_PROD: process.env.NEXT_PUBLIC_SUPABASE_URL_PROD,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY_DEV:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY_DEV,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY_PROD:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY_PROD,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY_DEV:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY_DEV,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY_PROD:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY_PROD,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SUPABASE_ANON_KEY_DEV: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_DEV,
  NEXT_PUBLIC_SUPABASE_ANON_KEY_PROD: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_PROD,
  NEXT_PUBLIC_SUPABASE_DB_SCHEMA: process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA,
  NEXT_PUBLIC_SUPABASE_DB_SCHEMA_DEV: process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA_DEV,
  NEXT_PUBLIC_SUPABASE_DB_SCHEMA_PROD: process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA_PROD,
  NEXT_PUBLIC_SUPABASE_PLAYER_PHOTOS_BUCKET:
    process.env.NEXT_PUBLIC_SUPABASE_PLAYER_PHOTOS_BUCKET,
  NEXT_PUBLIC_SUPABASE_PLAYER_PHOTOS_BUCKET_DEV:
    process.env.NEXT_PUBLIC_SUPABASE_PLAYER_PHOTOS_BUCKET_DEV,
  NEXT_PUBLIC_SUPABASE_PLAYER_PHOTOS_BUCKET_PROD:
    process.env.NEXT_PUBLIC_SUPABASE_PLAYER_PHOTOS_BUCKET_PROD,
  NEXT_PUBLIC_SUPABASE_ORGANIZATION_IMAGES_BUCKET:
    process.env.NEXT_PUBLIC_SUPABASE_ORGANIZATION_IMAGES_BUCKET,
  NEXT_PUBLIC_SUPABASE_ORGANIZATION_IMAGES_BUCKET_DEV:
    process.env.NEXT_PUBLIC_SUPABASE_ORGANIZATION_IMAGES_BUCKET_DEV,
  NEXT_PUBLIC_SUPABASE_ORGANIZATION_IMAGES_BUCKET_PROD:
    process.env.NEXT_PUBLIC_SUPABASE_ORGANIZATION_IMAGES_BUCKET_PROD,
  NEXT_PUBLIC_ENABLE_ADS: process.env.NEXT_PUBLIC_ENABLE_ADS,
  NEXT_PUBLIC_ADSENSE_CLIENT_ID: process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID,
  NEXT_PUBLIC_SPEED_INSIGHTS_ENABLED:
    process.env.NEXT_PUBLIC_SPEED_INSIGHTS_ENABLED
} as const;

function getEnv(name: string) {
  const isPublicKey = name.startsWith("NEXT_PUBLIC_");
  const isBrowser = typeof window !== "undefined";
  const value = isPublicKey
    ? NEXT_PUBLIC_ENV[name as keyof typeof NEXT_PUBLIC_ENV]
    : isBrowser
      ? undefined
      : process.env[name];

  const normalized = value?.trim();
  if (!normalized) return null;
  return normalized;
}

function firstDefined(names: string[]) {
  for (const name of names) {
    const value = getEnv(name);
    if (value) return value;
  }
  return null;
}

function getServerEnv(name: string) {
  if (typeof window !== "undefined") return null;
  const value = process.env[name]?.trim();
  if (!value) return null;
  return value;
}

function firstServerDefined(names: string[]) {
  for (const name of names) {
    const value = getServerEnv(name);
    if (value) return value;
  }
  return null;
}

function parseBooleanEnv(value: string | null, fallback = false) {
  if (value === null) return fallback;
  const normalized = value.toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

export function shouldRenderAds() {
  return parseBooleanEnv(getEnv("NEXT_PUBLIC_ENABLE_ADS"), false);
}

export function getAdsenseClientId() {
  return getEnv("NEXT_PUBLIC_ADSENSE_CLIENT_ID");
}

export function shouldRenderSpeedInsights() {
  return parseBooleanEnv(getEnv("NEXT_PUBLIC_SPEED_INSIGHTS_ENABLED"), false);
}

export function getSupabaseTargetEnv(): SupabaseTargetEnv {
  const configured = getEnv("NEXT_PUBLIC_SUPABASE_TARGET_ENV");
  if (configured === "development" || configured === "production") return configured;
  if (configured) throw new Error("NEXT_PUBLIC_SUPABASE_TARGET_ENV debe ser development o production.");
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

function isPlaceholderServiceRoleKey(value: string) {
  const normalized = value.toLowerCase();
  return (
    normalized === "your-service-role-key-optional" ||
    normalized === "your-service-role-key" ||
    normalized.startsWith("sb_service_role_") ||
    normalized.includes("your-service-role-key") ||
    normalized.includes("replace-with-service-role-key")
  );
}

export function getSupabaseUrl() {
  const targetEnv = getSupabaseTargetEnv();
  const selected =
    targetEnv === "development"
      ? firstDefined(["NEXT_PUBLIC_SUPABASE_URL_DEV"])
      : firstDefined([
          "NEXT_PUBLIC_SUPABASE_URL",
          "NEXT_PUBLIC_SUPABASE_URL_PROD",
        ]);
  const value = selected;

  if (!value) {
    throw new Error(
      "Falta la URL de Supabase. Defini NEXT_PUBLIC_SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL_DEV para local)."
    );
  }
  return value;
}

export function getSupabaseAnonKey() {
  const targetEnv = getSupabaseTargetEnv();
  const selected =
    targetEnv === "development"
      ? firstDefined(["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY_DEV", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY_DEV", "NEXT_PUBLIC_SUPABASE_ANON_KEY_DEV"])
      : firstDefined([
          "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY",
          "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
          "NEXT_PUBLIC_SUPABASE_ANON_KEY",
          "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY_PROD",
          "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY_PROD",
          "NEXT_PUBLIC_SUPABASE_ANON_KEY_PROD"
        ]);
  const value = selected;

  if (!value) {
    throw new Error(
      "Falta clave publica de Supabase. Defini NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY (o *_DEV para local)."
    );
  }
  return value;
}

export function isMissingSupabaseConfigurationError(error: unknown) {
  if (!(error instanceof Error)) return false;

  return (
    error.message.includes("Falta la URL de Supabase") ||
    error.message.includes("Falta clave publica de Supabase") ||
    error.message.includes("NEXT_PUBLIC_SUPABASE_URL") ||
    error.message.includes("NEXT_PUBLIC_SUPABASE_PUBLISHABLE")
  );
}

export function getSupabaseServiceRoleKey() {
  const targetEnv = getSupabaseTargetEnv();
  const rawValue =
    targetEnv === "development"
      ? firstDefined(["SUPABASE_SERVICE_ROLE_KEY_DEV"])
      : firstDefined(["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY_PROD"]);

  if (!rawValue || isPlaceholderServiceRoleKey(rawValue)) return null;
  return rawValue;
}

export function getSupabaseDbSchema() {
  const targetEnv = getSupabaseTargetEnv();
  const selected =
    targetEnv === "development"
      ? firstDefined(["NEXT_PUBLIC_SUPABASE_DB_SCHEMA_DEV"])
      : firstDefined([
          "NEXT_PUBLIC_SUPABASE_DB_SCHEMA",
          "NEXT_PUBLIC_SUPABASE_DB_SCHEMA_PROD",
        ]);
  const value = selected;

  const expected = targetEnv === "development" ? "app_dev" : "app_prod";
  if (value && value !== expected) throw new Error(`El schema de Supabase debe ser ${expected} para este entorno.`);
  return value ?? expected;
}

export function getPlayerPhotosBucket() {
  const targetEnv = getSupabaseTargetEnv();
  const selected =
    targetEnv === "development"
      ? firstDefined(["SUPABASE_PLAYER_PHOTOS_BUCKET_DEV", "NEXT_PUBLIC_SUPABASE_PLAYER_PHOTOS_BUCKET_DEV"])
      : firstDefined([
          "SUPABASE_PLAYER_PHOTOS_BUCKET",
          "NEXT_PUBLIC_SUPABASE_PLAYER_PHOTOS_BUCKET",
          "SUPABASE_PLAYER_PHOTOS_BUCKET_PROD",
          "NEXT_PUBLIC_SUPABASE_PLAYER_PHOTOS_BUCKET_PROD"
        ]);
  const value = selected;

  return value ?? (targetEnv === "development" ? "player-photos-dev" : "player-photos");
}

export function getOrganizationImagesBucket() {
  const targetEnv = getSupabaseTargetEnv();
  const selected =
    targetEnv === "development"
      ? firstDefined(["SUPABASE_ORGANIZATION_IMAGES_BUCKET_DEV", "NEXT_PUBLIC_SUPABASE_ORGANIZATION_IMAGES_BUCKET_DEV"])
      : firstDefined([
          "SUPABASE_ORGANIZATION_IMAGES_BUCKET",
          "NEXT_PUBLIC_SUPABASE_ORGANIZATION_IMAGES_BUCKET",
          "SUPABASE_ORGANIZATION_IMAGES_BUCKET_PROD",
          "NEXT_PUBLIC_SUPABASE_ORGANIZATION_IMAGES_BUCKET_PROD"
        ]);
  const value = selected;

  return value ?? (targetEnv === "development" ? "organization-images-dev" : "organization-images");
}

export function getResendApiKey() {
  const targetEnv = getSupabaseTargetEnv();
  const selected =
    targetEnv === "development"
      ? firstServerDefined(["RESEND_API_KEY_DEV"])
      : firstServerDefined(["RESEND_API_KEY", "RESEND_API_KEY_PROD"]);
  return selected;
}

export function getFeedbackInboxEmail() {
  const targetEnv = getSupabaseTargetEnv();
  const selected =
    targetEnv === "development"
      ? firstServerDefined(["FEEDBACK_TO_EMAIL_DEV"])
      : firstServerDefined(["FEEDBACK_TO_EMAIL", "FEEDBACK_TO_EMAIL_PROD"]);
  return selected ?? "info@fabricadefutbol.com.ar";
}

export function getFeedbackFromEmail() {
  const targetEnv = getSupabaseTargetEnv();
  const selected =
    targetEnv === "development"
      ? firstServerDefined(["FEEDBACK_FROM_EMAIL_DEV"])
      : firstServerDefined(["FEEDBACK_FROM_EMAIL", "FEEDBACK_FROM_EMAIL_PROD"]);
  return selected ?? "Fabrica de Futbol <no-reply@fabricadefutbol.com.ar>";
}

export function getInternalCronSecret() {
  const targetEnv = getSupabaseTargetEnv();
  const selected =
    targetEnv === "development"
      ? firstServerDefined(["INTERNAL_CRON_SECRET_DEV", "CRON_SECRET_DEV"])
      : firstServerDefined(["INTERNAL_CRON_SECRET", "CRON_SECRET", "INTERNAL_CRON_SECRET_PROD", "CRON_SECRET_PROD"]);

  return selected;
}
