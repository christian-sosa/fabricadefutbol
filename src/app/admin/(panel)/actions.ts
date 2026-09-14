"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  ACTION_RATE_LIMITS,
  checkActionRateLimit,
  formatActionRateLimitMessage
} from "@/lib/action-rate-limit";
import { recordAnalyticsEvent } from "@/lib/analytics/server";
import {
  assertAdminAction,
  assertOrganizationAdminAction,
  getOrganizationQueryKeyById
} from "@/lib/auth/admin";
import { recordOrganizationAuditEvent } from "@/lib/domain/organization-audit";
import {
  deleteOrganizationDeep,
  setOrganizationArchived,
  revokeOrganizationInvite
} from "@/lib/domain/organization-workflow";
import {
  getOrganizationImagesBucket,
  getSupabaseDbSchema
} from "@/lib/env";
import { isNextRedirectError } from "@/lib/next-redirect";
import { logError, logInfo } from "@/lib/observability/log";
import { normalizeEmail, slugifyOrganizationName, withOrgQuery } from "@/lib/org";
import {
  getOrganizationImageObjectPath,
  isSupportedOrganizationImageFile,
  MAX_ORGANIZATION_IMAGE_SIZE_MB,
  optimizeOrganizationImage
} from "@/lib/organization-images";
import { toUserMessage } from "@/lib/errors";
import { GROWTH_EVENTS } from "@/lib/growth";
import { REPLACEABLE_IMAGE_UPLOAD_CACHE_CONTROL } from "@/lib/storage-image-responses";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createOrganizationSchema = z.object({
  organizationId: z.string().uuid("El formulario venció. Recargá la página e intentá nuevamente."),
  name: z
    .string()
    .min(3, "El nombre del grupo debe tener al menos 3 caracteres.")
    .max(80, "El nombre del grupo es demasiado largo.")
});

const inviteSchema = z.object({
  organizationId: z.string().uuid(),
  email: z.string().email("Ingresa un email valido.")
});

const revokeInviteSchema = z.object({
  organizationId: z.string().uuid(),
  inviteId: z.string().uuid()
});

const removeAdminSchema = z.object({
  organizationId: z.string().uuid(),
  adminId: z.string().uuid()
});

const deleteOrganizationSchema = z.object({
  organizationId: z.string().uuid()
});

const uploadOrganizationImageSchema = z.object({
  organizationId: z.string().uuid()
});

const startOrganizationSeasonSchema = z.object({
  organizationId: z.string().uuid()
});

function buildAdminPath(organizationKey?: string, error?: string) {
  const basePath = withOrgQuery("/admin", organizationKey ?? null);
  if (!error) return basePath;
  const separator = basePath.includes("?") ? "&" : "?";
  return `${basePath}${separator}error=${encodeURIComponent(error)}`;
}

function buildAdminAdminsPath(organizationKey?: string, error?: string) {
  const basePath = withOrgQuery("/admin/admins", organizationKey ?? null);
  if (!error) return basePath;
  const separator = basePath.includes("?") ? "&" : "?";
  return `${basePath}${separator}error=${encodeURIComponent(error)}`;
}

async function organizationAlreadyHasAdminWithEmail(params: {
  organizationId: string;
  normalizedEmail: string;
}) {
  const supabaseAdmin = createSupabaseAdminClient();
  if (!supabaseAdmin) return false;

  const { data: memberships, error: membershipsError } = await supabaseAdmin
    .from("organization_admins")
    .select("admin_id")
    .eq("organization_id", params.organizationId);

  if (membershipsError) {
    throw new Error(membershipsError.message);
  }

  const adminIds = Array.from(new Set((memberships ?? []).map((row) => row.admin_id)));
  if (!adminIds.length) return false;

  const { data: authUsers, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });

  if (authUsersError) {
    throw new Error(authUsersError.message);
  }

  const currentAdminEmails = new Map(
    (authUsers?.users ?? [])
      .filter((user) => adminIds.includes(user.id))
      .map((user) => [user.id, normalizeEmail(user.email ?? "")])
  );

  return adminIds.some((adminId) => currentAdminEmails.get(adminId) === params.normalizedEmail);
}

