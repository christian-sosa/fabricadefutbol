import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type DbClient =
  | Awaited<ReturnType<typeof createSupabaseServerClient>>
  | NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

const MAX_ORGANIZATION_ADMINS = 4;

export async function acceptOrganizationInvite(params: {
  supabase: DbClient;
  inviteId: string;
  organizationId: string;
  invitedEmail: string;
  userId: string;
}) {
  const { supabase, inviteId, organizationId, invitedEmail, userId } = params;

  const { count: currentAdmins, error: adminCountError } = await supabase
    .from("organization_admins")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  if (adminCountError) {
    throw new Error(adminCountError.message);
  }

  if ((currentAdmins ?? 0) >= MAX_ORGANIZATION_ADMINS) {
    throw new Error("Este grupo ya alcanzo el maximo de 4 administradores.");
  }

  const { data: acceptedInvite, error: acceptInviteError } = await supabase
    .from("organization_invites")
    .update({
      status: "accepted",
      accepted_by: userId,
      accepted_at: new Date().toISOString()
    })
    .eq("id", inviteId)
    .eq("organization_id", organizationId)
    .eq("status", "pending")
    .eq("email", invitedEmail)
    .select("id")
    .maybeSingle();

  if (acceptInviteError) {
    throw new Error(acceptInviteError.message);
  }

  if (!acceptedInvite) {
    throw new Error("La invitacion ya fue usada o cancelada.");
  }

  const { error: insertMembershipError } = await supabase.from("organization_admins").insert({
    organization_id: organizationId,
    admin_id: userId,
    created_by: userId
  });

  if (insertMembershipError && insertMembershipError.code !== "23505") {
    throw new Error(insertMembershipError.message);
  }

  return {
    acceptedInviteId: inviteId
  };
}

export async function revokeOrganizationInvite(params: {
  supabase: DbClient;
  inviteId: string;
  organizationId: string;
}) {
  const { supabase, inviteId, organizationId } = params;
  const { data: revokedInvite, error } = await supabase
    .from("organization_invites")
    .update({
      status: "revoked"
    })
    .eq("id", inviteId)
    .eq("organization_id", organizationId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!revokedInvite) {
    throw new Error("La invitacion ya fue usada o cancelada.");
  }

  return {
    revokedInviteId: inviteId
  };
}

export async function deleteOrganizationDeep(params: {
  supabase: DbClient;
  organizationId: string;
}) {
  const { data, error } = await params.supabase.rpc("purge_group", {
    p_organization_id: params.organizationId
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function setOrganizationArchived(params: {
  supabase: DbClient;
  organizationId: string;
  archived: boolean;
}) {
  const { data, error } = await params.supabase.rpc("set_group_archived", {
    p_organization_id: params.organizationId,
    p_archived: params.archived
  });
  if (error) throw new Error(error.message);
  return data;
}