import Link from "next/link";
import { redirect } from "next/navigation";

import { acceptInviteAction } from "@/app/invite/[token]/actions";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { buildAdminLoginPath } from "@/lib/auth/redirects";
import { normalizeEmail } from "@/lib/org";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function InviteByLinkPage({
  params,
  searchParams
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const resolvedSearchParams = await searchParams;
  const loginHref = buildAdminLoginPath(`/invite/${token}`);
  const supabase = await createSupabaseServerClient();
  const privilegedSupabase = createSupabaseAdminClient() ?? supabase;

  type InviteRow = {
    id: string;
    organization_id: string;
    email: string;
    status: string;
    expires_at?: string | null;
  };
  // Intentamos leer tambien `expires_at` cuando la columna existe; si no,
  // caemos al select legacy sin expiracion.
  let invite: InviteRow | null = null;
  {
    const withExpires = await privilegedSupabase
      .from("organization_invites")
      .select("id, organization_id, email, status, expires_at")
      .eq("invite_token", token)
      .eq("status", "pending")
      .maybeSingle();

    if (!withExpires.error) {
      invite = (withExpires.data ?? null) as InviteRow | null;
    } else {
      const legacy = await privilegedSupabase
        .from("organization_invites")
        .select("id, organization_id, email, status")
        .eq("invite_token", token)
        .eq("status", "pending")
        .maybeSingle();
      if (legacy.error) {
        throw new Error(legacy.error.message);
      }
      invite = (legacy.data ?? null) as InviteRow | null;
    }
  }

  if (!invite) {
    return (
      <div className="py-6">
        <Card>
          <CardTitle>Invitacion invalida</CardTitle>
          <CardDescription>
            Este link no existe, ya fue usado o fue cancelado.
          </CardDescription>
          <Link className="mt-3 inline-flex text-sm font-semibold text-emerald-300 hover:underline" href={loginHref}>
            Ir a login
          </Link>
        </Card>
      </div>
    );
  }

  const { data: organization } = await privilegedSupabase
    .from("organizations")
    .select("id, name")
    .eq("id", invite.organization_id)
    .maybeSingle();
  const organizationName = organization?.name ?? "este grupo";

  if (invite.expires_at) {
    const expiresAtMs = Date.parse(invite.expires_at);
    if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
      return (
        <div className="py-6">
          <Card>
            <CardTitle>Invitacion vencida</CardTitle>
            <CardDescription>
              Este link ya expiro. Pedi una nueva invitacion a tu admin.
            </CardDescription>
            <Link className="mt-3 inline-flex text-sm font-semibold text-emerald-300 hover:underline" href={loginHref}>
              Ir a login
            </Link>
          </Card>
        </div>
      );
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
    return (
      <div className="py-6">
        <Card>
          <CardTitle>Email no coincide</CardTitle>
          <CardDescription>
            Esta invitacion corresponde a <strong>{invite.email}</strong>, pero estas logueado con <strong>{user.email}</strong>.
          </CardDescription>
          <Link className="mt-3 inline-flex text-sm font-semibold text-emerald-300 hover:underline" href={loginHref}>
            Cambiar de cuenta
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl py-6">
      <Card>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
          Invitacion de admin
        </p>
        <CardTitle className="mt-3">Aceptar acceso a {organizationName}</CardTitle>
        <CardDescription className="mt-2">
          Vas a entrar como administrador con <strong>{user.email}</strong>. Al aceptar vas a poder gestionar jugadores,
          partidos, resultados e invitaciones de este grupo.
        </CardDescription>

        {resolvedSearchParams.error ? (
          <p className="mt-4 text-sm font-semibold text-danger">{resolvedSearchParams.error}</p>
        ) : null}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <form action={acceptInviteAction}>
            <input name="token" type="hidden" value={token} />
            <Button type="submit">Aceptar invitacion</Button>
          </form>
          <Link
            className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-emerald-400/60 hover:text-emerald-300"
            href="/admin"
          >
            Ahora no
          </Link>
        </div>
      </Card>
    </div>
  );
}
