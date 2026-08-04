"use server";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import {
  ACTION_RATE_LIMITS,
  checkActionRateLimit,
  formatActionRateLimitMessage
} from "@/lib/action-rate-limit";
import { deriveDisplayName } from "@/lib/auth/profile";
import { buildAdminLoginPath } from "@/lib/auth/redirects";
import { canAccessClubsProduct } from "@/lib/features";
import { normalizeEmail } from "@/lib/org";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type InviteRow = {
  id: string;
  club_id: string;
  email: string;
  status: "pending" | "accepted" | "revoked";
  expires_at: string;
};

const acceptClubAdminInviteSchema = z.object({
  token: z.string().uuid("Invitacion invalida.")
});

function buildInvitePath(token: string, error?: string) {
  const basePath = `/admin/clubs/invite/${token}`;
  if (!error) return basePath;
  return `${basePath}?error=${encodeURIComponent(error)}`;
}

function buildClubAdminPanelHref(clubId: string) {
  const searchParams = new URLSearchParams({
    tab: "admins",
    success: "Ya tienes acceso como admin del club."
  });

  return `/admin/clubs/${clubId}?${searchParams.toString()}`;
}

export async function acceptClubAdminInviteAction(formData: FormData) {
  if (!canAccessClubsProduct()) notFound();

  const parsed = acceptClubAdminInviteSchema.safeParse({
    token: formData.get("token")
  });

  if (!parsed.success) {
    redirect("/admin/login?error=Invitacion%20invalida");
  }

  const token = parsed.data.token;
  const rateLimit = await checkActionRateLimit({
    scope: "club-admin-invite:accept",
    organizationId: token,
    ...ACTION_RATE_LIMITS.acceptInvite
  });

  if (!rateLimit.allowed) {
    redirect(buildInvitePath(token, formatActionRateLimitMessage(rateLimit)));
  }

  const loginHref = buildAdminLoginPath(`/admin/clubs/invite/${token}`);
  const supabase = await createSupabaseServerClient();
  const privilegedSupabase = createSupabaseAdminClient() ?? supabase;

  const { data: invite, error: inviteError } = await privilegedSupabase
    .from("club_admin_invites")
    .select("id, club_id, email, status, expires_at")
    .eq("invite_token", token)
    .eq("status", "pending")
    .maybeSingle();

  if (inviteError) {
    redirect(buildInvitePath(token, inviteError.message));
  }

  const pendingInvite = (invite ?? null) as InviteRow | null;
  if (!pendingInvite) {
    redirect(buildInvitePath(token, "Este link no existe, ya fue usado o fue cancelado."));
  }

  const expiresAtMs = Date.parse(pendingInvite.expires_at);
  if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
    redirect(buildInvitePath(token, "Este link ya expiro. Pedi una nueva invitacion al admin del club."));
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.id || !user.email) {
    redirect(loginHref);
  }

  const userEmail = normalizeEmail(user.email);
  const invitedEmail = normalizeEmail(pendingInvite.email);
  if (userEmail !== invitedEmail) {
    redirect(
      buildInvitePath(
        token,
        `Esta invitacion corresponde a ${pendingInvite.email}, pero estas logueado con ${user.email}.`
      )
    );
  }

  const { count: adminsCount, error: adminsCountError } = await privilegedSupabase
    .from("club_admins")
    .select("id", { count: "exact", head: true })
    .eq("club_id", pendingInvite.club_id);

  if (adminsCountError) {
    redirect(buildInvitePath(token, adminsCountError.message));
  }

  if ((adminsCount ?? 0) >= 4) {
    redirect(buildInvitePath(token, "Este club ya alcanzo el maximo de 4 administradores."));
  }

  const { error: ensureAdminError } = await privilegedSupabase.from("admins").upsert(
    {
      id: user.id,
      display_name: deriveDisplayName(
        user.email,
        (user.user_metadata ?? undefined) as Record<string, unknown> | undefined
      )
    },
    { onConflict: "id" }
  );

  if (ensureAdminError) {
    redirect(buildInvitePath(token, ensureAdminError.message));
  }

  const { error: insertMembershipError } = await privilegedSupabase.from("club_admins").insert({
    club_id: pendingInvite.club_id,
    admin_id: user.id,
    created_by: user.id
  });

  if (insertMembershipError && insertMembershipError.code !== "23505") {
    redirect(buildInvitePath(token, insertMembershipError.message));
  }

  const { data: acceptedInvite, error: acceptInviteError } = await privilegedSupabase
    .from("club_admin_invites")
    .update({
      status: "accepted",
      accepted_by: user.id,
      accepted_at: new Date().toISOString()
    })
    .eq("id", pendingInvite.id)
    .eq("status", "pending")
    .eq("email", invitedEmail)
    .select("id")
    .maybeSingle();

  if (acceptInviteError) {
    redirect(buildInvitePath(token, acceptInviteError.message));
  }

  if (!acceptedInvite) {
    redirect(buildInvitePath(token, "La invitacion ya fue usada o cancelada."));
  }

  redirect(buildClubAdminPanelHref(pendingInvite.club_id));
}
