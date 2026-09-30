import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseAnonKey, getSupabaseDbSchema, getSupabaseUrl } from "@/lib/env";
import type { Database } from "@/types/database";

let publicClient: SupabaseClient<Database> | null = null;

export function createSupabasePublicClient() {
  if (!publicClient) {
    publicClient = createClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false
      },
      db: {
        // Both isolated schemas share the generated public-shaped TypeScript contract.
        schema: getSupabaseDbSchema() as "public"
      }
    });
  }

  return publicClient;
}
