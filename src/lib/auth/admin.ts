import { redirect } from "next/navigation";

import { SUPER_ADMIN_EMAIL } from "@/lib/constants";
import { normalizeEmail } from "@/lib/org";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminSession = {
  userId: string;
  email: string;
  displayName: string;
  isSuperAdmin: boolean;
};

export type AdminOrganization = {
  id: string;
  name: string;
  slug: string;
  is_public: boolean;
  created_at: string;
};

function findOrganizationByKey(organizations: AdminOrganization[], organizationKey?: string | null) {
  if (!organizationKey) return null;
  const normalizedKey = organizationKey.trim().toLowerCase();
  if (!normalizedKey) return null;

  return (
    organizations.find(
      (organization) => organization.slug.toLowerCase() === normalizedKey || organization.id === organizationKey
    ) ?? null
  );
}

function deriveDisplayName(email: string, metadata?: Record<string, unknown>) {
  const fromMetadata =
    typeof metadata?.display_name === "string"
      ? metadata.display_name
      : typeof metadata?.name === "string"
        ? metadata.name
        : null;

  if (fromMetadata && fromMetadata.trim().length) {
    return fromMetadata.trim().slice(0, 80);
  }

  const localPart = email.split("@")[0] ?? "admin";
  return localPart.replace(/[._-]+/g, " ").trim().slice(0, 80) || "admin";
}

async function ensureAdminProfile(params: {
  userId: string;
  email: string;
  metadata?: Record<string, unknown>;
}) {
  const { userId, email, metadata } = params;
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("admins")
    .select("id, display_name")
    .eq("id", userId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    return existing;
  }

  const fallbackName = deriveDisplayName(email, metadata);
  const { error: insertError } = await supabase.from("admins").insert({
    id: userId,
    display_name: fallbackName
  });

  if (insertError && insertError.code !== "23505") {
    throw new Error(insertError.message);
  }

  const { data: inserted, error: insertedError } = await supabase
    .from("admins")
    .select("id, display_name")
    .eq("id", userId)
    .maybeSingle();

  if (insertedError || !inserted) {
    throw new Error(insertedError?.message ?? "No se pudo crear perfil de administrador.");
  }

  return inserted;
}

async function autoAcceptOrganizationInvites(adminId: string, email: string) {
  const normalizedEmail = normalizeEmail(email);
  const supabase = await createSupabaseServerClient();

  const { data: pendingInvites, error: pendingInvitesError } = await supabase
    .from("organization_invites")
    .select("id, organization_id")
    .eq("status", "pending")
    .eq("email", normalizedEmail);

  if (pendingInvitesError || !pendingInvites?.length) {
    return;
  }

  for (const invite of pendingInvites) {
    const { error: addMembershipError } = await supabase
      .from("organization_admins")
      .insert({
        organization_id: invite.organization_id,
        admin_id: adminId,
        created_by: adminId
      });

    if (addMembershipError && addMembershipError.code !== "23505") {
      throw new Error(addMembershipError.message);
    }
  }

  const inviteIds = pendingInvites.map((invite) => invite.id);
  const { error: deleteInviteError } = await supabase
    .from("organization_invites")
    .delete()
    .in("id", inviteIds)
    .eq("email", normalizedEmail)
    .eq("status", "pending");

  if (deleteInviteError) {
    throw new Error(deleteInviteError.message);
  }
}

function isSuperAdminEmail(email: string) {
  return normalizeEmail(email) === SUPER_ADMIN_EMAIL;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.id || !user.email) {
    return null;
  }

  const email = normalizeEmail(user.email);
  const profile = await ensureAdminProfile({
    userId: user.id,
    email,
    metadata: (user.user_metadata ?? undefined) as Record<string, unknown> | undefined
  });

  await autoAcceptOrganizationInvites(user.id, email);

  return {
    userId: user.id,
    email,
    displayName: profile.display_name,
    isSuperAdmin: isSuperAdminEmail(email)
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
    throw new Error("No autorizado: debes iniciar sesion.");
  }
  return adminSession;
}

export async function getAdminOrganizations(admin: AdminSession): Promise<AdminOrganization[]> {
  const supabase = await createSupabaseServerClient();

  if (admin.isSuperAdmin) {
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name, slug, is_public, created_at")
      .order("name", { ascending: true });

    if (error) throw new Error(error.message);
    return data ?? [];
  }

  const { data, error } = await supabase
    .from("organization_admins")
    .select("organizations(id, name, slug, is_public, created_at)")
    .eq("admin_id", admin.userId);

  if (error) throw new Error(error.message);

  const organizations = (data ?? [])
    .map((row) => {
      const relation = row.organizations;
      if (Array.isArray(relation)) return relation[0] ?? null;
      return relation ?? null;
    })
    .filter(
      (value): value is AdminOrganization =>
        Boolean(value && typeof value.id === "string" && typeof value.name === "string")
    );

  return organizations.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export async function getOrganizationQueryKeyById(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("slug")
    .eq("id", organizationId)
    .maybeSingle();

  if (error || !data?.slug) return organizationId;
  return data.slug;
}

export async function getAdminOrganizationContext(preferredOrganizationKey?: string | null) {
  const admin = await requireAdminSession();
  const organizations = await getAdminOrganizations(admin);

  const selectedOrganization = findOrganizationByKey(organizations, preferredOrganizationKey) ?? organizations[0] ?? null;

  return {
    admin,
    organizations,
    selectedOrganization
  };
}

export async function requireAdminOrganization(preferredOrganizationId?: string | null) {
  const context = await getAdminOrganizationContext(preferredOrganizationId);

  if (!context.selectedOrganization) {
    redirect("/admin");
  }

  return {
    ...context,
    selectedOrganization: context.selectedOrganization
  };
}

export async function assertOrganizationAdminAction(organizationId: string) {
  const admin = await assertAdminAction();

  if (admin.isSuperAdmin) {
    return admin;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organization_admins")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("admin_id", admin.userId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("No autorizado para administrar esta organizacion.");
  }

  return admin;
}
