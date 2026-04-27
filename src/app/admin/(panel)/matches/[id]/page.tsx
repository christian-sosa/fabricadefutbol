import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  confirmOptionAction,
  deleteMatchAction,
  regenerateOptionsAction,
  saveLineupBeforeResultAction,
  updateMatchAction,
  updateMatchTeamLabelsAction
} from "@/app/admin/(panel)/matches/[id]/actions";
import { MatchLineupEditor } from "@/components/admin/match-lineup-editor";
import { MatchResultEditorQuery } from "@/components/admin/match-result-editor-query";
import { MatchTeamLabelsShareForm } from "@/components/admin/match-team-labels-share-form";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { TeamOptionCard } from "@/components/matches/team-option-card";
import { MATCH_STATUS_LABELS, MatchStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getOrganizationWriteAccess, requireAdminOrganization } from "@/lib/auth/admin";
import { formatMatchDateTime, matchIsoToDatetimeLocal } from "@/lib/match-datetime";
import { withOrgQuery } from "@/lib/org";
import { buildAbsolutePublicUrl } from "@/lib/public-url";
import { getAdminMatchDetails, getSelectablePlayers } from "@/lib/queries/admin";
import { resolveMatchTeamLabels } from "@/lib/team-labels";

type OptionMember = {
  id: string;
  full_name: string;
  current_rating: number;
  is_guest: boolean;
};

