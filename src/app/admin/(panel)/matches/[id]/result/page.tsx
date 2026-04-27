import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { MatchResultEditorQuery } from "@/components/admin/match-result-editor-query";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getOrganizationWriteAccess, requireAdminOrganization } from "@/lib/auth/admin";
import { withOrgQuery } from "@/lib/org";
import { getAdminMatchDetails, getSelectablePlayers } from "@/lib/queries/admin";
import { resolveMatchTeamLabels } from "@/lib/team-labels";

type OptionMember = {
  id: string;
  full_name: string;
  current_rating: number;
  is_guest: boolean;
};

export default async function AdminMatchResultPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ org?: string; error?: string }>;
}) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const { admin, organizations, selectedOrganization } = await requireAdminOrganization(resolvedSearchParams.org);
  const writeAccess = await getOrganizationWriteAccess(admin, selectedOrganization.id);
  if (!writeAccess.canWrite) {
    const target = withOrgQuery("/admin", selectedOrganization.slug);
    const separator = target.includes("?") ? "&" : "?";
    redirect(`${target}${separator}error=${encodeURIComponent(writeAccess.reason ?? "No tienes permisos para editar este grupo.")}`);
  }

  const details = await getAdminMatchDetails(id, selectedOrganization.id);
  if (!details) notFound();

  const canManageResult = details.match.status === "confirmed" || details.match.status === "finished";
  const confirmedOption = details.options.find((option) => option.is_confirmed) ?? null;
  const teamLabels = resolveMatchTeamLabels(details.match);
  const editableParticipants = confirmedOption
    ? [
        ...confirmedOption.teamA.map((member: OptionMember) => ({
          participantId: `${member.is_guest ? "guest" : "player"}:${member.id}`,
          fullName: member.full_name,
          rating: Number(member.current_rating),
          source: member.is_guest ? "guest" : "player",
          initialTeam: "A" as const
        })),
        ...confirmedOption.teamB.map((member: OptionMember) => ({
          participantId: `${member.is_guest ? "guest" : "player"}:${member.id}`,
          fullName: member.full_name,
          rating: Number(member.current_rating),
          source: member.is_guest ? "guest" : "player",
          initialTeam: "B" as const
        }))
      ]
    : [];
  const selectablePlayers = await getSelectablePlayers(selectedOrganization.id);
  const availableReplacementPlayers = selectablePlayers.map((player) => ({
    id: player.id,
    fullName: player.full_name,
    rating: Number(player.current_rating)
  }));

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Grupo activo: {selectedOrganization.name}</CardTitle>
        <div className="mt-3">
          <OrganizationSwitcher
            basePath={`/admin/matches/${id}/result`}
            currentOrganizationSlug={selectedOrganization.slug}
            label="Cambiar grupo"
            organizations={organizations}
          />
        </div>
      </Card>

      {resolvedSearchParams.error ? (
        <p className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm font-semibold text-danger">
          {resolvedSearchParams.error}
        </p>
      ) : null}

      <Card>
        <CardTitle>{details.result ? "Corregir resultado" : "Cargar resultado"}</CardTitle>
        <CardDescription>
          Carga marcador, ausencias y reemplazos en una sola accion.
        </CardDescription>
        {canManageResult && editableParticipants.length ? (
          <MatchResultEditorQuery
            availablePlayers={availableReplacementPlayers}
            defaultNotes={details.result?.notes ?? ""}
            defaultScoreA={details.result?.score_a ?? 0}
            defaultScoreB={details.result?.score_b ?? 0}
            existingParticipants={editableParticipants}
            matchId={id}
            organizationId={selectedOrganization.id}
            submitLabel={details.result ? "Guardar correccion" : "Guardar resultado y finalizar"}
            teamALabel={teamLabels.teamA}
            teamBLabel={teamLabels.teamB}
          />
        ) : (
          <p className="mt-3 text-sm text-slate-400">
            Confirma una opcion de equipos para habilitar la carga de resultado cuando se juegue.
          </p>
        )}
      </Card>

      <Link className="text-sm font-semibold text-emerald-300 hover:underline" href={withOrgQuery(`/admin/matches/${id}`, selectedOrganization.slug)}>
        Volver a editar partido
      </Link>
    </div>
  );
}
