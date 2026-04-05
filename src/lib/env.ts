export function getSupabaseUrl() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!value) {
    throw new Error(
      "Falta la URL de Supabase. Defini NEXT_PUBLIC_SUPABASE_URL (recomendado) o SUPABASE_URL."
    );
  }
  return value;
}

export function getSupabaseAnonKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    (() => {
      throw new Error(
        "Falta clave publica de Supabase. Defini NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY o NEXT_PUBLIC_SUPABASE_ANON_KEY."
      );
    })()
  );
}

export function getSupabaseServiceRoleKey() {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!value) return null;

  const normalized = value.toLowerCase();
  const isPlaceholder =
    normalized === "your-service-role-key-optional" ||
    normalized === "your-service-role-key" ||
    normalized.includes("your-service-role-key") ||
    normalized.includes("replace-with-service-role-key");

  if (isPlaceholder) return null;
  return value;
}
