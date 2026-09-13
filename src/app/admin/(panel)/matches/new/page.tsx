import { redirect } from "next/navigation";

import { AdminCurrentGroupCard } from "@/components/admin/admin-current-group-card";
import { NewMatchForm, type NewMatchDefaults } from "@/components/admin/new-match-form";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getOrganizationWriteAccess, requireAdminOrganization } from "@/lib/auth/admin";
import { getCurrentMatchDateInput, matchIsoToTimeInput } from "@/lib/match-datetime";
import { TEAM_SIZE_BY_MODALITY } from "@/lib/constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MatchModality } from "@/types/domain";
import { withOrgQuery } from "@/lib/org";
import { getAdminMatchDetails, getSelectablePlayers } from "@/lib/queries/admin";

export default async function NewMatchPage({
  searchParams
}: {
  searchParams: Promise<{ org?: string; error?: string; repeat?: string; modality?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const { admin, selectedOrganization } = await requireAdminOrganization(resolvedSearchParams.org);
  const writeAccess = await getOrganizationWriteAccess(admin, selectedOrganization.id);
  if (!writeAccess.canWrite) {
    const target = withOrgQuery("/admin", selectedOrganization.slug);
    const separator = target.includes("?") ? "&" : "?";
    redirect(`${target}${separator}error=${encodeURIComponent(writeAccess.reason ?? "No tienes permisos para editar este grupo.")}`);
  }
  const players = await getSelectablePlayers(selectedOrganization.id);
  const defaultModality = resolvedSearchParams.modality && Object.hasOwn(TEAM_SIZE_BY_MODALITY, resolvedSearchParams.modality)
    ? resolvedSearchParams.modality as MatchModality : "6v6";
  let initialValues: NewMatchDefaults | undefined;
  if (resolvedSearchParams.repeat) {
    const supabase = await createSupabaseServerClient();
    let repeatId = resolvedSearchParams.repeat;
    if (repeatId === "last") {
      const { data, error: templateError } = await supabase.from("matches").select("id")
        .eq("organization_id", selectedOrganization.id).in("status", ["confirmed", "finished"])
        .order("scheduled_at", { ascending: false }).limit(1).maybeSingle();
      if (templateError) throw new Error(templateError.message);
      repeatId = data?.id ?? "";
    }
    if (/^[0-9a-f-]{36}$/i.test(repeatId)) {
      const template = await getAdminMatchDetails(repeatId, selectedOrganization.id);
      const option = template?.options.find((row) => row.is_confirmed);
      if (template && option) {
        const members = [...option.teamA, ...option.teamB];
        const activePlayerIds = new Set(players.map((player) => player.id));
        const playerIds = members.filter((member) => !member.is_guest && activePlayerIds.has(member.id)).map((member) => member.id);
        const goalkeeperIds = (template.match.goalkeeper_player_ids ?? []).filter((id: string) => playerIds.includes(id));
        const { data: guests, error: guestError } = await supabase.from("match_guests").select("id, guest_name, guest_rating").eq("match_id", repeatId);
        if (guestError) throw new Error(guestError.message);
        const usedGuests = new Set(members.filter((member) => member.is_guest).map((member) => member.id));
        initialValues = {
          modality: template.match.modality, location: template.match.location ?? "",
          scheduledTime: matchIsoToTimeInput(template.match.scheduled_at), playerIds,
          goalkeeperPlayerIds: goalkeeperIds.length === 2 ? goalkeeperIds : [],
          guests: (guests ?? []).filter((guest) => usedGuests.has(guest.id)).map((guest) => ({ name: guest.guest_name, rating: Number(guest.guest_rating) }))
        };
      }
    }
  }
  const error = resolvedSearchParams.error;
  const defaultScheduledDate = getCurrentMatchDateInput();

  return (
    <div className="space-y-4">
      <AdminCurrentGroupCard admin={admin} organization={selectedOrganization} />

      <Card>
        <CardTitle>{initialValues ? "Repetir partido" : "Crear partido"}</CardTitle>
        <CardDescription>
          1) Elige modalidad, 2) selecciona convocados (y opcionalmente 2 arqueros), 3) genera equipos automáticos o
          arma equipos manuales.
        </CardDescription>

        {initialValues ? <p className="mt-3 text-sm text-emerald-300">Copiamos convocados, invitados, cancha y hora. Revisa la nueva fecha y ajusta quienes juegan.</p> : null}

        <NewMatchForm
          defaultScheduledDate={defaultScheduledDate}
          defaultModality={defaultModality}
          initialValues={initialValues}
          error={error}
          organizationId={selectedOrganization.id}
          players={players}
        />
      </Card>
    </div>
  );
}
