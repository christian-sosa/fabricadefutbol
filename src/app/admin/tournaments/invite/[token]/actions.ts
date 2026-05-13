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
import { normalizeEmail } from "@/lib/org";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type InviteRow = {
  id: string;
  league_id: string;
  email: string;
  status: "pending" | "accepted" | "revoked";
  expires_at: string;
};

const acceptTournamentAdminInviteSchema = z.object({
  token: z.string().uuid("Invitacion invalida.")
});

function buildInvitePath(token: string, error?: string) {
  const basePath = `/admin/tournaments/invite/${token}`;
  if (!error) return basePath;
  return `${basePath}?error=${encodeURIComponent(error)}`;
}

function buildLeagueAdminPanelHref(leagueId: string) {
  const searchParams = new URLSearchParams({
    tab: "admins",
    success: "Ya tienes acceso como admin de la liga."
  });

  return `/admin/tournaments/${leagueId}?${searchParams.toString()}`;
}

export async function acceptTournamentAdminInviteAction(formData: FormData) {
  const parsed = acceptTournamentAdminInviteSchema.safeParse({
    token: formData.get("token")
  });

  if (!parsed.success) {
    redirect("/admin/login?error=Invitacion%20invalida");
  }

  const token = parsed.data.token;
  const rateLimit = await checkActionRateLimit({
    scope: "tournament-admin-invite:accept",
    organizationId: token,
    ...ACTION_RATE_LIMITS.acceptInvite
  });

  if (!rateLimit.allowed) {
    redirect(buildInvitePath(token, formatActionRateLimitMessage(rateLimit)));
  }

  const loginHref = buildAdminLoginPath(`/admin/tournaments/invite/${token}`);
  const supabase = await createSupabaseServerClient();
  const privilegedSupabase = createSupabaseAdminClient() ?? supabase;

  const { data: invite, error: inviteError } = await privilegedSupabase
    .from("league_admin_invites")
    .select("id, league_id, email, status, expires_at")
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
    redirect(buildInvitePath(token, "Este link ya expiro. Pedi una nueva invitacion al admin de la liga."));
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

  const { error: insertMembershipError } = await privilegedSupabase.from("league_admins").insert({
    league_id: pendingInvite.league_id,
    admin_id: user.id,
    role: "editor",
    created_by: user.id
  });

  if (insertMembershipError && insertMembershipError.code !== "23505") {
    redirect(buildInvitePath(token, insertMembershipError.message));
  }

  const { error: deleteInviteError } = await privilegedSupabase
    .from("league_admin_invites")
    .delete()
    .eq("id", pendingInvite.id)
    .eq("status", "pending")
    .eq("email", invitedEmail);

  if (deleteInviteError) {
    redirect(buildInvitePath(token, deleteInviteError.message));
  }

  redirect(buildLeagueAdminPanelHref(pendingInvite.league_id));
}
