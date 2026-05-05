import { SUPER_ADMIN_EMAIL } from "@/lib/constants";
import { normalizeEmail } from "@/lib/org";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export function isSuperAdminEmail(email: string | null | undefined) {
  if (!email || !SUPER_ADMIN_EMAIL) return false;
  return normalizeEmail(email) === SUPER_ADMIN_EMAIL;
}

export async function getCurrentUserIsSuperAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return isSuperAdminEmail(user?.email);
}
