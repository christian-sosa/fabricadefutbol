import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getSessionIsSuperAdmin(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
) {
  const { data, error } = await supabase.rpc("is_super_admin");
  if (error) throw new Error("No se pudieron verificar los permisos de administración.");
  return data === true;
}

export async function getCurrentUserIsSuperAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return false;
  return getSessionIsSuperAdmin(supabase);
}
