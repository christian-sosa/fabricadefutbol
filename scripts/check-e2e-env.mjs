import fs from "node:fs";
import path from "node:path";

const envFilePath = path.resolve(".env.test");
const fileEnv = fs.existsSync(envFilePath) ? parseEnvFile(fs.readFileSync(envFilePath, "utf8")) : {};
const env = { ...fileEnv, ...process.env };

const required = [
  ["SUPABASE_TARGET_ENV"],
  ["NEXT_PUBLIC_SUPABASE_URL_DEV"],
  [
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY_DEV",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY_DEV",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY_DEV"
  ],
  ["SUPABASE_SERVICE_ROLE_KEY_DEV"],
  ["NEXT_PUBLIC_SUPABASE_DB_SCHEMA_DEV"],
  ["E2E_BASE_URL"],
  ["APP_URL_DEV"],
  ["NEXT_PUBLIC_APP_URL_DEV"],
  ["E2E_ADMIN_EMAIL"],
  ["E2E_ADMIN_PASSWORD"],
  ["E2E_ORG_SLUG"]
];

const missing = [];
const placeholders = [];

for (const group of required) {
  const presentName = group.find((name) => hasValue(env[name]));
  if (!presentName) {
    missing.push(group.join(" o "));
    continue;
  }
  if (looksLikePlaceholder(env[presentName])) {
    placeholders.push(presentName);
  }
}

const targetEnv = String(env.SUPABASE_TARGET_ENV ?? "").trim().toLowerCase();
if (targetEnv === "production") {
  missing.push("SUPABASE_TARGET_ENV debe ser development para Playwright, no production");
} else if (targetEnv && targetEnv !== "development") {
  missing.push("SUPABASE_TARGET_ENV debe ser development para Playwright");
}

if (missing.length || placeholders.length) {
  console.error("Entorno E2E incompleto. No se ejecuto Playwright.");
  if (!fs.existsSync(envFilePath)) {
    console.error("Crea .env.test desde .env.test.example o define estas variables en el entorno.");
  }
  if (missing.length) {
    console.error(`Faltan: ${missing.join(", ")}`);
  }
  if (placeholders.length) {
    console.error(`Reemplaza placeholders en: ${placeholders.join(", ")}`);
  }
  process.exit(1);
}

console.log("Entorno E2E verificado.");

function parseEnvFile(content) {
  const values = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key) values[key] = value;
  }
  return values;
}

function hasValue(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function looksLikePlaceholder(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return (
    normalized.includes("your-test-") ||
    normalized.includes("your-") ||
    normalized.includes("_xxx") ||
    normalized.endsWith("_xxx") ||
    normalized === "xxx"
  );
}
