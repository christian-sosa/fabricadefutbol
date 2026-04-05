"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseAnonKey, getSupabaseDbSchema, getSupabaseUrl } from "@/lib/env";

export function createSupabaseBrowserClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    db: {
      schema: getSupabaseDbSchema()
    }
  });
}
