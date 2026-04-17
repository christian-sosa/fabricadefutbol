import type { SupabaseClient } from "@supabase/supabase-js";

// Helpers defensivos para leer invitaciones pendientes filtrando por `expires_at`
// si la columna existe. Esto permite que el codigo siga funcionando antes y
// despues de la migracion SQL que agrega `expires_at`.

let expiresAtColumnSupported: boolean | null = null;

function isMissingColumnError(errorMessage: string | null | undefined) {
  if (!errorMessage) return false;
  const normalized = errorMessage.toLowerCase();
  return (
    normalized.includes("expires_at") &&
    (normalized.includes("does not exist") ||
      normalized.includes("column") && normalized.includes("not found"))
  );
}

type InviteBase = {
  id: string;
  email: string;
  invite_token: string;
  status: string;
  created_at: string;
  expires_at?: string | null;
};

export type PendingInviteRow = InviteBase;

export async function fetchPendingInvitesForOrganization(
  supabase: SupabaseClient,
  organizationId: string
): Promise<PendingInviteRow[]> {
  const selectWithExpires = "id, email, invite_token, status, created_at, expires_at";
  const selectLegacy = "id, email, invite_token, status, created_at";

  if (expiresAtColumnSupported !== false) {
    const { data, error } = await supabase
      .from("organization_invites")
      .select(selectWithExpires)
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (!error) {
      expiresAtColumnSupported = true;
      return filterNotExpired((data ?? []) as PendingInviteRow[]);
    }

    if (isMissingColumnError(error.message)) {
      expiresAtColumnSupported = false;
    } else {
      throw new Error(error.message);
    }
  }

  const { data: legacyData, error: legacyError } = await supabase
    .from("organization_invites")
    .select(selectLegacy)
    .eq("organization_id", organizationId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (legacyError) throw new Error(legacyError.message);
  return (legacyData ?? []) as PendingInviteRow[];
}

export async function countPendingInvitesByOrganization(
  supabase: SupabaseClient
): Promise<Array<{ organization_id: string }>> {
  const selectWithExpires = "organization_id, expires_at";
  const selectLegacy = "organization_id";

  if (expiresAtColumnSupported !== false) {
    const { data, error } = await supabase
      .from("organization_invites")
      .select(selectWithExpires)
      .eq("status", "pending");

    if (!error) {
      expiresAtColumnSupported = true;
      const now = Date.now();
      return (data ?? []).filter((row) => {
        const expiresAt = (row as { expires_at?: string | null }).expires_at;
        if (!expiresAt) return true;
        const ts = Date.parse(expiresAt);
        if (!Number.isFinite(ts)) return true;
        return ts > now;
      }) as Array<{ organization_id: string }>;
    }

    if (isMissingColumnError(error.message)) {
      expiresAtColumnSupported = false;
    } else {
      throw new Error(error.message);
    }
  }

  const { data: legacyData, error: legacyError } = await supabase
    .from("organization_invites")
    .select(selectLegacy)
    .eq("status", "pending");

  if (legacyError) throw new Error(legacyError.message);
  return (legacyData ?? []) as Array<{ organization_id: string }>;
}

function filterNotExpired(rows: PendingInviteRow[]): PendingInviteRow[] {
  const now = Date.now();
  return rows.filter((row) => {
    if (!row.expires_at) return true;
    const ts = Date.parse(row.expires_at);
    if (!Number.isFinite(ts)) return true;
    return ts > now;
  });
}
