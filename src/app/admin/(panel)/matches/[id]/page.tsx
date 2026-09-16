import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  confirmOptionAction,
  deleteMatchAction,
  regenerateOptionsAction,
  updateMatchAction,
  updateMatchTeamLabelsAction
} from "@/app/admin/(panel)/matches/[id]/actions";
import { AdminCurrentGroupCard } from "@/components/admin/admin-current-group-card";
import { MatchDateTimeFields } from "@/components/admin/match-date-time-fields";
import { MatchTeamLabelsShareForm } from "@/components/admin/match-team-labels-share-form";
import { TeamOptionsList } from "@/components/matches/team-options-list";
import { MatchFormationEditor } from "@/components/admin/match-formation-editor";
import { saveMatchFormationAction } from "@/app/admin/(panel)/matches/[id]/formation-actions";
import { readMatchFormation, supportsMatchFormation, toFormationPlayers } from "@/lib/domain/match-formation";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getOrganizationWriteAccess, requireAdminOrganization } from "@/lib/auth/admin";
import { matchIsoToDateInput, matchIsoToTimeInput } from "@/lib/match-datetime";
import { withOrgQuery } from "@/lib/org";
import { buildAbsolutePublicUrl } from "@/lib/public-url";
import { getAdminMatchDetails } from "@/lib/queries/admin";
import { resolveMatchTeamLabels } from "@/lib/team-labels";

export default async function AdminMatchDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ org?: string; error?: string }>;
}) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const { admin, selectedOrganization } = await requireAdminOrganization(resolvedSearchParams.org);
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
  const canDeleteMatch =
    details.match.status === "draft" ||
    (details.match.status === "confirmed" && !details.result);
  const confirmedOption = details.options.find((option) => option.is_confirmed) ?? null;
  const visibleOptions = confirmedOption ? [confirmedOption] : details.options;
  const publicMatchUrl = buildAbsolutePublicUrl(withOrgQuery(`/matches/${id}`, selectedOrganization.slug));
  const resultHref = withOrgQuery(`/admin/matches/${id}/result`, selectedOrganization.slug);
  const teamLabels = resolveMatchTeamLabels(details.match);
  const canManageResult = details.match.status === "confirmed" || details.match.status === "finished";
  const formationTeams = confirmedOption ? {
    teamA: toFormationPlayers(confirmedOption.teamA, details.match.goalkeeper_player_ids),
    teamB: toFormationPlayers(confirmedOption.teamB, details.match.goalkeeper_player_ids)
  } : null;
  const savedFormation = formationTeams ? readMatchFormation(details.match.formation_data, details.match.modality, formationTeams) : null;

  return (
    <div className="space-y-4">
      <AdminCurrentGroupCard admin={admin} organization={selectedOrganization} />

      {resolvedSearchParams.error ? (
        <p className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm font-semibold text-danger">
          {resolvedSearchParams.error}
        </p>
      ) : null}

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{selectedOrganization.name}</p>
        <h1 className="mt-2 text-2xl font-black text-white">{details.result ? "Partido finalizado" : confirmedOption ? "Equipos confirmados" : "Elegí los equipos"}</h1>
        <p className="mt-2 text-lg font-semibold text-slate-200">{details.result ? `${teamLabels.teamA} ${details.result.score_a} – ${details.result.score_b} ${teamLabels.teamB}` : confirmedOption ? "Compartí los equipos. Después del partido, cargá el resultado." : "Revisá las opciones de abajo para dejar el partido listo."}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground" href={details.result ? withOrgQuery(`/admin/matches/new?repeat=${id}`, selectedOrganization.slug) : confirmedOption ? "#compartir-equipos" : "#opciones-equipos"}>
            {details.result ? "Repetir este partido" : confirmedOption ? "Compartir equipos" : "Ver opciones de equipos"}
          </Link>
          {canManageResult ? <Link className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold" href={resultHref}>{details.result ? "Modificar resultado" : "Cargar resultado"}</Link> : null}
        </div>
      </Card>

      {confirmedOption ? (
        <Card id="compartir-equipos">
          <CardTitle>Compartir equipos</CardTitle>
          <CardDescription className="mt-1">
            Personalizá los nombres si querés y compartí el enlace con tu grupo.
          </CardDescription>
          <MatchTeamLabelsShareForm
            action={teamLabelsUpdateAction}
            key={`${id}:${details.match.team_a_label}:${details.match.team_b_label}`}
            canShare={details.match.status === "confirmed"}
            initialTeamALabel={details.match.team_a_label}
            initialTeamBLabel={details.match.team_b_label}
            matchUrl={publicMatchUrl}
          />
        </Card>
      ) : null}

      {formationTeams && details.match.status === "confirmed" && supportsMatchFormation(details.match.modality) ? (
        <MatchFormationEditor
          action={saveMatchFormationAction.bind(null, id, selectedOrganization.id)}
          initialFormation={savedFormation}
          initialVersion={details.match.formation_version ?? 0}
          key={`${id}:${confirmedOption?.id}:${details.match.result_version}`}
          modality={details.match.modality}
          teamLabels={teamLabels}
          teams={formationTeams}
        />
      ) : null}

      <Card id="opciones-equipos">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{confirmedOption ? "Equipo confirmado" : "Opciones de equipos"}</CardTitle>
            <CardDescription>
              {confirmedOption
                ? "Esta es la opción confirmada para el partido."
                : "Compará las opciones y confirmá la que prefieras. Podés generar otras mientras el partido sea un borrador."}
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
        <TeamOptionsList confirmAction={details.match.status === "draft" ? confirmAction : undefined} options={visibleOptions.map((option) => ({
          isConfirmed: option.is_confirmed, optionId: option.id, optionNumber: option.option_number,
          ratingDiff: Number(option.rating_diff), ratingSumA: Number(option.rating_sum_a), ratingSumB: Number(option.rating_sum_b),
          teamALabel: teamLabels.teamA, teamBLabel: teamLabels.teamB, teamA: option.teamA, teamB: option.teamB
        }))} />
      </Card>

      <details className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Editar fecha y cancha</summary>
        <form action={matchUpdateAction} className="mt-4 grid gap-3 md:grid-cols-4">
          <MatchDateTimeFields
            dateName="scheduledDate"
            defaultDate={matchIsoToDateInput(details.match.scheduled_at)}
            defaultTime={matchIsoToTimeInput(details.match.scheduled_at)}
            requiredTime
            timeName="scheduledTime"
          />
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="location">
              Ubicacion
            </label>
            <Input defaultValue={details.match.location ?? ""} id="location" name="location" />
          </div>
          <div className="flex items-end">
            <Button className="w-full" type="submit" variant="secondary">
              Guardar cambios
            </Button>
          </div>
        </form>
      </details>

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

      <Link className="text-sm font-semibold text-emerald-300 hover:underline" href={withOrgQuery("/admin", selectedOrganization.slug)}>
        Volver al panel del grupo
      </Link>
    </div>
  );
}
