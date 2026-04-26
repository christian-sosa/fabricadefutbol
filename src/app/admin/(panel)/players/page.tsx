import { redirect } from "next/navigation";

import {
  bulkUpdatePlayersAction,
  createPlayerAction,
  deletePlayerAction,
  uploadPlayerPhotoAction
} from "@/app/admin/(panel)/players/actions";
import { PhotoUploadInput } from "@/components/admin/photo-upload-input";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Input } from "@/components/ui/input";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { Select } from "@/components/ui/select";
import { getOrganizationWriteAccess, requireAdminOrganization } from "@/lib/auth/admin";
import { formatSkillLevelLabel, SKILL_LEVEL_OPTIONS } from "@/lib/domain/skill-level";
import { getAdminPlayers } from "@/lib/queries/admin";
import { withOrgQuery } from "@/lib/org";
import { formatRendimiento } from "@/lib/utils";

export default async function AdminPlayersPage({
  searchParams
}: {
  searchParams: Promise<{ org?: string; error?: string; success?: string; refresh?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const { admin, organizations, selectedOrganization } = await requireAdminOrganization(resolvedSearchParams.org);
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

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Grupo activo: {selectedOrganization.name}</CardTitle>
        <div className="mt-3">
          <OrganizationSwitcher
            basePath="/admin/players"
            currentOrganizationSlug={selectedOrganization.slug}
            label="Cambiar grupo"
            organizations={organizations}
          />
        </div>
      </Card>

      <Card>
        <CardTitle>Alta de jugador</CardTitle>
        <CardDescription>
          Carga jugadores nuevos para el grupo seleccionado. El nivel es la base manual; el rendimiento aprende con
          los partidos y ayuda a armar equipos mas parejos.
        </CardDescription>
        <form action={createPlayerAction} className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_220px_1.2fr_auto] lg:items-start">
          <input name="organizationId" type="hidden" value={selectedOrganization.id} />
          <Input name="fullName" placeholder="Nombre completo" required />
          <Select aria-label="Nivel de habilidad" defaultValue="3" name="skillLevel" required>
            {SKILL_LEVEL_OPTIONS.map((level) => (
              <option key={level} value={level}>
                {formatSkillLevelLabel(level)}
              </option>
            ))}
          </Select>
          <PhotoUploadInput hint="Foto opcional. JPG, PNG o WEBP." required={false} />
          <Button className="lg:self-start" type="submit">
            Crear jugador
          </Button>
        </form>
      </Card>

      <Card>
        <CardTitle>Editar planilla de jugadores</CardTitle>
        <CardDescription>
          Modifica la planilla y guarda una sola vez. La lista se ordena por nivel despues de guardar, de Nivel 1 a Nivel 5.
          La foto se actualiza en la fila de cada jugador.
        </CardDescription>

        {error ? <p className="mt-3 text-sm font-semibold text-danger">{error}</p> : null}
        {success ? <p className="mt-3 text-sm font-semibold text-emerald-300">{success}</p> : null}

        <form action={bulkUpdatePlayersAction} id={bulkFormId} key={formRenderKey}>
          <input name="organizationId" type="hidden" value={selectedOrganization.id} />
        </form>

        <div className="mt-4 space-y-3">
          <div className="hidden grid-cols-[minmax(220px,2fr)_minmax(170px,0.9fr)_minmax(120px,0.75fr)_minmax(260px,1.6fr)_auto] gap-3 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 lg:grid">
            <span>Jugador</span>
            <span>Nivel</span>
            <span>Rendimiento</span>
            <span>Foto</span>
            <span>Acciones</span>
          </div>

          {players.map((player) => (
            <div
              className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3 lg:grid-cols-[minmax(220px,2fr)_minmax(170px,0.9fr)_minmax(120px,0.75fr)_minmax(260px,1.6fr)_auto] lg:items-start"
              key={player.id}
            >
              <input form={bulkFormId} name="playerId" type="hidden" value={player.id} />
              <div className="min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <PlayerAvatar name={player.full_name} playerId={player.id} size="sm" />
                  <Input className="min-w-0" defaultValue={player.full_name} form={bulkFormId} name="fullName" required />
                </div>
                <p className="text-xs text-slate-400">
                  Creado {new Date(player.created_at).toLocaleDateString("es-AR")}
                </p>
              </div>
              <Select
                aria-label={`Nivel de habilidad de ${player.full_name}`}
                className="min-w-[170px]"
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
              <Input
                defaultValue={formatRendimiento(player.current_rating)}
                form={bulkFormId}
                inputMode="numeric"
                name="currentRating"
                placeholder="1000"
                required
                type="text"
              />
              <form action={uploadPlayerPhotoAction} className="space-y-2 lg:self-start">
                <input name="organizationId" type="hidden" value={selectedOrganization.id} />
                <input name="playerId" type="hidden" value={player.id} />
                <PhotoUploadInput compact hint="JPG, PNG o WEBP. Reemplaza la foto actual." />
                <Button className="w-full" type="submit" variant="secondary">
                  Subir foto
                </Button>
              </form>
              <form action={deletePlayerAction} className="lg:self-start lg:justify-self-end">
                <input name="organizationId" type="hidden" value={selectedOrganization.id} />
                <input name="deletePlayerId" type="hidden" value={player.id} />
                <ConfirmSubmitButton
                  className="h-8 px-3 text-xs"
                  confirmMessage={`Estas seguro de eliminar a ${player.full_name}?`}
                  label="Eliminar"
                  variant="danger"
                />
              </form>
            </div>
          ))}

          <Button form={bulkFormId} type="submit">
            Guardar toda la planilla
          </Button>
        </div>
      </Card>
    </div>
  );
}
