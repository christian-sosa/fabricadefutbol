type SupabaseTargetEnv = "development" | "production";

const NEXT_PUBLIC_ENV = {
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
  NEXT_PUBLIC_SUPABASE_LEAGUE_LOGOS_BUCKET:
    process.env.NEXT_PUBLIC_SUPABASE_LEAGUE_LOGOS_BUCKET,
  NEXT_PUBLIC_SUPABASE_LEAGUE_LOGOS_BUCKET_DEV:
    process.env.NEXT_PUBLIC_SUPABASE_LEAGUE_LOGOS_BUCKET_DEV,
  NEXT_PUBLIC_SUPABASE_LEAGUE_LOGOS_BUCKET_PROD:
    process.env.NEXT_PUBLIC_SUPABASE_LEAGUE_LOGOS_BUCKET_PROD
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

function getSupabaseTargetEnv(): SupabaseTargetEnv {
  const configured = (getServerEnv("SUPABASE_TARGET_ENV") ?? "").toLowerCase();
  if (configured === "dev" || configured === "development") return "development";
  if (configured === "prod" || configured === "production") return "production";
  return process.env.NODE_ENV === "development" ? "development" : "production";
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
      ? firstDefined([
          "NEXT_PUBLIC_SUPABASE_URL_DEV",
          "SUPABASE_URL_DEV",
          "NEXT_PUBLIC_SUPABASE_URL",
          "SUPABASE_URL"
        ])
      : firstDefined([
          "NEXT_PUBLIC_SUPABASE_URL",
          "SUPABASE_URL",
          "NEXT_PUBLIC_SUPABASE_URL_PROD",
          "SUPABASE_URL_PROD"
        ]);
  const fallback = firstDefined([
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL_DEV",
    "SUPABASE_URL_DEV",
    "NEXT_PUBLIC_SUPABASE_URL_PROD",
    "SUPABASE_URL_PROD"
  ]);
  const value = selected ?? fallback;

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
      ? firstDefined([
          "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY_DEV",
          "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY_DEV",
          "NEXT_PUBLIC_SUPABASE_ANON_KEY_DEV",
          "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY",
          "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
          "NEXT_PUBLIC_SUPABASE_ANON_KEY"
        ])
      : firstDefined([
          "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY",
          "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
          "NEXT_PUBLIC_SUPABASE_ANON_KEY",
          "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY_PROD",
          "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY_PROD",
          "NEXT_PUBLIC_SUPABASE_ANON_KEY_PROD"
        ]);
  const fallback = firstDefined([
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY_DEV",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY_DEV",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY_DEV",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY_PROD",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY_PROD",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY_PROD"
  ]);
  const value = selected ?? fallback;

  if (!value) {
    throw new Error(
      "Falta clave publica de Supabase. Defini NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY (o *_DEV para local)."
    );
  }
  return value;
}

export function getSupabaseServiceRoleKey() {
  const targetEnv = getSupabaseTargetEnv();
  const rawValue =
    targetEnv === "development"
      ? firstDefined(["SUPABASE_SERVICE_ROLE_KEY_DEV", "SUPABASE_SERVICE_ROLE_KEY"])
      : firstDefined(["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY_PROD"]);

  if (!rawValue || isPlaceholderServiceRoleKey(rawValue)) return null;
  return rawValue;
}

export function getSupabaseDbSchema() {
  const targetEnv = getSupabaseTargetEnv();
  const selected =
    targetEnv === "development"
      ? firstDefined([
          "NEXT_PUBLIC_SUPABASE_DB_SCHEMA_DEV",
          "SUPABASE_DB_SCHEMA_DEV",
          "NEXT_PUBLIC_SUPABASE_DB_SCHEMA",
          "SUPABASE_DB_SCHEMA"
        ])
      : firstDefined([
          "NEXT_PUBLIC_SUPABASE_DB_SCHEMA",
          "SUPABASE_DB_SCHEMA",
          "NEXT_PUBLIC_SUPABASE_DB_SCHEMA_PROD",
          "SUPABASE_DB_SCHEMA_PROD"
        ]);
  const fallback = firstDefined([
    "NEXT_PUBLIC_SUPABASE_DB_SCHEMA",
    "SUPABASE_DB_SCHEMA",
    "NEXT_PUBLIC_SUPABASE_DB_SCHEMA_DEV",
    "SUPABASE_DB_SCHEMA_DEV",
    "NEXT_PUBLIC_SUPABASE_DB_SCHEMA_PROD",
    "SUPABASE_DB_SCHEMA_PROD"
  ]);
  const value = selected ?? fallback;

  return value ?? "public";
}

export function getPlayerPhotosBucket() {
  const targetEnv = getSupabaseTargetEnv();
  const selected =
    targetEnv === "development"
      ? firstDefined([
          "SUPABASE_PLAYER_PHOTOS_BUCKET_DEV",
          "NEXT_PUBLIC_SUPABASE_PLAYER_PHOTOS_BUCKET_DEV",
          "SUPABASE_PLAYER_PHOTOS_BUCKET",
          "NEXT_PUBLIC_SUPABASE_PLAYER_PHOTOS_BUCKET"
        ])
      : firstDefined([
          "SUPABASE_PLAYER_PHOTOS_BUCKET",
          "NEXT_PUBLIC_SUPABASE_PLAYER_PHOTOS_BUCKET",
          "SUPABASE_PLAYER_PHOTOS_BUCKET_PROD",
          "NEXT_PUBLIC_SUPABASE_PLAYER_PHOTOS_BUCKET_PROD"
        ]);
  const fallback = firstDefined([
    "SUPABASE_PLAYER_PHOTOS_BUCKET",
    "NEXT_PUBLIC_SUPABASE_PLAYER_PHOTOS_BUCKET",
    "SUPABASE_PLAYER_PHOTOS_BUCKET_DEV",
    "NEXT_PUBLIC_SUPABASE_PLAYER_PHOTOS_BUCKET_DEV",
    "SUPABASE_PLAYER_PHOTOS_BUCKET_PROD",
    "NEXT_PUBLIC_SUPABASE_PLAYER_PHOTOS_BUCKET_PROD"
  ]);
  const value = selected ?? fallback;

  return value ?? "player-photos";
}

export function getLeagueLogosBucket() {
  const targetEnv = getSupabaseTargetEnv();
  const selected =
    targetEnv === "development"
      ? firstDefined([
          "SUPABASE_LEAGUE_LOGOS_BUCKET_DEV",
          "NEXT_PUBLIC_SUPABASE_LEAGUE_LOGOS_BUCKET_DEV",
          "SUPABASE_LEAGUE_LOGOS_BUCKET",
          "NEXT_PUBLIC_SUPABASE_LEAGUE_LOGOS_BUCKET"
        ])
      : firstDefined([
          "SUPABASE_LEAGUE_LOGOS_BUCKET",
          "NEXT_PUBLIC_SUPABASE_LEAGUE_LOGOS_BUCKET",
          "SUPABASE_LEAGUE_LOGOS_BUCKET_PROD",
          "NEXT_PUBLIC_SUPABASE_LEAGUE_LOGOS_BUCKET_PROD"
        ]);
  const fallback = firstDefined([
    "SUPABASE_LEAGUE_LOGOS_BUCKET",
    "NEXT_PUBLIC_SUPABASE_LEAGUE_LOGOS_BUCKET",
    "SUPABASE_LEAGUE_LOGOS_BUCKET_DEV",
    "NEXT_PUBLIC_SUPABASE_LEAGUE_LOGOS_BUCKET_DEV",
    "SUPABASE_LEAGUE_LOGOS_BUCKET_PROD",
    "NEXT_PUBLIC_SUPABASE_LEAGUE_LOGOS_BUCKET_PROD"
  ]);
  const value = selected ?? fallback;

  return value ?? "league-logos";
}

export function getMercadoPagoAccessToken() {
  const targetEnv = getSupabaseTargetEnv();
  const selected =
    targetEnv === "development"
      ? firstServerDefined(["MERCADOPAGO_ACCESS_TOKEN_DEV", "MERCADOPAGO_ACCESS_TOKEN"])
      : firstServerDefined(["MERCADOPAGO_ACCESS_TOKEN", "MERCADOPAGO_ACCESS_TOKEN_PROD"]);
  const fallback = firstServerDefined([
    "MERCADOPAGO_ACCESS_TOKEN",
    "MERCADOPAGO_ACCESS_TOKEN_DEV",
    "MERCADOPAGO_ACCESS_TOKEN_PROD"
  ]);
  const token = selected ?? fallback;

  if (!token) {
    throw new Error(
      "Falta token de Mercado Pago. Configura MERCADOPAGO_ACCESS_TOKEN_DEV (local) y/o MERCADOPAGO_ACCESS_TOKEN (prod)."
    );
  }
  return token;
}

export function getMercadoPagoWebhookSecret() {
  const targetEnv = getSupabaseTargetEnv();
  const selected =
    targetEnv === "development"
      ? firstServerDefined(["MERCADOPAGO_WEBHOOK_SECRET_DEV", "MERCADOPAGO_WEBHOOK_SECRET"])
      : firstServerDefined(["MERCADOPAGO_WEBHOOK_SECRET", "MERCADOPAGO_WEBHOOK_SECRET_PROD"]);
  const fallback = firstServerDefined([
    "MERCADOPAGO_WEBHOOK_SECRET",
    "MERCADOPAGO_WEBHOOK_SECRET_DEV",
    "MERCADOPAGO_WEBHOOK_SECRET_PROD"
  ]);
  return selected ?? fallback;
}

export function getMercadoPagoWebhookBaseUrl() {
  const targetEnv = getSupabaseTargetEnv();
  const selected =
    targetEnv === "development"
      ? firstServerDefined([
          "MERCADOPAGO_WEBHOOK_BASE_URL_DEV",
          "MERCADOPAGO_WEBHOOK_BASE_URL",
          "APP_URL_DEV",
          "APP_URL",
          "NEXT_PUBLIC_APP_URL_DEV",
          "NEXT_PUBLIC_APP_URL"
        ])
      : firstServerDefined([
          "MERCADOPAGO_WEBHOOK_BASE_URL",
          "MERCADOPAGO_WEBHOOK_BASE_URL_PROD",
          "APP_URL",
          "APP_URL_PROD",
          "NEXT_PUBLIC_APP_URL",
          "NEXT_PUBLIC_APP_URL_PROD"
        ]);
  const fallback = firstServerDefined([
    "MERCADOPAGO_WEBHOOK_BASE_URL",
    "MERCADOPAGO_WEBHOOK_BASE_URL_DEV",
    "MERCADOPAGO_WEBHOOK_BASE_URL_PROD",
    "APP_URL",
    "APP_URL_DEV",
    "APP_URL_PROD",
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_APP_URL_DEV",
    "NEXT_PUBLIC_APP_URL_PROD"
  ]);

  return selected ?? fallback;
}

export function getResendApiKey() {
  const targetEnv = getSupabaseTargetEnv();
  const selected =
    targetEnv === "development"
      ? firstServerDefined(["RESEND_API_KEY_DEV", "RESEND_API_KEY"])
      : firstServerDefined(["RESEND_API_KEY", "RESEND_API_KEY_PROD"]);
  const fallback = firstServerDefined(["RESEND_API_KEY", "RESEND_API_KEY_DEV", "RESEND_API_KEY_PROD"]);
  return selected ?? fallback;
}

export function getFeedbackInboxEmail() {
  const targetEnv = getSupabaseTargetEnv();
  const selected =
    targetEnv === "development"
      ? firstServerDefined(["FEEDBACK_TO_EMAIL_DEV", "FEEDBACK_TO_EMAIL"])
      : firstServerDefined(["FEEDBACK_TO_EMAIL", "FEEDBACK_TO_EMAIL_PROD"]);
  const fallback = firstServerDefined([
    "FEEDBACK_TO_EMAIL",
    "FEEDBACK_TO_EMAIL_DEV",
    "FEEDBACK_TO_EMAIL_PROD"
  ]);
  return selected ?? fallback ?? "info@fabricadefutbol.com.ar";
}

export function getFeedbackFromEmail() {
  const targetEnv = getSupabaseTargetEnv();
  const selected =
    targetEnv === "development"
      ? firstServerDefined(["FEEDBACK_FROM_EMAIL_DEV", "FEEDBACK_FROM_EMAIL"])
      : firstServerDefined(["FEEDBACK_FROM_EMAIL", "FEEDBACK_FROM_EMAIL_PROD"]);
  const fallback = firstServerDefined([
    "FEEDBACK_FROM_EMAIL",
    "FEEDBACK_FROM_EMAIL_DEV",
    "FEEDBACK_FROM_EMAIL_PROD"
  ]);
  return selected ?? fallback ?? "Fabrica de Futbol <no-reply@fabricadefutbol.com.ar>";
}

export function shouldUseMercadoPagoSandboxCheckout() {
  const targetEnv = getSupabaseTargetEnv();
  const selected =
    targetEnv === "development"
      ? firstServerDefined(["MERCADOPAGO_USE_SANDBOX_DEV", "MERCADOPAGO_USE_SANDBOX"])
      : firstServerDefined(["MERCADOPAGO_USE_SANDBOX", "MERCADOPAGO_USE_SANDBOX_PROD"]);
  const fallback = firstServerDefined([
    "MERCADOPAGO_USE_SANDBOX",
    "MERCADOPAGO_USE_SANDBOX_DEV",
    "MERCADOPAGO_USE_SANDBOX_PROD"
  ]);

  return parseBooleanEnv(selected ?? fallback, targetEnv === "development");
}
