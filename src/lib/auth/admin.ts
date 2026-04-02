import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminSession = {
  userId: string;
  displayName: string;
};

export async function getAdminSession(): Promise<AdminSession | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: adminRow } = await supabase
    .from("admins")
    .select("id, display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!adminRow) return null;

  return {
    userId: adminRow.id,
    displayName: adminRow.display_name
  };
}

export async function requireAdminSession() {
  const adminSession = await getAdminSession();
  if (!adminSession) {
    redirect("/admin/login");
  }
  return adminSession;
}

export async function assertAdminAction() {
  const adminSession = await getAdminSession();
  if (!adminSession) {
    throw new Error("No autorizado: solo administradores.");
  }
  return adminSession;
}
