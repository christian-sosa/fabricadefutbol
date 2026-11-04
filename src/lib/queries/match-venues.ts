import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getActiveMatchVenues(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organization_venues")
    .select("id, name")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}