async function resolveAdminEmailById(adminId: string) {
  const supabaseAdmin = createSupabaseAdminClient();
  if (!supabaseAdmin) return null;

  const { data, error } = await supabaseAdmin.auth.admin.getUserById(adminId);
  if (error) return null;
  return data?.user?.email?.toLowerCase() ?? null;
}

export async function createOrganizationAction(formData: FormData) {
  const startedAt = Date.now();
  try {
    const admin = await assertAdminAction();
    const createRateLimit = await checkActionRateLimit({
      scope: "organizations:create",
      actorId: admin.userId,
      ...ACTION_RATE_LIMITS.createOrganization
    });

    if (!createRateLimit.allowed) {
      redirect(buildAdminPath(undefined, formatActionRateLimitMessage(createRateLimit)));
    }

    const parsed = createOrganizationSchema.safeParse({
      organizationId: formData.get("organizationId"),
      name: formData.get("name")
    });

    if (!parsed.success) {
      redirect(buildAdminPath(undefined, parsed.error.issues[0]?.message ?? "Datos invalidos."));
    }

    const supabase = await createSupabaseServerClient();

    const baseSlug = slugifyOrganizationName(parsed.data.name) || `grupo-${parsed.data.organizationId}`;
    const { data: createdGroup, error: organizationError } = await supabase.rpc("create_group_organization", {
      p_organization_id: parsed.data.organizationId,
      p_name: parsed.data.name.trim(),
      p_slug: baseSlug
    });
    if (organizationError || !createdGroup) {
      redirect(buildAdminPath(undefined, toUserMessage(organizationError, "No se pudo crear el grupo.")));
    }
    const result = createdGroup as { organizationId: string; slug: string; created: boolean };
    const organization = { id: result.organizationId };
    const slug = result.slug;
    await recordAnalyticsEvent({
      eventName: GROWTH_EVENTS.groupCreated,
      source: "server_action",
      adminId: admin.userId,
      organizationId: organization.id,
      entityType: "organization",
      entityId: organization.id,
      path: withOrgQuery("/admin", slug),
      properties: {
        slug
      }
    });

    revalidatePath("/admin");
    revalidatePath("/");
    revalidatePath("/ranking");
    revalidatePath("/players");
    revalidatePath("/matches");
    revalidatePath("/upcoming");
    logInfo("organizations.create.succeeded", {
      organizationId: organization.id,
      adminId: admin.userId,
      durationMs: Date.now() - startedAt
    });
    redirect(withOrgQuery("/admin", slug));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    logError("organizations.create.failed", error, {
      durationMs: Date.now() - startedAt
    });
    redirect(buildAdminPath(undefined, toUserMessage(error, "No se pudo crear el grupo.")));
  }
}

