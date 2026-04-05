import { createClient } from "@supabase/supabase-js";

import { getSupabaseDbSchema, getSupabaseServiceRoleKey, getSupabaseUrl } from "@/lib/env";

export function createSupabaseAdminClient() {
  const serviceRoleKey = getSupabaseServiceRoleKey();
  if (!serviceRoleKey) return null;

  return createClient(getSupabaseUrl(), serviceRoleKey, {
    db: {
      schema: getSupabaseDbSchema()
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
