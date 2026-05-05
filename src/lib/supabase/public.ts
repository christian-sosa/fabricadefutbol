import { createClient } from "@supabase/supabase-js";

import { getSupabaseAnonKey, getSupabaseDbSchema, getSupabaseUrl } from "@/lib/env";

let publicClient: ReturnType<typeof createClient> | null = null;

export function createSupabasePublicClient() {
  if (!publicClient) {
    const options = {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false
      },
      db: {
        schema: getSupabaseDbSchema()
      }
    } as unknown as Parameters<typeof createClient>[2];

    publicClient = createClient(getSupabaseUrl(), getSupabaseAnonKey(), options);
  }

  return publicClient;
}
