import { createPlayerAction, updatePlayerAction } from "@/app/admin/(panel)/players/actions";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { getAdminPlayers } from "@/lib/queries/admin";

export default async function AdminPlayersPage({
  searchParams
}: {
  searchParams: { error?: string };
}) {
  const players = await getAdminPlayers();
  const error = searchParams.error;

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Alta de jugador</CardTitle>
        <CardDescription>Carga jugadores nuevos para el grupo fijo.</CardDescription>
        <form action={createPlayerAction} className="mt-4 grid gap-3 md:grid-cols-4">
          <Input name="fullName" placeholder="Nombre completo" required />
          <Input max={99} min={1} name="initialRank" placeholder="Ranking inicial" required type="number" />
          <Input disabled value="1000 (automatico)" />
          <Button type="submit">Crear jugador</Button>
        </form>
        {error ? <p className="mt-3 text-sm font-semibold text-danger">{error}</p> : null}
      </Card>

      <Card>
        <CardTitle>Editar jugadores</CardTitle>
        <CardDescription>Puedes ajustar ranking inicial, rating actual o estado activo.</CardDescription>
        <div className="mt-4 space-y-3">
          {players.map((player) => (
            <form
              action={updatePlayerAction}
              className="grid gap-2 rounded-xl border border-slate-800 bg-slate-900 p-3 md:grid-cols-7 md:items-center"
              key={player.id}
            >
              <input name="id" type="hidden" value={player.id} />
              <div className="flex items-center gap-2 md:col-span-2">
                <PlayerAvatar name={player.full_name} playerId={player.id} size="sm" />
                <Input defaultValue={player.full_name} name="fullName" required />
              </div>
              <Input defaultValue={player.initial_rank} max={99} min={1} name="initialRank" required type="number" />
              <Input
                defaultValue={Number(player.current_rating).toFixed(2)}
                name="currentRating"
                required
                step="0.01"
                type="number"
              />
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                <input defaultChecked={player.active} name="active" type="checkbox" />
                Activo
              </label>
              <p className="text-xs text-slate-400">
                ID foto: {player.id}
                <br />
                Creado {new Date(player.created_at).toLocaleDateString("es-AR")}
              </p>
              <Button type="submit" variant="secondary">
                Guardar
              </Button>
            </form>
          ))}
        </div>
      </Card>
    </div>
  );
}
