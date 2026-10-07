import Link from "next/link";
import { redirect } from "next/navigation";

import {
  deletePlayerAction
} from "@/app/admin/(panel)/players/actions";
import { createPlayerFormAction, updatePlayersFormAction, uploadPlayerPhotoFormAction } from "@/app/admin/(panel)/form-actions";
import { ActionForm } from "@/components/ui/action-form";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { AdminCurrentGroupCard } from "@/components/admin/admin-current-group-card";
import { PhotoUploadInput } from "@/components/admin/photo-upload-input";
import { PlayerInjuryForm } from "@/components/admin/player-injury-form";
import { PlayerPositionFields } from "@/components/admin/player-position-fields";
import { PlayersRosterGuard, PlayersRosterPendingStatus } from "@/components/admin/players-roster-guard";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Input } from "@/components/ui/input";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { PlayerInjuryBadge } from "@/components/ui/player-injury-badge";
import { Select } from "@/components/ui/select";
import { secondaryActionClass } from "@/components/ui/styles";
import { getOrganizationWriteAccess, requireAdminOrganization } from "@/lib/auth/admin";
import { DEFAULT_SKILL_LEVEL, formatSkillLevelLabel, SKILL_LEVEL_OPTIONS } from "@/lib/domain/skill-level";
import { getAdminPlayers } from "@/lib/queries/admin";
import { withOrgQuery } from "@/lib/org";
import { BulkCreatePlayersForm } from "./bulk-create-form";

const primaryActionLinkClass =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:brightness-110";

const secondaryActionLinkClass = secondaryActionClass;

const playersRosterGridColumns =
  "lg:grid-cols-[minmax(180px,1.2fr)_minmax(160px,0.8fr)_minmax(280px,1.6fr)_minmax(150px,0.9fr)]";

