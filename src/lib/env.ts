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
    process.env.NEXT_PUBLIC_SUPABASE_PLAYER_PHOTOS_BUCKET_PROD
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
