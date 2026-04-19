import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getOrganizationQueryKeyById } from "@/lib/auth/admin";
import { normalizeEmail, withOrgQuery } from "@/lib/org";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function deriveDisplayName(email: string, metadata?: Record<string, unknown>) {
  const fromMetadata =
    typeof metadata?.display_name === "string"
      ? metadata.display_name
      : typeof metadata?.name === "string"
        ? metadata.name
        : null;

  if (fromMetadata && fromMetadata.trim().length) {
    return fromMetadata.trim().slice(0, 80);
  }

  const localPart = email.split("@")[0] ?? "admin";
  return localPart.replace(/[._-]+/g, " ").trim().slice(0, 80) || "admin";
}

export default async function InviteByLinkPage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createSupabaseServerClient();

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
    const withExpires = await supabase
      .from("organization_invites")
      .select("id, organization_id, email, status, expires_at")
      .eq("invite_token", token)
      .eq("status", "pending")
      .maybeSingle();

    if (!withExpires.error) {
      invite = (withExpires.data ?? null) as InviteRow | null;
    } else {
      const legacy = await supabase
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
          <Link className="mt-3 inline-flex text-sm font-semibold text-emerald-300 hover:underline" href="/admin/login">
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
            <Link className="mt-3 inline-flex text-sm font-semibold text-emerald-300 hover:underline" href="/admin/login">
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
    redirect("/admin/login");
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
          <Link className="mt-3 inline-flex text-sm font-semibold text-emerald-300 hover:underline" href="/admin/login">
            Cambiar de cuenta
          </Link>
        </Card>
      </div>
    );
  }

  const privilegedSupabase = createSupabaseAdminClient() ?? supabase;

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
