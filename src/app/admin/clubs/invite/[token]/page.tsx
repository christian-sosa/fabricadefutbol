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
  club_id: string;
  email: string;
  status: "pending" | "accepted" | "revoked";
  expires_at: string;
};

function buildClubAdminPanelHref(clubId: string) {
  const searchParams = new URLSearchParams({
    tab: "admins",
    success: "Ya tienes acceso como admin del club."
  });

  return `/admin/clubs/${clubId}?${searchParams.toString()}`;
}

export default async function ClubAdminInvitePage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
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
          <CardDescription>Este link ya expiro. Pedi una nueva invitacion al admin del club.</CardDescription>
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

  const { count: adminsCount, error: adminsCountError } = await privilegedSupabase
    .from("club_admins")
    .select("id", { count: "exact", head: true })
    .eq("club_id", pendingInvite.club_id);

  if (adminsCountError) {
    throw new Error(adminsCountError.message);
  }

  if ((adminsCount ?? 0) >= 4) {
    return (
      <div className="py-6">
        <Card>
          <CardTitle>Sin cupo</CardTitle>
          <CardDescription>Este club ya alcanzo el maximo de 4 administradores.</CardDescription>
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

  const { error: insertMembershipError } = await privilegedSupabase.from("club_admins").insert({
    club_id: pendingInvite.club_id,
    admin_id: user.id,
    created_by: user.id
  });

  if (insertMembershipError && insertMembershipError.code !== "23505") {
    throw new Error(insertMembershipError.message);
  }

  const { error: deleteInviteError } = await privilegedSupabase
    .from("club_admin_invites")
    .delete()
    .eq("id", pendingInvite.id)
    .eq("status", "pending")
    .eq("email", invitedEmail);

  if (deleteInviteError) {
    throw new Error(deleteInviteError.message);
  }

  redirect(buildClubAdminPanelHref(pendingInvite.club_id));
}
