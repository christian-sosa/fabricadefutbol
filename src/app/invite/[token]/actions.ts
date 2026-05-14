"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import {
  ACTION_RATE_LIMITS,
  checkActionRateLimit,
  formatActionRateLimitMessage
} from "@/lib/action-rate-limit";
import { deriveDisplayName } from "@/lib/auth/profile";
import { buildAdminLoginPath } from "@/lib/auth/redirects";
import { getOrganizationQueryKeyById } from "@/lib/auth/admin";
import { recordOrganizationAuditEvent } from "@/lib/domain/organization-audit";
import { acceptOrganizationInvite } from "@/lib/domain/organization-workflow";
import { normalizeEmail, withOrgQuery } from "@/lib/org";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const acceptInviteSchema = z.object({
  token: z.string().uuid("Invitacion invalida.")
});

function buildInvitePath(token: string, error?: string) {
  const basePath = `/invite/${token}`;
  if (!error) return basePath;
  return `${basePath}?error=${encodeURIComponent(error)}`;
}

export async function acceptInviteAction(formData: FormData) {
  const parsed = acceptInviteSchema.safeParse({
    token: formData.get("token")
  });

  if (!parsed.success) {
    redirect("/admin/login?error=Invitacion%20invalida");
  }

  const token = parsed.data.token;
  const rateLimit = await checkActionRateLimit({
    scope: "organization-admin-invite:accept",
    organizationId: token,
    ...ACTION_RATE_LIMITS.acceptInvite
  });

  if (!rateLimit.allowed) {
    redirect(buildInvitePath(token, formatActionRateLimitMessage(rateLimit)));
  }

  const loginHref = buildAdminLoginPath(`/invite/${token}`);
  const supabase = await createSupabaseServerClient();
  const privilegedSupabase = createSupabaseAdminClient() ?? supabase;

  const { data: invite, error: inviteError } = await privilegedSupabase
    .from("organization_invites")
    .select("id, organization_id, email, status, expires_at")
    .eq("invite_token", token)
    .eq("status", "pending")
    .maybeSingle();

  if (inviteError) {
    redirect(buildInvitePath(token, inviteError.message));
  }

  if (!invite) {
    redirect(buildInvitePath(token, "Este link no existe, ya fue usado o fue cancelado."));
  }

  if (invite.expires_at) {
    const expiresAtMs = Date.parse(invite.expires_at);
    if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
      redirect(buildInvitePath(token, "Este link ya expiro. Pedi una nueva invitacion a tu admin."));
    }
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.id || !user.email) {
    redirect(loginHref);
  }

  const userEmail = normalizeEmail(user.email);
  const invitedEmail = normalizeEmail(invite.email);
  if (userEmail !== invitedEmail) {
    redirect(buildInvitePath(token, `Esta invitacion corresponde a ${invite.email}, pero estas logueado con ${user.email}.`));
  }

  const { error: ensureAdminError } = await privilegedSupabase.from("admins").upsert(
    {
      id: user.id,
      display_name: deriveDisplayName(user.email, (user.user_metadata ?? undefined) as Record<string, unknown> | undefined)
    },
    { onConflict: "id" }
  );

  if (ensureAdminError) {
    redirect(buildInvitePath(token, ensureAdminError.message));
  }

  await acceptOrganizationInvite({
    supabase: privilegedSupabase,
    inviteId: invite.id,
    organizationId: invite.organization_id,
    invitedEmail,
    userId: user.id
  });

  await recordOrganizationAuditEvent({
    organizationId: invite.organization_id,
    eventType: "organization.admin_invite.accepted",
    actorAdminId: user.id,
    actorEmail: user.email,
    targetAdminId: user.id,
    targetEmail: user.email,
    entityType: "organization_invite",
    entityId: invite.id
  });

  const organizationQueryKey = await getOrganizationQueryKeyById(invite.organization_id);
  redirect(withOrgQuery("/admin", organizationQueryKey));
}
