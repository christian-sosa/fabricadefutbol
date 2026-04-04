import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getOrganizationQueryKeyById } from "@/lib/auth/admin";
import { normalizeEmail, withOrgQuery } from "@/lib/org";
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
  params: { token: string };
}) {
  const supabase = await createSupabaseServerClient();
  const { data: invite, error: inviteError } = await supabase
    .from("organization_invites")
    .select("id, organization_id, email, status")
    .eq("invite_token", params.token)
    .eq("status", "pending")
    .maybeSingle();

  if (inviteError || !invite) {
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

  const { error: ensureAdminError } = await supabase.from("admins").upsert(
    {
      id: user.id,
      display_name: deriveDisplayName(user.email, (user.user_metadata ?? undefined) as Record<string, unknown> | undefined)
    },
    { onConflict: "id" }
  );

  if (ensureAdminError) {
    throw new Error(ensureAdminError.message);
  }

  const { error: insertMembershipError } = await supabase.from("organization_admins").insert({
    organization_id: invite.organization_id,
    admin_id: user.id,
    created_by: user.id
  });

  if (insertMembershipError && insertMembershipError.code !== "23505") {
    throw new Error(insertMembershipError.message);
  }

  const { error: deleteInviteError } = await supabase
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
