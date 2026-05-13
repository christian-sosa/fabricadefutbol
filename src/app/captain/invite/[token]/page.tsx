import Link from "next/link";
import { redirect } from "next/navigation";

import { acceptCaptainInviteAction } from "@/app/captain/invite/[token]/actions";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
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

export default async function CaptainInvitePage({
  params,
  searchParams
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const resolvedSearchParams = await searchParams;
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

  return (
    <div className="py-6">
      <Card>
        <CardTitle>Aceptar invitacion</CardTitle>
        <CardDescription className="mt-2">
          Vas a entrar como capitan del equipo con <strong>{user.email}</strong>.
        </CardDescription>

        {resolvedSearchParams.error ? (
          <p className="mt-4 text-sm font-semibold text-danger">{resolvedSearchParams.error}</p>
        ) : null}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <form action={acceptCaptainInviteAction}>
            <input name="token" type="hidden" value={token} />
            <Button type="submit">Aceptar invitacion</Button>
          </form>
          <Link
            className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-emerald-400/60 hover:text-emerald-300"
            href="/captain"
          >
            Ahora no
          </Link>
        </div>
      </Card>
    </div>
  );
}
