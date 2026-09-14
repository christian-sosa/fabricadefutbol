import fs from "node:fs";
import path from "node:path";

export function readEnvFile(filepath = ".env.test") {
  if (!fs.existsSync(filepath)) return {};
  const values = {};
  for (const line of fs.readFileSync(filepath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) throw new Error("Linea invalida en el archivo E2E.");
    const key = trimmed.slice(0, separator).trim();
    const raw = trimmed.slice(separator + 1).trim();
    values[key] = raw.replace(/^(['"])(.*)\1$/, "$2");
  }
  return values;
}

export function readE2eEnvironment(processValues = process.env, filepath = ".env.test") {
  const values = {...readEnvFile(path.resolve(filepath))};
  for (const [key, value] of Object.entries(processValues)) if (value?.trim()) values[key] = value.trim();
  return values;
}

export function validateE2eEnvironment(env) {
  const errors = [];
  const required = ["NEXT_PUBLIC_SUPABASE_TARGET_ENV", "NEXT_PUBLIC_SUPABASE_URL_DEV",
    "SUPABASE_SERVICE_ROLE_KEY_DEV", "NEXT_PUBLIC_SUPABASE_DB_SCHEMA_DEV", "E2E_BASE_URL",
    "APP_URL_DEV", "NEXT_PUBLIC_APP_URL_DEV", "E2E_ADMIN_EMAIL", "E2E_ADMIN_PASSWORD", "E2E_ORG_SLUG"];
  const publicKey = ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY_DEV", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY_DEV", "NEXT_PUBLIC_SUPABASE_ANON_KEY_DEV"].find((key) => env[key]);
  if (!publicKey) errors.push("Falta una clave publica de Supabase DEV.");
  for (const key of [...required, ...(publicKey ? [publicKey] : [])]) {
    const value = env[key]?.trim();
    if (!value) errors.push(`Falta ${key}.`);
    else if (/\$\{|your-|replace-with|_xxx|^xxx$/i.test(value)) errors.push(`Reemplaza el placeholder de ${key}.`);
  }
  if (env.NEXT_PUBLIC_SUPABASE_TARGET_ENV !== "development") errors.push("NEXT_PUBLIC_SUPABASE_TARGET_ENV debe ser development.");
  if (env.SUPABASE_TARGET_ENV && env.SUPABASE_TARGET_ENV !== "development") errors.push("SUPABASE_TARGET_ENV contradice el destino de testing.");
  if (env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA_DEV !== "app_dev") errors.push("El schema E2E debe ser app_dev.");
  try {
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL_DEV);
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname.endsWith(".supabase.co")) throw new Error();
  } catch { errors.push("La URL de Supabase DEV debe identificar un proyecto HTTPS de Supabase."); }
  try {
    const url = new URL(env.E2E_BASE_URL);
    if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.protocol !== "http:" || !url.port || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error();
    for (const key of ["APP_URL_DEV", "NEXT_PUBLIC_APP_URL_DEV"]) if (new URL(env[key]).origin !== url.origin) errors.push(`${key} debe coincidir con E2E_BASE_URL.`);
  } catch { errors.push("E2E_BASE_URL debe ser un origen HTTP local con puerto explicito."); }
  if (!/^[a-z0-9._+-]+@example\.test$/i.test(env.E2E_ADMIN_EMAIL ?? "")) errors.push("El admin E2E debe usar el dominio reservado example.test.");
  if (env.E2E_ADMIN_USER_ID && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(env.E2E_ADMIN_USER_ID)) errors.push("E2E_ADMIN_USER_ID debe ser un UUID.");
  if (!env.E2E_ADMIN_USER_ID && env.E2E_CREATE_FIXTURE_USER !== "1") errors.push("Indica E2E_ADMIN_USER_ID o habilita la creacion de un fixture nuevo con E2E_CREATE_FIXTURE_USER=1.");
  if ((env.E2E_ADMIN_PASSWORD ?? "").length < 12) errors.push("La contraseña E2E debe tener al menos 12 caracteres.");
  if (!/^e2e-[a-z0-9-]+$/.test(env.E2E_ORG_SLUG ?? "")) errors.push("El slug de testing debe empezar con e2e-.");
  for (const key of ["E2E_ORG_NAME", "SUPER_ADMIN_EMAIL"]) if (/\$\{/.test(env[key] ?? "")) errors.push(`No se admite una variable sin resolver en ${key}.`);
  if (errors.length) throw new Error(`Entorno E2E invalido. No se inicio ninguna operacion.\n${[...new Set(errors)].join("\n")}`);
  return env;
}