export default async function AdminMatchDetailPage({
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

  const confirmAction = confirmOptionAction.bind(null, id, selectedOrganization.id);
  const regenerateAction = regenerateOptionsAction.bind(null, id, selectedOrganization.id);
  const matchUpdateAction = updateMatchAction.bind(null, id, selectedOrganization.id);
  const teamLabelsUpdateAction = updateMatchTeamLabelsAction.bind(null, id, selectedOrganization.id);
  const deleteAction = deleteMatchAction.bind(null, id, selectedOrganization.id);
  const saveLineupAction = saveLineupBeforeResultAction.bind(null, id, selectedOrganization.id);
  const canDeleteMatch =
    details.match.status === "draft" ||
    (details.match.status === "confirmed" && !details.result);
  const canManageResult = details.match.status === "confirmed" || details.match.status === "finished";
  const confirmedOption = details.options.find((option) => option.is_confirmed) ?? null;
  const visibleOptions = confirmedOption ? [confirmedOption] : details.options;
  const publicMatchUrl = buildAbsolutePublicUrl(withOrgQuery(`/matches/${id}`, selectedOrganization.slug));
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
  const canAdjustLineupBeforeResult =
    details.match.status === "confirmed" && !details.result && editableParticipants.length > 0;
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
            basePath={`/admin/matches/${id}`}
            currentOrganizationSlug={selectedOrganization.slug}
            label="Cambiar grupo"
            organizations={organizations}
          />
        </div>
      </Card>

      <Card>
        <CardTitle>Partido {formatMatchDateTime(details.match.scheduled_at)}</CardTitle>
        <CardDescription className="mt-1">
          {details.match.modality} | <MatchStatusBadge status={details.match.status} />
        </CardDescription>
        {resolvedSearchParams.error ? <p className="mt-3 text-sm font-semibold text-danger">{resolvedSearchParams.error}</p> : null}
      </Card>

      <Card>
        <CardTitle>Editar partido</CardTitle>
        <form action={matchUpdateAction} className="mt-4 grid gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="scheduledAt">
              Fecha y hora
            </label>
            <Input defaultValue={matchIsoToDatetimeLocal(details.match.scheduled_at)} id="scheduledAt" name="scheduledAt" required type="datetime-local" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="location">
              Ubicacion
            </label>
            <Input defaultValue={details.match.location ?? ""} id="location" name="location" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="status">
              Estado
            </label>
            <Select defaultValue={details.match.status} id="status" name="status">
              {(["draft", "confirmed", "finished", "cancelled"] as const).map((status) => (
                <option key={status} value={status}>
                  {MATCH_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-end">
            <Button className="w-full" type="submit" variant="secondary">
              Guardar cambios
            </Button>
          </div>
        </form>
      </Card>

      {canDeleteMatch ? (
        <Card>
          <CardTitle>Eliminar partido</CardTitle>
          <CardDescription>
            Disponible solo para partidos en borrador o confirmados que todavia no tengan resultado.
          </CardDescription>
          <form action={deleteAction} className="mt-4">
            <Button type="submit" variant="danger">
              Borrar partido
            </Button>
          </form>
        </Card>
      ) : null}

      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{confirmedOption ? "Equipo confirmado" : "Opciones de equipos"}</CardTitle>
            <CardDescription>
              {confirmedOption
                ? "Ya se eligio una opcion final. En esta vista solo mostramos el equipo confirmado."
                : "Puedes regenerar en estado draft y confirmar una opcion final."}
            </CardDescription>
          </div>
          {details.match.status === "draft" ? (
            <form action={regenerateAction}>
              <Button type="submit" variant="ghost">
                Regenerar opciones
              </Button>
            </form>
          ) : null}
        </div>
        <div className="space-y-3">
          {visibleOptions.map((option) => (
            <TeamOptionCard
              confirmAction={details.match.status === "draft" ? confirmAction : undefined}
              isConfirmed={option.is_confirmed}
              key={option.id}
              optionId={option.id}
              optionNumber={option.option_number}
              ratingDiff={Number(option.rating_diff)}
              ratingSumA={Number(option.rating_sum_a)}
              ratingSumB={Number(option.rating_sum_b)}
              teamALabel={teamLabels.teamA}
              teamBLabel={teamLabels.teamB}
              teamA={option.teamA}
              teamB={option.teamB}
            />
          ))}
          {!visibleOptions.length ? <p className="text-sm text-slate-400">No hay opciones generadas para este partido.</p> : null}
        </div>
      </Card>

      {confirmedOption ? (
        <Card>
          <CardTitle>Nombres para compartir</CardTitle>
          <CardDescription className="mt-1">
            Se guardan despues de confirmar el armado final de equipos.
          </CardDescription>
          <MatchTeamLabelsShareForm
            action={teamLabelsUpdateAction}
            canShare={details.match.status === "confirmed"}
            initialTeamALabel={details.match.team_a_label}
            initialTeamBLabel={details.match.team_b_label}
            matchUrl={publicMatchUrl}
          />
        </Card>
      ) : null}

      {canAdjustLineupBeforeResult ? (
        <Card>
          <CardTitle>Ajustar formacion antes del resultado</CardTitle>
          <CardDescription>
            Si hubo ausencias, puedes bajar jugadores, subir reemplazos de plantilla o agregar invitados
            antes de cargar el resultado.
          </CardDescription>
          <MatchLineupEditor
            action={saveLineupAction}
            availablePlayers={availableReplacementPlayers}
            existingParticipants={editableParticipants}
            submitLabel="Guardar formacion final (sin resultado)"
            teamALabel={teamLabels.teamA}
            teamBLabel={teamLabels.teamB}
          />
        </Card>
      ) : null}

      {canManageResult ? (
        <Card>
          <CardTitle>{details.result ? "Corregir resultado" : "Cargar resultado"}</CardTitle>
          <CardDescription>
            El partido puede quedar confirmado sin resultado. Cargalo cuando se juegue para finalizar y actualizar rendimientos.
          </CardDescription>
          {editableParticipants.length ? (
            <MatchResultEditorQuery
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
              Falta una opcion confirmada para poder definir la formacion final y guardar resultado.
            </p>
          )}
        </Card>
      ) : (
        <Card>
          <CardTitle>Resultado</CardTitle>
          <CardDescription>Confirma una opcion de equipos para habilitar la carga de resultado cuando se juegue.</CardDescription>
        </Card>
      )}

      <Link className="text-sm font-semibold text-emerald-300 hover:underline" href={withOrgQuery("/admin", selectedOrganization.slug)}>
        Volver al panel del grupo
      </Link>
    </div>
  );
}