export async function startOrganizationSeasonAction(formData: FormData) {
  const parsed = startOrganizationSeasonSchema.safeParse({
    organizationId: formData.get("organizationId")
  });
  const organizationId = parsed.success ? parsed.data.organizationId : String(formData.get("organizationId") ?? "");
  const organizationQueryKey = organizationId ? await getOrganizationQueryKeyById(organizationId) : undefined;

  try {
    if (!parsed.success) {
      redirect(buildAdminPath(organizationQueryKey, parsed.error.issues[0]?.message ?? "Temporada invalida."));
    }

    await assertOrganizationAdminAction(parsed.data.organizationId);
    redirect(
      buildAdminPath(
        organizationQueryKey,
        "Las temporadas son anuales y cierran automaticamente el 31/12. No se pueden cambiar manualmente."
      )
    );
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildAdminPath(organizationQueryKey, toUserMessage(error, "No se pudo iniciar la temporada.")));
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
    const inviteRateLimit = await checkActionRateLimit({
      scope: "organization-admins:invite",
      actorId: admin.userId,
      organizationId: parsed.data.organizationId,
      ...ACTION_RATE_LIMITS.inviteOrganizationAdmin
    });

    if (!inviteRateLimit.allowed) {
      redirect(buildAdminAdminsPath(organizationQueryKey, formatActionRateLimitMessage(inviteRateLimit)));
    }

    if (normalizedEmail === admin.email) {
      redirect(buildAdminAdminsPath(organizationQueryKey, "Tu usuario ya administra este grupo."));
    }

    if (
      await organizationAlreadyHasAdminWithEmail({
        organizationId: parsed.data.organizationId,
        normalizedEmail
      })
    ) {
      redirect(buildAdminAdminsPath(organizationQueryKey, "Ese email ya administra este grupo."));
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
      redirect(buildAdminAdminsPath(organizationQueryKey, toUserMessage(adminCountError, "No se pudo verificar los admins actuales.")));
    }
    if (inviteCountError) {
      redirect(buildAdminAdminsPath(organizationQueryKey, toUserMessage(inviteCountError, "No se pudo verificar invitaciones pendientes.")));
    }

    const slotsUsed = (currentAdmins ?? 0) + (pendingInvites ?? 0);
    if (slotsUsed >= 4) {
      redirect(buildAdminAdminsPath(organizationQueryKey, "Este grupo ya alcanzo el maximo de 4 administradores."));
    }

    const { data: invite, error: inviteError } = await supabase
      .from("organization_invites")
      .insert({
        organization_id: parsed.data.organizationId,
        email: normalizedEmail,
        invited_by: admin.userId,
        status: "pending"
      })
      .select("id")
      .single();

    if (inviteError) {
      const alreadyInvited = inviteError.code === "23505";
      redirect(
        buildAdminAdminsPath(
          organizationQueryKey,
          alreadyInvited
            ? "Ese email ya tiene una invitacion pendiente."
            : toUserMessage(inviteError, "No se pudo generar la invitacion.")
        )
      );
    }

    await recordOrganizationAuditEvent({
      organizationId: parsed.data.organizationId,
      eventType: "organization.admin_invite.created",
      actorAdminId: admin.userId,
      actorEmail: admin.email,
      targetEmail: normalizedEmail,
      entityType: "organization_invite",
      entityId: invite?.id ?? null
    });

    revalidatePath("/admin");
    revalidatePath("/admin/admins");
    redirect(buildAdminAdminsPath(organizationQueryKey));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildAdminAdminsPath(undefined, toUserMessage(error, "No se pudo generar la invitacion.")));
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

    const admin = await assertOrganizationAdminAction(parsed.data.organizationId);
    const organizationQueryKey = await getOrganizationQueryKeyById(parsed.data.organizationId);
    const supabase = await createSupabaseServerClient();
    const { data: inviteBeforeRevoke } = await supabase
      .from("organization_invites")
      .select("email")
      .eq("id", parsed.data.inviteId)
      .eq("organization_id", parsed.data.organizationId)
      .maybeSingle();

    await revokeOrganizationInvite({
      supabase,
      inviteId: parsed.data.inviteId,
      organizationId: parsed.data.organizationId
    });

    await recordOrganizationAuditEvent({
      organizationId: parsed.data.organizationId,
      eventType: "organization.admin_invite.revoked",
      actorAdminId: admin.userId,
      actorEmail: admin.email,
      targetEmail: inviteBeforeRevoke?.email ?? null,
      entityType: "organization_invite",
      entityId: parsed.data.inviteId
    });

    revalidatePath("/admin");
    revalidatePath("/admin/admins");
    redirect(buildAdminAdminsPath(organizationQueryKey));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildAdminAdminsPath(undefined, toUserMessage(error, "No se pudo cancelar la invitacion.")));
  }
}

