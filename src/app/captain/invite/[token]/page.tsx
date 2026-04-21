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
  tournament_id: string;
  team_id: string;
  email: string;
  created_by: string;
  expires_at: string;
};

function buildCaptainPanelHref(params: { tournamentId: string; teamId: string }) {
  const searchParams = new URLSearchParams({
    tournament: params.tournamentId,
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
    .from("tournament_captain_invites")
    .select("id, tournament_id, team_id, email, created_by, expires_at")
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
          <CardTitle>Invitacion invalida</CardTitle>
          <CardDescription>
            Este enlace no existe, ya fue usado o la invitacion fue revocada.
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
          <CardTitle>Invitacion vencida</CardTitle>
          <CardDescription>
            Este enlace ya expiro. Pide una nueva invitacion al admin del torneo.
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
            Esta invitacion corresponde a <strong>{pendingInvite.email}</strong>, pero estas logueado con{" "}
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

  const [{ data: currentTeamCaptain, error: currentTeamCaptainError }, { data: currentTournamentCaptain, error: currentTournamentCaptainError }] =
    await Promise.all([
      privilegedSupabase
        .from("tournament_team_captains")
        .select("id, captain_id")
        .eq("tournament_id", pendingInvite.tournament_id)
        .eq("team_id", pendingInvite.team_id)
        .maybeSingle(),
      privilegedSupabase
        .from("tournament_team_captains")
        .select("id, team_id")
        .eq("tournament_id", pendingInvite.tournament_id)
        .eq("captain_id", user.id)
        .maybeSingle()
    ]);

  if (currentTeamCaptainError) {
    throw new Error(currentTeamCaptainError.message);
  }
  if (currentTournamentCaptainError) {
    throw new Error(currentTournamentCaptainError.message);
  }

  if (currentTeamCaptain && currentTeamCaptain.captain_id !== user.id) {
    return (
      <div className="py-6">
        <Card>
          <CardTitle>Equipo ya asignado</CardTitle>
          <CardDescription>
            Este equipo ya tiene un capitan confirmado. Pide al admin del torneo que genere una nueva invitacion.
          </CardDescription>
          <Link className="mt-3 inline-flex text-sm font-semibold text-emerald-300 hover:underline" href="/captain">
            Ir a mi panel
          </Link>
        </Card>
      </div>
    );
  }

  if (currentTournamentCaptain && currentTournamentCaptain.team_id !== pendingInvite.team_id) {
    return (
      <div className="py-6">
        <Card>
          <CardTitle>Ya administras otro equipo</CardTitle>
          <CardDescription>
            Ya tienes un equipo asignado dentro de este torneo. Si necesitas cambiarlo, pide al admin que actualice tu acceso.
          </CardDescription>
          <Link className="mt-3 inline-flex text-sm font-semibold text-emerald-300 hover:underline" href="/captain">
            Ir a mi panel
          </Link>
        </Card>
      </div>
    );
  }

  if (!currentTeamCaptain) {
    const { error: assignmentError } = await privilegedSupabase.from("tournament_team_captains").insert({
      tournament_id: pendingInvite.tournament_id,
      team_id: pendingInvite.team_id,
      captain_id: user.id,
      created_by: pendingInvite.created_by
    });

    if (assignmentError && assignmentError.code !== "23505") {
      throw new Error(assignmentError.message);
    }
  }

  const { error: deleteInviteError } = await privilegedSupabase
    .from("tournament_captain_invites")
    .delete()
    .eq("id", pendingInvite.id)
    .eq("team_id", pendingInvite.team_id)
    .eq("tournament_id", pendingInvite.tournament_id)
    .eq("email", invitedEmail);

  if (deleteInviteError) {
    throw new Error(deleteInviteError.message);
  }

  redirect(
    buildCaptainPanelHref({
      tournamentId: pendingInvite.tournament_id,
      teamId: pendingInvite.team_id
    })
  );
}
