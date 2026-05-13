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
  competition_id: string;
  competition_team_id: string;
  email: string;
  expires_at: string;
};

const acceptCaptainInviteSchema = z.object({
  token: z.string().uuid("Invitacion invalida.")
});

function buildInvitePath(token: string, error?: string) {
  const basePath = `/captain/invite/${token}`;
  if (!error) return basePath;
  return `${basePath}?error=${encodeURIComponent(error)}`;
}

function buildCaptainPanelHref(params: { competitionId: string; teamId: string }) {
  const searchParams = new URLSearchParams({
    competition: params.competitionId,
    team: params.teamId,
    success: "Ya tienes acceso a tu equipo."
  });

  return `/captain?${searchParams.toString()}`;
}

export async function acceptCaptainInviteAction(formData: FormData) {
  const parsed = acceptCaptainInviteSchema.safeParse({
    token: formData.get("token")
  });

  if (!parsed.success) {
    redirect("/admin/login?error=Invitacion%20invalida");
  }

  const token = parsed.data.token;
  const rateLimit = await checkActionRateLimit({
    scope: "captain-invite:accept",
    organizationId: token,
    ...ACTION_RATE_LIMITS.acceptInvite
  });

  if (!rateLimit.allowed) {
    redirect(buildInvitePath(token, formatActionRateLimitMessage(rateLimit)));
  }

  const loginHref = buildAdminLoginPath(`/captain/invite/${token}`);
  const supabase = await createSupabaseServerClient();
  const privilegedSupabase = createSupabaseAdminClient() ?? supabase;

  const { data: invite, error: inviteError } = await privilegedSupabase
    .from("competition_captain_invites")
    .select("id, competition_id, competition_team_id, email, expires_at")
    .eq("invite_token", token)
    .maybeSingle();

  if (inviteError) {
    redirect(buildInvitePath(token, inviteError.message));
  }

  const pendingInvite = (invite ?? null) as InviteRow | null;
  if (!pendingInvite) {
    redirect(buildInvitePath(token, "Este enlace no existe, ya fue usado o la invitacion fue revocada."));
  }

  const expiresAt = Date.parse(pendingInvite.expires_at);
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
    redirect(buildInvitePath(token, "Este enlace ya expiro. Pedi una nueva invitacion al admin de la competencia."));
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

  const { data: currentCaptain, error: currentCaptainError } = await privilegedSupabase
    .from("competition_team_captains")
    .select("id, captain_id")
    .eq("competition_id", pendingInvite.competition_id)
    .eq("competition_team_id", pendingInvite.competition_team_id)
    .maybeSingle();

  if (currentCaptainError) {
    redirect(buildInvitePath(token, currentCaptainError.message));
  }

  if (currentCaptain && currentCaptain.captain_id !== user.id) {
    redirect(
      buildInvitePath(
        token,
        "Este equipo ya tiene un capitan confirmado. Pedi al admin de la competencia que genere una nueva invitacion."
      )
    );
  }

  if (!currentCaptain) {
    const { error: assignmentError } = await privilegedSupabase.from("competition_team_captains").insert({
      competition_id: pendingInvite.competition_id,
      competition_team_id: pendingInvite.competition_team_id,
      captain_id: user.id
    });

    if (assignmentError && assignmentError.code !== "23505") {
      redirect(buildInvitePath(token, assignmentError.message));
    }
  }

  const { error: deleteInviteError } = await privilegedSupabase
    .from("competition_captain_invites")
    .delete()
    .eq("id", pendingInvite.id)
    .eq("competition_team_id", pendingInvite.competition_team_id)
    .eq("competition_id", pendingInvite.competition_id)
    .eq("email", invitedEmail);

  if (deleteInviteError) {
    redirect(buildInvitePath(token, deleteInviteError.message));
  }

  redirect(
    buildCaptainPanelHref({
      competitionId: pendingInvite.competition_id,
      teamId: pendingInvite.competition_team_id
    })
  );
}
