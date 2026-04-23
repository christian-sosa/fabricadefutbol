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
  email: string;
  invited_by: string;
  status: "pending" | "accepted" | "revoked";
  expires_at: string;
};

function buildTournamentAdminPanelHref(tournamentId: string) {
  const searchParams = new URLSearchParams({
    tab: "summary",
    success: "Ya tienes acceso como admin del torneo."
  });

  return `/admin/tournaments/${tournamentId}?${searchParams.toString()}`;
}

export default async function TournamentAdminInvitePage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const loginHref = buildAdminLoginPath(`/admin/tournaments/invite/${token}`);
  const supabase = await createSupabaseServerClient();
  const privilegedSupabase = createSupabaseAdminClient() ?? supabase;

  const { data: invite, error: inviteError } = await privilegedSupabase
    .from("tournament_admin_invites")
    .select("id, tournament_id, email, invited_by, status, expires_at")
    .eq("invite_token", token)
    .eq("status", "pending")
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
          <CardDescription>Este link no existe, ya fue usado o fue cancelado.</CardDescription>
          <Link className="mt-3 inline-flex text-sm font-semibold text-emerald-300 hover:underline" href={loginHref}>
            Ir a login
          </Link>
        </Card>
      </div>
    );
  }

  const expiresAtMs = Date.parse(pendingInvite.expires_at);
  if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
    return (
      <div className="py-6">
        <Card>
          <CardTitle>Invitacion vencida</CardTitle>
          <CardDescription>Este link ya expiro. Pide una nueva invitacion al admin del torneo.</CardDescription>
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

  const { error: insertMembershipError } = await privilegedSupabase.from("tournament_admins").insert({
    tournament_id: pendingInvite.tournament_id,
    admin_id: user.id,
    role: "editor",
    created_by: pendingInvite.invited_by
  });

  if (insertMembershipError && insertMembershipError.code !== "23505") {
    throw new Error(insertMembershipError.message);
  }

  const { error: deleteInviteError } = await privilegedSupabase
    .from("tournament_admin_invites")
    .delete()
    .eq("id", pendingInvite.id)
    .eq("status", "pending")
    .eq("email", invitedEmail);

  if (deleteInviteError) {
    throw new Error(deleteInviteError.message);
  }

  redirect(buildTournamentAdminPanelHref(pendingInvite.tournament_id));
}
