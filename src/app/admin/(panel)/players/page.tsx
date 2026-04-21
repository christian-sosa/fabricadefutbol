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
import { getAdminPlayers } from "@/lib/queries/admin";
import { withOrgQuery } from "@/lib/org";

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
    redirect(`${target}${separator}error=${encodeURIComponent(writeAccess.reason ?? "No tienes permisos para editar esta organizacion.")}`);
  }
  const players = await getAdminPlayers(selectedOrganization.id);
  const error = resolvedSearchParams.error;
  const success = resolvedSearchParams.success;
  const formRenderKey = `${selectedOrganization.id}:${resolvedSearchParams.refresh ?? "base"}`;
  const bulkFormId = `bulk-players-form-${selectedOrganization.id}`;

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Organizacion activa: {selectedOrganization.name}</CardTitle>
        <div className="mt-3">
          <OrganizationSwitcher
            basePath="/admin/players"
            currentOrganizationSlug={selectedOrganization.slug}
            label="Cambiar organizacion"
            organizations={organizations}
          />
        </div>
      </Card>

      <Card>
        <CardTitle>Alta de jugador</CardTitle>
        <CardDescription>Carga jugadores nuevos para la organizacion seleccionada.</CardDescription>
        <form action={createPlayerAction} className="mt-4 grid gap-3 md:grid-cols-4">
          <input name="organizationId" type="hidden" value={selectedOrganization.id} />
          <Input name="fullName" placeholder="Nombre completo" required />
          <Input
            max={Math.max(players.length + 1, 1)}
            min={1}
            name="initialRank"
            placeholder="Ranking inicial"
            required
            type="number"
          />
          <Input disabled value="1000 (automatico)" />
          <Button type="submit">Crear jugador</Button>
        </form>
      </Card>

      <Card>
        <CardTitle>Editar planilla de jugadores</CardTitle>
        <CardDescription>
          Modifica la planilla y guarda una sola vez. La foto ahora se actualiza en la fila de cada jugador.
        </CardDescription>

        {error ? <p className="mt-3 text-sm font-semibold text-danger">{error}</p> : null}
        {success ? <p className="mt-3 text-sm font-semibold text-emerald-300">{success}</p> : null}

        <form action={bulkUpdatePlayersAction} id={bulkFormId} key={formRenderKey}>
          <input name="organizationId" type="hidden" value={selectedOrganization.id} />
        </form>

        <div className="mt-4 space-y-3">
          <div className="hidden grid-cols-[2.2fr_0.8fr_1fr_0.8fr_1.7fr_auto] gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 md:grid">
            <span>Jugador</span>
            <span>Rank</span>
            <span>Rating</span>
            <span>Estado</span>
            <span>Foto</span>
            <span>Acciones</span>
          </div>

          {players.map((player) => (
            <div
              className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3 md:grid-cols-[2.2fr_0.8fr_1fr_0.8fr_1.7fr_auto] md:items-center"
              key={player.id}
            >
              <input form={bulkFormId} name="playerId" type="hidden" value={player.id} />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <PlayerAvatar name={player.full_name} playerId={player.id} size="sm" />
                  <Input defaultValue={player.full_name} form={bulkFormId} name="fullName" required />
                </div>
                <p className="text-xs text-slate-400">
                  Creado {new Date(player.created_at).toLocaleDateString("es-AR")}
                </p>
              </div>
              <Input defaultValue={player.initial_rank} form={bulkFormId} min={1} name="initialRank" required type="number" />
              <Input
                defaultValue={String(Number(player.current_rating))}
                form={bulkFormId}
                inputMode="decimal"
                name="currentRating"
                placeholder="1000"
                required
                type="text"
              />
              <Select defaultValue={player.active ? "true" : "false"} form={bulkFormId} name="activeStatus">
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </Select>
              <form action={uploadPlayerPhotoAction} className="space-y-2">
                <input name="organizationId" type="hidden" value={selectedOrganization.id} />
                <input name="playerId" type="hidden" value={player.id} />
                <PhotoUploadInput compact hint="JPG, PNG o WEBP. Reemplaza la foto actual." />
                <Button className="w-full" type="submit" variant="secondary">
                  Subir foto
                </Button>
              </form>
              <form action={deletePlayerAction} className="md:justify-self-end">
                <input name="organizationId" type="hidden" value={selectedOrganization.id} />
                <input name="deletePlayerId" type="hidden" value={player.id} />
                <ConfirmSubmitButton
                  className="h-8 px-3 text-xs"
                  confirmMessage={`Estas seguro de eliminar a ${player.full_name}? El ranking se reordenara automaticamente.`}
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