export default async function AdminPlayersPage({
  searchParams
}: {
  searchParams: Promise<{ org?: string; error?: string; success?: string; notice?: string; photoPlayer?: string; refresh?: string; view?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const { admin, selectedOrganization } = await requireAdminOrganization(resolvedSearchParams.org);
  const writeAccess = await getOrganizationWriteAccess(admin, selectedOrganization.id);
  if (!writeAccess.canWrite) {
    const target = withOrgQuery("/admin", selectedOrganization.slug);
    const separator = target.includes("?") ? "&" : "?";
    redirect(`${target}${separator}error=${encodeURIComponent(writeAccess.reason ?? "No tienes permisos para editar este grupo.")}`);
  }
  const players = await getAdminPlayers(selectedOrganization.id);
  const error = resolvedSearchParams.error;
  const success = resolvedSearchParams.success;
  const formRenderKey = `${selectedOrganization.id}:${resolvedSearchParams.refresh ?? "base"}`;
  const bulkFormId = `bulk-players-form-${selectedOrganization.id}`;
  const showCreateForm = resolvedSearchParams.view === "new" || players.length === 0;
  const showEditRoster = !showCreateForm;
  const createHref = withOrgQuery("/admin/players?view=new", selectedOrganization.slug);
  const editHref = withOrgQuery("/admin/players?view=edit", selectedOrganization.slug);

  return (
    <div className="space-y-4">
      <AdminCurrentGroupCard admin={admin} organization={selectedOrganization} />

      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Gestión de jugadores</CardTitle>
            <CardDescription className="mt-1">
              {players.length} jugadores cargados en {selectedOrganization.name}.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className={showCreateForm ? primaryActionLinkClass : secondaryActionLinkClass} href={createHref}>
              Alta de jugador
            </Link>
            <Link className={showEditRoster ? primaryActionLinkClass : secondaryActionLinkClass} href={editHref}>
              Editar planilla
            </Link>
          </div>
        </div>

        {error ? <p className="mt-3 text-sm font-semibold text-danger" role="alert">{error}</p> : null}
        {success ? <p className="mt-3 text-sm font-semibold text-emerald-300" role="status">{success}</p> : null}
        {resolvedSearchParams.notice ? <p className="mt-3 text-sm font-semibold text-amber-200" role="status">{resolvedSearchParams.notice}</p> : null}
      </Card>

      {showCreateForm ? (
        <Card>
          <CardTitle>Cargá el plantel de una vez</CardTitle>
          <CardDescription className="mt-2">Pegá la lista que ya usás para organizar el partido.</CardDescription>
          <BulkCreatePlayersForm organizationId={selectedOrganization.id} />
        </Card>
      ) : null}

      {showCreateForm ? (
        <Card>
          <CardTitle>Alta de jugador</CardTitle>
          <CardDescription>
            Las posiciones son opcionales y ayudan a armar los equipos de fútbol 9, 10 y 11.
          </CardDescription>
          <ActionForm action={createPlayerFormAction} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.1fr)_220px_minmax(0,1.2fr)] lg:items-start">
            <input name="organizationId" type="hidden" value={selectedOrganization.id} />
            <label className="grid gap-1 text-sm text-slate-300">
              Nombre completo
              <Input aria-label="Nombre completo del jugador" name="fullName" placeholder="Nombre completo" required />
            </label>
            <label className="grid gap-1 text-sm text-slate-300">
              Nivel de habilidad
              <Select aria-label="Nivel de habilidad" defaultValue={String(DEFAULT_SKILL_LEVEL)} name="skillLevel" required>
              {SKILL_LEVEL_OPTIONS.map((level) => (
                <option key={level} value={level}>
                  {formatSkillLevelLabel(level)}
                </option>
              ))}
              </Select>
            </label>
            <PlayerPositionFields className="sm:col-span-2 lg:col-span-1" />
            <PhotoUploadInput hint="Foto opcional. JPG, PNG o WEBP." required={false} />
            <FormSubmitButton className="lg:self-start" pendingLabel="Creando jugador…">
              Crear jugador
            </FormSubmitButton>
          </ActionForm>
        </Card>
      ) : null}

      {showEditRoster ? (
        <Card>
          <CardTitle>Editar planilla de jugadores</CardTitle>
          <CardDescription>
            Editá nombres, niveles y posiciones. Al terminar, guardá toda la planilla.
          </CardDescription>
          <p className="mt-2 text-sm text-slate-400">Posiciones opcionales para fútbol 9, 10 y 11.</p>
          <details className="mt-1 text-sm text-slate-400">
            <summary className="min-h-11 cursor-pointer content-center py-2 text-slate-300">Ayuda sobre niveles, posiciones y lesiones</summary>
            <div className="mt-2 space-y-2">
              <p>La planilla se ordena de Nivel 1 a Nivel 7. Nivel 1 es Estrella y Nivel 7 es Principiante. Cambiar el nivel no reinicia los puntos. El nivel “Figura” es distinto de la figura del partido.</p>
              <p id="player-position-help">Elegí una preferida para habilitar una secundaria distinta. En fútbol 9, 10 y 11 ayudan a equilibrar; si faltan posiciones, se usan los jugadores disponibles.</p>
              <p id="player-injury-help">Las lesiones se guardan al instante. Los lesionados siguen en el ranking y no se cuentan como inactivos.</p>
            </div>
          </details>

          <PlayersRosterGuard formId={bulkFormId} key={formRenderKey} organizationId={selectedOrganization.id} players={players.map(({ id, full_name, skill_level, preferred_position, secondary_position }) => ({ id, full_name, skill_level, preferred_position, secondary_position }))}>
          <ActionForm action={updatePlayersFormAction} className="sticky top-20 z-10 mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/95 p-3" id={bulkFormId}>
            <PlayersRosterPendingStatus />
            <input name="organizationId" type="hidden" value={selectedOrganization.id} />
            <FormSubmitButton pendingLabel="Guardando planilla…">Guardar toda la planilla</FormSubmitButton>
          </ActionForm>

          <div className="mt-4 space-y-3">
            <div
              className={`hidden ${playersRosterGridColumns} gap-3 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 lg:grid`}
            >
              <span>Jugador</span>
              <span>Nivel</span>
              <span>Posiciones</span>
              <span>Acciones</span>
            </div>

            {players.map((player) => (
              <div
                className={`grid ${playersRosterGridColumns} gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3 lg:items-start`}
                 key={player.id}
                 id={`player-${player.id}`}
                 data-roster-player={player.id}
              >
                <input form={bulkFormId} name="playerId" type="hidden" value={player.id} />
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <PlayerAvatar hasPhoto={Boolean(player.photo_path)} name={player.full_name} photoUpdatedAt={player.photo_updated_at} playerId={player.id} size="sm" />
                    <Input aria-label={`Nombre de ${player.full_name}`} className="min-w-0" defaultValue={player.full_name} form={bulkFormId} name="fullName" required />
                  </div>
                  <PlayerInjuryForm organizationId={selectedOrganization.id}>
                    <PlayersRosterPendingStatus />
                    <input name="organizationId" type="hidden" value={selectedOrganization.id} />
                    <input name="playerId" type="hidden" value={player.id} />
                    <input name="isInjured" type="hidden" value={player.is_injured ? "false" : "true"} />
                    {player.is_injured ? <PlayerInjuryBadge /> : null}
                    <FormSubmitButton
                      aria-describedby="player-injury-help"
                      aria-label={`${player.is_injured ? "Marcar recuperado" : "Marcar lesionado"} a ${player.full_name}`}
                      className="px-2 text-xs"
                      pendingLabel="Guardando estado…"
                      variant="ghost"
                    >
                      {player.is_injured ? "Marcar recuperado" : "Marcar lesionado"}
                    </FormSubmitButton>
                  </PlayerInjuryForm>
                </div>
                <label className="grid min-w-0 gap-1 text-xs text-slate-300">
                  Nivel de habilidad
                <Select
                  aria-label={`Nivel de habilidad de ${player.full_name}`}
                  className="min-w-0"
                  defaultValue={String(player.skill_level)}
                  form={bulkFormId}
                  name="skillLevel"
                  required
                >
                  {SKILL_LEVEL_OPTIONS.map((level) => (
                    <option key={level} value={level}>
                      {formatSkillLevelLabel(level)}
                    </option>
                  ))}
                </Select>
                </label>
                <PlayerPositionFields describedBy="player-position-help" form={bulkFormId} playerName={player.full_name} preferredPosition={player.preferred_position} secondaryPosition={player.secondary_position} />
                <details open={resolvedSearchParams.photoPlayer === player.id}>
                  <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-slate-300">Foto y acciones de {player.full_name}</summary>
                <ActionForm
                  action={uploadPlayerPhotoFormAction}
                  className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_112px] lg:items-start lg:self-start"
                >
                  <input name="organizationId" type="hidden" value={selectedOrganization.id} />
                  <input name="playerId" type="hidden" value={player.id} />
                  <PhotoUploadInput compact hint="JPG, PNG o WEBP. Reemplaza la foto actual." />
                  <FormSubmitButton className="w-full lg:w-auto" pendingLabel="Subiendo…" variant="secondary">
                    Subir foto
                  </FormSubmitButton>
                </ActionForm>
                <form action={deletePlayerAction} className="mt-3">
                  <input name="organizationId" type="hidden" value={selectedOrganization.id} />
                  <input name="deletePlayerId" type="hidden" value={player.id} />
                  <ConfirmSubmitButton
                    className="px-3 text-xs"
                    confirmMessage={`Estas seguro de eliminar a ${player.full_name}?`}
                    label="Eliminar"
                    variant="danger"
                  />
                </form>
                </details>
              </div>
            ))}

           </div>
          </PlayersRosterGuard>
         </Card>
      ) : null}
    </div>
  );
}
