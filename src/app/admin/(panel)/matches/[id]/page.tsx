import { notFound } from "next/navigation";

import {
  confirmOptionAction,
  deleteMatchAction,
  regenerateOptionsAction,
  saveResultAction,
  updateMatchAction
} from "@/app/admin/(panel)/matches/[id]/actions";
import { TeamOptionCard } from "@/components/matches/team-option-card";
import { MatchStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getAdminMatchDetails } from "@/lib/queries/admin";
import { formatDateTime } from "@/lib/utils";

function toInputDateTime(isoDate: string) {
  const date = new Date(isoDate);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default async function AdminMatchDetailPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const details = await getAdminMatchDetails(params.id);
  if (!details) notFound();

  const confirmAction = confirmOptionAction.bind(null, params.id);
  const regenerateAction = regenerateOptionsAction.bind(null, params.id);
  const resultAction = saveResultAction.bind(null, params.id);
  const matchUpdateAction = updateMatchAction.bind(null, params.id);
  const deleteAction = deleteMatchAction.bind(null, params.id);
  const canDeleteMatch =
    details.match.status === "draft" ||
    (details.match.status === "confirmed" && !details.result);
  const canManageResult = details.match.status === "confirmed" || details.match.status === "finished";

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Partido {formatDateTime(details.match.scheduled_at)}</CardTitle>
        <CardDescription className="mt-1">
          {details.match.modality} | <MatchStatusBadge status={details.match.status} />
        </CardDescription>
        {searchParams.error ? <p className="mt-3 text-sm font-semibold text-danger">{searchParams.error}</p> : null}
      </Card>

      <Card>
        <CardTitle>Editar partido</CardTitle>
        <form action={matchUpdateAction} className="mt-4 grid gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="scheduledAt">
              Fecha y hora
            </label>
            <Input defaultValue={toInputDateTime(details.match.scheduled_at)} id="scheduledAt" name="scheduledAt" required type="datetime-local" />
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
              <option value="draft">draft</option>
              <option value="confirmed">confirmed</option>
              <option value="finished">finished</option>
              <option value="cancelled">cancelled</option>
            </Select>
          </div>
          <div className="flex items-end">
            <Button className="w-full" type="submit" variant="secondary">
              Guardar cambios
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardTitle>Convocados ({details.roster.length})</CardTitle>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {details.roster.map((player) => (
            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm" key={player.id}>
              <span className="flex items-center gap-2">
                <PlayerAvatar name={player.full_name} playerId={player.is_guest ? undefined : player.id} size="sm" />
                {player.full_name}
                {player.is_guest ? (
                  <span className="rounded-full border border-cyan-400/50 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-200">
                    Invitado
                  </span>
                ) : null}
              </span>
              {!player.is_guest ? <span className="font-semibold text-emerald-300">{Number(player.current_rating).toFixed(2)}</span> : null}
            </div>
          ))}
        </div>
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
        <div className="mb-4 flex items-center justify-between">
          <div>
            <CardTitle>Opciones de equipos</CardTitle>
            <CardDescription>Puedes regenerar en estado draft y confirmar una opcion final.</CardDescription>
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
          {details.options.map((option) => (
            <TeamOptionCard
              confirmAction={details.match.status === "draft" ? confirmAction : undefined}
              isConfirmed={option.is_confirmed}
              key={option.id}
              optionId={option.id}
              optionNumber={option.option_number}
              ratingDiff={Number(option.rating_diff)}
              ratingSumA={Number(option.rating_sum_a)}
              ratingSumB={Number(option.rating_sum_b)}
              teamA={option.teamA}
              teamB={option.teamB}
            />
          ))}
          {!details.options.length ? <p className="text-sm text-slate-400">No hay opciones generadas para este partido.</p> : null}
        </div>
      </Card>

      {canManageResult ? (
        <Card>
          <CardTitle>{details.result ? "Corregir resultado" : "Cargar resultado"}</CardTitle>
          <CardDescription>
            El partido puede quedar confirmado sin resultado. Cargalo cuando se juegue para finalizar y actualizar ratings.
          </CardDescription>
          <form action={resultAction} className="mt-4 grid gap-3 md:grid-cols-4">
            <Input defaultValue={details.result?.score_a ?? 0} min={0} name="scoreA" required type="number" />
            <Input defaultValue={details.result?.score_b ?? 0} min={0} name="scoreB" required type="number" />
            <Textarea className="md:col-span-2" defaultValue={details.result?.notes ?? ""} name="notes" placeholder="Notas opcionales" rows={3} />
            <div className="md:col-span-4">
              <Button type="submit">{details.result ? "Guardar correccion" : "Guardar resultado y finalizar"}</Button>
            </div>
          </form>
        </Card>
      ) : (
        <Card>
          <CardTitle>Resultado</CardTitle>
          <CardDescription>Confirma una opcion de equipos para habilitar la carga de resultado cuando se juegue.</CardDescription>
        </Card>
      )}
    </div>
  );
}
