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
import { requireAdminOrganization } from "@/lib/auth/admin";
import { getAdminPlayers } from "@/lib/queries/admin";

export default async function AdminPlayersPage({
  searchParams
}: {
  searchParams: { org?: string; error?: string; success?: string };
}) {
  const { organizations, selectedOrganization } = await requireAdminOrganization(searchParams.org);
  const players = await getAdminPlayers(selectedOrganization.id);
  const error = searchParams.error;
  const success = searchParams.success;
  const photoSuccess = success?.toLowerCase().includes("foto") ? success : null;

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
        <CardTitle>Subir foto de jugador</CardTitle>
        <CardDescription>La imagen se optimiza y se guarda en Supabase Storage, reemplazando la foto anterior.</CardDescription>
        <form action={uploadPlayerPhotoAction} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input name="organizationId" type="hidden" value={selectedOrganization.id} />
          <Select name="playerId" required>
            <option value="">Selecciona jugador</option>
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                #{player.initial_rank} - {player.full_name}
              </option>
            ))}
          </Select>
          <PhotoUploadInput />
          <Button type="submit" variant="secondary">
            Subir foto
          </Button>
        </form>
        {photoSuccess ? <p className="mt-3 text-sm font-semibold text-emerald-300">{photoSuccess}</p> : null}
      </Card>

      <Card>
        <CardTitle>Editar planilla de jugadores</CardTitle>
        <CardDescription>
          Modifica la planilla y guarda una sola vez. Si cambias el rank de alguien, el resto se reordena automaticamente.
        </CardDescription>

        {error ? <p className="mt-3 text-sm font-semibold text-danger">{error}</p> : null}
        {success ? <p className="mt-3 text-sm font-semibold text-emerald-300">{success}</p> : null}

        <form action={bulkUpdatePlayersAction} className="mt-4 space-y-3">
          <input name="organizationId" type="hidden" value={selectedOrganization.id} />
          <input name="deletePlayerId" type="hidden" value="" />

          <div className="hidden grid-cols-[2.2fr_0.8fr_1fr_0.8fr_1.2fr] gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 md:grid">
            <span>Jugador</span>
            <span>Rank</span>
            <span>Rating</span>
            <span>Estado</span>
            <span>Foto / meta</span>
          </div>

          {players.map((player) => (
            <div
              className="grid gap-2 rounded-xl border border-slate-800 bg-slate-900 p-3 md:grid-cols-[2.2fr_0.8fr_1fr_0.8fr_1.2fr] md:items-center"
              key={player.id}
            >
              <input name="playerId" type="hidden" value={player.id} />
              <div className="flex items-center gap-2">
                <PlayerAvatar name={player.full_name} playerId={player.id} size="sm" />
                <Input defaultValue={player.full_name} name="fullName" required />
              </div>
              <Input defaultValue={player.initial_rank} min={1} name="initialRank" required type="number" />
              <Input
                defaultValue={Number(player.current_rating).toFixed(2)}
                min={1}
                name="currentRating"
                required
                step="0.01"
                type="number"
              />
              <Select defaultValue={player.active ? "true" : "false"} name="activeStatus">
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </Select>
              <p className="text-xs text-slate-400">
                ID foto: {player.id}
                <br />
                Creado {new Date(player.created_at).toLocaleDateString("es-AR")}
              </p>
              <ConfirmSubmitButton
                className="mt-2 h-8 px-3 text-xs"
                confirmMessage={`Estas seguro de eliminar a ${player.full_name}? El ranking se reordenara automaticamente.`}
                formAction={deletePlayerAction}
                formNoValidate
                label="Eliminar jugador"
                setHiddenField={{ name: "deletePlayerId", value: player.id }}
                variant="danger"
              />
            </div>
          ))}

          <Button type="submit">Guardar toda la planilla</Button>
        </form>
      </Card>
    </div>
  );
}
