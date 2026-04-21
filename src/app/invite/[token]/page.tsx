import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { buildAdminLoginPath } from "@/lib/auth/redirects";
import { deriveDisplayName } from "@/lib/auth/profile";
import { getOrganizationQueryKeyById } from "@/lib/auth/admin";
import { normalizeEmail, withOrgQuery } from "@/lib/org";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function InviteByLinkPage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
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

  const { error: insertMembershipError } = await privilegedSupabase.from("organization_admins").insert({
    organization_id: invite.organization_id,
    admin_id: user.id,
    created_by: user.id
  });

  if (insertMembershipError && insertMembershipError.code !== "23505") {
    throw new Error(insertMembershipError.message);
  }

  const { error: deleteInviteError } = await privilegedSupabase
    .from("organization_invites")
    .delete()
    .eq("id", invite.id)
    .eq("status", "pending")
    .eq("email", invitedEmail);

  if (deleteInviteError) {
    throw new Error(deleteInviteError.message);
  }

  const organizationQueryKey = await getOrganizationQueryKeyById(invite.organization_id);
  redirect(withOrgQuery("/admin", organizationQueryKey));
}
