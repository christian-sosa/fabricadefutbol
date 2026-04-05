"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  assertAdminAction,
  assertOrganizationAdminAction,
  getOrganizationQueryKeyById
} from "@/lib/auth/admin";
import { isNextRedirectError } from "@/lib/next-redirect";
import { normalizeEmail, slugifyOrganizationName, withOrgQuery } from "@/lib/org";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createOrganizationSchema = z.object({
  name: z
    .string()
    .min(3, "El nombre de la organizacion debe tener al menos 3 caracteres.")
    .max(80, "El nombre de la organizacion es demasiado largo.")
});

const inviteSchema = z.object({
  organizationId: z.string().uuid(),
  email: z.string().email("Ingresa un email valido.")
});

const revokeInviteSchema = z.object({
  organizationId: z.string().uuid(),
  inviteId: z.string().uuid()
});

function buildAdminPath(organizationKey?: string, error?: string) {
  const basePath = withOrgQuery("/admin", organizationKey ?? null);
  if (!error) return basePath;
  const separator = basePath.includes("?") ? "&" : "?";
  return `${basePath}${separator}error=${encodeURIComponent(error)}`;
}

function parseNextSlug(baseSlug: string, existingSlugs: string[]) {
  if (!existingSlugs.includes(baseSlug)) return baseSlug;

  let suffix = 2;
  while (existingSlugs.includes(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }
  return `${baseSlug}-${suffix}`;
}

export async function createOrganizationAction(formData: FormData) {
  try {
    const admin = await assertAdminAction();
    const parsed = createOrganizationSchema.safeParse({
      name: formData.get("name")
    });

    if (!parsed.success) {
      redirect(buildAdminPath(undefined, parsed.error.issues[0]?.message ?? "Datos invalidos."));
    }

    const supabase = await createSupabaseServerClient();

    const baseSlug = slugifyOrganizationName(parsed.data.name) || `organizacion-${Date.now()}`;
    const { data: existingSlugsRows, error: existingSlugsError } = await supabase
      .from("organizations")
      .select("slug")
      .ilike("slug", `${baseSlug}%`);

    if (existingSlugsError) {
      redirect(buildAdminPath(undefined, existingSlugsError.message));
    }

    const existingSlugs = (existingSlugsRows ?? []).map((row) => row.slug.toLowerCase());
    const slug = parseNextSlug(baseSlug, existingSlugs);

    const { data: organization, error: organizationError } = await supabase
      .from("organizations")
      .insert({
        name: parsed.data.name.trim(),
        slug,
        created_by: admin.userId,
        is_public: true
      })
      .select("id")
      .single();

    if (organizationError || !organization) {
      redirect(buildAdminPath(undefined, organizationError?.message ?? "No se pudo crear la organizacion."));
    }

    const { error: membershipError } = await supabase.from("organization_admins").insert({
      organization_id: organization.id,
      admin_id: admin.userId,
      created_by: admin.userId
    });

    if (membershipError && membershipError.code !== "23505") {
      redirect(buildAdminPath(undefined, membershipError.message));
    }

    revalidatePath("/admin");
    revalidatePath("/");
    revalidatePath("/ranking");
    revalidatePath("/players");
    revalidatePath("/matches");
    revalidatePath("/upcoming");
    redirect(withOrgQuery("/admin", slug));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : "No se pudo crear la organizacion.";
    redirect(buildAdminPath(undefined, message));
  }
}

export async function inviteOrganizationAdminAction(formData: FormData) {
  try {
    const parsed = inviteSchema.safeParse({
      organizationId: formData.get("organizationId"),
      email: formData.get("email")
    });

    if (!parsed.success) {
      redirect(buildAdminPath(undefined, parsed.error.issues[0]?.message ?? "Datos invalidos."));
    }

    const admin = await assertOrganizationAdminAction(parsed.data.organizationId);
    const organizationQueryKey = await getOrganizationQueryKeyById(parsed.data.organizationId);
    const normalizedEmail = normalizeEmail(parsed.data.email);

    if (normalizedEmail === admin.email) {
      redirect(buildAdminPath(organizationQueryKey, "Tu usuario ya administra esta organizacion."));
    }

    const supabase = await createSupabaseServerClient();
    const [{ count: currentAdmins, error: adminCountError }, { count: pendingInvites, error: inviteCountError }] =
      await Promise.all([
        supabase
          .from("organization_admins")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", parsed.data.organizationId),
        supabase
          .from("organization_invites")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", parsed.data.organizationId)
          .eq("status", "pending")
      ]);

    if (adminCountError) {
      redirect(buildAdminPath(organizationQueryKey, adminCountError.message));
    }
    if (inviteCountError) {
      redirect(buildAdminPath(organizationQueryKey, inviteCountError.message));
    }

    const slotsUsed = (currentAdmins ?? 0) + (pendingInvites ?? 0);
    if (slotsUsed >= 4) {
      redirect(buildAdminPath(organizationQueryKey, "Esta organizacion ya alcanzo el maximo de 4 administradores."));
    }

    const { error: inviteError } = await supabase.from("organization_invites").insert({
      organization_id: parsed.data.organizationId,
      email: normalizedEmail,
      invited_by: admin.userId,
      status: "pending"
    });

    if (inviteError) {
      const alreadyInvited = inviteError.code === "23505";
      redirect(
        buildAdminPath(
          organizationQueryKey,
          alreadyInvited ? "Ese email ya tiene una invitacion pendiente." : inviteError.message
        )
      );
    }

    revalidatePath("/admin");
    redirect(withOrgQuery("/admin", organizationQueryKey));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : "No se pudo generar la invitacion.";
    redirect(buildAdminPath(undefined, message));
  }
}

export async function revokeOrganizationInviteAction(formData: FormData) {
  try {
    const parsed = revokeInviteSchema.safeParse({
      organizationId: formData.get("organizationId"),
      inviteId: formData.get("inviteId")
    });

    if (!parsed.success) {
      redirect(buildAdminPath(undefined, parsed.error.issues[0]?.message ?? "Datos invalidos."));
    }

    await assertOrganizationAdminAction(parsed.data.organizationId);
    const organizationQueryKey = await getOrganizationQueryKeyById(parsed.data.organizationId);
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("organization_invites")
      .delete()
      .eq("id", parsed.data.inviteId)
      .eq("organization_id", parsed.data.organizationId);

    if (error) {
      redirect(buildAdminPath(organizationQueryKey, error.message));
    }

    revalidatePath("/admin");
    redirect(withOrgQuery("/admin", organizationQueryKey));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : "No se pudo cancelar la invitacion.";
    redirect(buildAdminPath(undefined, message));
  }
}