export async function removeOrganizationAdminAction(formData: FormData) {
  try {
    const parsed = removeAdminSchema.safeParse({
      organizationId: formData.get("organizationId"),
      adminId: formData.get("adminId")
    });

    if (!parsed.success) {
      redirect(buildAdminPath(undefined, parsed.error.issues[0]?.message ?? "Datos invalidos."));
    }

    const actingAdmin = await assertOrganizationAdminAction(parsed.data.organizationId);
    const organizationQueryKey = await getOrganizationQueryKeyById(parsed.data.organizationId);
    const supabase = await createSupabaseServerClient();

    if (actingAdmin.userId === parsed.data.adminId) {
      redirect(buildAdminAdminsPath(organizationQueryKey, "No puedes quitarte a ti mismo como admin de este grupo."));
    }

    const { count: adminsCount, error: adminsCountError } = await supabase
      .from("organization_admins")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", parsed.data.organizationId);

    if (adminsCountError) {
      redirect(buildAdminAdminsPath(organizationQueryKey, toUserMessage(adminsCountError, "No se pudo contar los admins actuales.")));
    }

    if ((adminsCount ?? 0) <= 1) {
      redirect(buildAdminAdminsPath(organizationQueryKey, "El grupo debe mantener al menos 1 admin activo."));
    }

    const targetEmail = await resolveAdminEmailById(parsed.data.adminId);
    const { error: deleteError } = await supabase
      .from("organization_admins")
      .delete()
      .eq("organization_id", parsed.data.organizationId)
      .eq("admin_id", parsed.data.adminId);

    if (deleteError) {
      redirect(buildAdminAdminsPath(organizationQueryKey, toUserMessage(deleteError, "No se pudo quitar al administrador.")));
    }

    await recordOrganizationAuditEvent({
      organizationId: parsed.data.organizationId,
      eventType: "organization.admin.removed",
      actorAdminId: actingAdmin.userId,
      actorEmail: actingAdmin.email,
      targetAdminId: parsed.data.adminId,
      targetEmail,
      entityType: "organization_admin",
      entityId: parsed.data.adminId
    });

    revalidatePath("/admin");
    revalidatePath("/admin/admins");
    redirect(buildAdminAdminsPath(organizationQueryKey));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildAdminAdminsPath(undefined, toUserMessage(error, "No se pudo quitar al administrador.")));
  }
}

async function changeOrganizationArchive(formData: FormData, archived: boolean) {
  try {
    const admin = await assertAdminAction();
    if (!admin.isSuperAdmin) throw new Error("Solo el superadmin puede archivar o restaurar grupos.");
    const parsed = deleteOrganizationSchema.parse({ organizationId: formData.get("organizationId") });
    await setOrganizationArchived({
      supabase: await createSupabaseServerClient(), organizationId: parsed.organizationId, archived
    });
    for (const path of ["/admin", "/groups", "/", "/ranking", "/players", "/matches", "/upcoming"]) revalidatePath(path);
    redirect("/admin");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildAdminPath(undefined, toUserMessage(error, "No se pudo cambiar el archivo del grupo.")));
  }
}

export async function archiveOrganizationAction(formData: FormData) {
  return changeOrganizationArchive(formData, true);
}

export async function restoreOrganizationAction(formData: FormData) {
  return changeOrganizationArchive(formData, false);
}

export async function deleteOrganizationAction(formData: FormData) {
  try {
    const admin = await assertAdminAction();
    if (!admin.isSuperAdmin) {
      redirect(buildAdminPath(undefined, "Solo el super admin puede borrar grupos."));
    }

    const parsed = deleteOrganizationSchema.safeParse({
      organizationId: formData.get("organizationId")
    });

    if (!parsed.success) {
      redirect(buildAdminPath(undefined, parsed.error.issues[0]?.message ?? "Datos invalidos."));
    }

    const supabase = await createSupabaseServerClient();

    const { data: organization, error: organizationError } = await supabase
      .from("organizations")
      .select("id")
      .eq("id", parsed.data.organizationId)
      .maybeSingle();

    if (organizationError) {
      redirect(buildAdminPath(undefined, toUserMessage(organizationError, "No se pudo leer el grupo.")));
    }

    if (!organization) {
      redirect(buildAdminPath(undefined, "El grupo ya no existe."));
    }

    await deleteOrganizationDeep({
      supabase,
      organizationId: parsed.data.organizationId
    });

    revalidatePath("/admin");
    revalidatePath("/");
    revalidatePath("/ranking");
    revalidatePath("/players");
    revalidatePath("/matches");
    revalidatePath("/upcoming");
    redirect("/admin");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildAdminPath(undefined, toUserMessage(error, "No se pudo borrar el grupo.")));
  }
}

