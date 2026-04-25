import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { buildAdminLoginPath } from "@/lib/auth/redirects";
import { deriveDisplayName } from "@/lib/auth/profile";
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

function buildCaptainPanelHref(params: { competitionId: string; teamId: string }) {
  const searchParams = new URLSearchParams({
    competition: params.competitionId,
    team: params.teamId,
    success: "Ya tienes acceso a tu equipo."
  });

  return `/captain?${searchParams.toString()}`;
}

export default async function CaptainInvitePage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const loginHref = buildAdminLoginPath(`/captain/invite/${token}`);
  const supabase = await createSupabaseServerClient();
  const privilegedSupabase = createSupabaseAdminClient() ?? supabase;

  const { data: invite, error: inviteError } = await privilegedSupabase
    .from("competition_captain_invites")
    .select("id, competition_id, competition_team_id, email, expires_at")
    .eq("invite_token", token)
    .maybeSingle();

  if (inviteError) {
    throw new Error(inviteError.message);
  }

  const pendingInvite = (invite ?? null) as InviteRow | null;
  if (!pendingInvite) {
    return (
      <div className="py-6">
        <Card>
          <CardTitle>Invitación inválida</CardTitle>
          <CardDescription>
            Este enlace no existe, ya fue usado o la invitación fue revocada.
          </CardDescription>
          <Link className="mt-3 inline-flex text-sm font-semibold text-emerald-300 hover:underline" href={loginHref}>
            Ir a login
          </Link>
        </Card>
      </div>
    );
  }

  const expiresAt = Date.parse(pendingInvite.expires_at);
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
    return (
      <div className="py-6">
        <Card>
          <CardTitle>Invitación vencida</CardTitle>
          <CardDescription>
            Este enlace ya expiró. Pide una nueva invitación al admin de la competencia.
          </CardDescription>
          <Link className="mt-3 inline-flex text-sm font-semibold text-emerald-300 hover:underline" href={loginHref}>
            Ir a login
          </Link>
        </Card>
      </div>
    );
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
    return (
      <div className="py-6">
        <Card>
          <CardTitle>Email no coincide</CardTitle>
          <CardDescription>
            Esta invitación corresponde a <strong>{pendingInvite.email}</strong>, pero estás logueado con{" "}
            <strong>{user.email}</strong>.
          </CardDescription>
          <Link className="mt-3 inline-flex text-sm font-semibold text-emerald-300 hover:underline" href={loginHref}>
            Cambiar de cuenta
          </Link>
        </Card>
      </div>
    );
  }

  const { error: ensureAdminError } = await privilegedSupabase.from("admins").upsert(
    {
      id: user.id,
      display_name: deriveDisplayName(user.email, (user.user_metadata ?? undefined) as Record<string, unknown> | undefined)
    },
    { onConflict: "id" }
  );

  if (ensureAdminError) {
    throw new Error(ensureAdminError.message);
  }

  const { data: currentCaptain, error: currentCaptainError } = await privilegedSupabase
    .from("competition_team_captains")
    .select("id, captain_id")
    .eq("competition_id", pendingInvite.competition_id)
    .eq("competition_team_id", pendingInvite.competition_team_id)
    .maybeSingle();

  if (currentCaptainError) {
    throw new Error(currentCaptainError.message);
  }

  if (currentCaptain && currentCaptain.captain_id !== user.id) {
    return (
      <div className="py-6">
        <Card>
          <CardTitle>Equipo ya asignado</CardTitle>
          <CardDescription>
            Este equipo ya tiene un capitán confirmado. Pide al admin de la competencia que genere una nueva invitación.
          </CardDescription>
          <Link className="mt-3 inline-flex text-sm font-semibold text-emerald-300 hover:underline" href="/captain">
            Ir a mi panel
          </Link>
        </Card>
      </div>
    );
  }

  if (!currentCaptain) {
    const { error: assignmentError } = await privilegedSupabase.from("competition_team_captains").insert({
      competition_id: pendingInvite.competition_id,
      competition_team_id: pendingInvite.competition_team_id,
      captain_id: user.id
    });

    if (assignmentError && assignmentError.code !== "23505") {
      throw new Error(assignmentError.message);
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
    throw new Error(deleteInviteError.message);
  }

  redirect(buildCaptainPanelHref({ competitionId: pendingInvite.competition_id, teamId: pendingInvite.competition_team_id }));
}