export async function uploadOrganizationImageAction(formData: FormData) {
  const startedAt = Date.now();
  try {
    const parsed = uploadOrganizationImageSchema.safeParse({
      organizationId: formData.get("organizationId")
    });

    if (!parsed.success) {
      redirect(
        buildAdminPath(
          String(formData.get("organizationId") ?? ""),
          parsed.error.issues[0]?.message ?? "Datos invalidos."
        )
      );
    }

    const admin = await assertOrganizationAdminAction(parsed.data.organizationId);
    const organizationQueryKey = await getOrganizationQueryKeyById(parsed.data.organizationId);
    const file = formData.get("image");

    if (!(file instanceof File) || file.size <= 0) {
      redirect(buildAdminPath(organizationQueryKey, "Selecciona una imagen para subir."));
    }

    const sizeLimitBytes = MAX_ORGANIZATION_IMAGE_SIZE_MB * 1024 * 1024;
    if (file.size > sizeLimitBytes) {
      redirect(
        buildAdminPath(
          organizationQueryKey,
          `La imagen no puede superar ${MAX_ORGANIZATION_IMAGE_SIZE_MB} MB.`
        )
      );
    }

    if (!isSupportedOrganizationImageFile(file)) {
      redirect(buildAdminPath(organizationQueryKey, "Formato no soportado. Usa JPG, PNG o WEBP."));
    }

    const supabase = await createSupabaseServerClient();
    const { data: organization, error: organizationError } = await supabase
      .from("organizations")
      .select("id")
      .eq("id", parsed.data.organizationId)
      .maybeSingle();

    if (organizationError || !organization) {
      redirect(buildAdminPath(organizationQueryKey, "No se encontro el grupo seleccionado."));
    }

    const optimizedBuffer = await optimizeOrganizationImage(file);
    const objectPath = getOrganizationImageObjectPath(
      getSupabaseDbSchema(),
      parsed.data.organizationId
    );

    const { error: uploadError } = await supabase.storage
      .from(getOrganizationImagesBucket())
      .upload(objectPath, optimizedBuffer, {
        upsert: true,
        contentType: "image/webp",
        cacheControl: REPLACEABLE_IMAGE_UPLOAD_CACHE_CONTROL
      });

    if (uploadError) {
      redirect(
        buildAdminPath(
          organizationQueryKey,
          toUserMessage(uploadError, "No se pudo guardar la imagen del grupo.")
        )
      );
    }

    const { error: updateError } = await supabase
      .from("organizations")
      .update({
        image_path: objectPath
      })
      .eq("id", parsed.data.organizationId);

    if (updateError) {
      redirect(
        buildAdminPath(
          organizationQueryKey,
          toUserMessage(updateError, "No se pudo vincular la imagen al grupo.")
        )
      );
    }

    revalidatePath("/admin");
    revalidatePath("/groups");
    revalidatePath("/");
    revalidatePath(`/api/organization-image/${parsed.data.organizationId}`);
    logInfo("organizations.image.upload.succeeded", {
      organizationId: parsed.data.organizationId,
      adminId: admin.userId,
      durationMs: Date.now() - startedAt
    });
    redirect(buildAdminPath(organizationQueryKey));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    logError("organizations.image.upload.failed", error, {
      organizationId: String(formData.get("organizationId") ?? ""),
      durationMs: Date.now() - startedAt
    });
    redirect(
      buildAdminPath(
        String(formData.get("organizationId") ?? ""),
        toUserMessage(error, "No se pudo subir la imagen del grupo.")
      )
    );
  }
}
