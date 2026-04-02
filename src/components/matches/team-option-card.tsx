import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/ui/player-avatar";

type OptionPlayer = {
  id: string;
  full_name: string;
  current_rating: number;
  is_guest?: boolean;
};

type TeamOptionCardProps = {
  optionId: string;
  optionNumber: number;
  teamA: OptionPlayer[];
  teamB: OptionPlayer[];
  ratingDiff: number;
  ratingSumA: number;
  ratingSumB: number;
  isConfirmed: boolean;
  confirmAction?: (formData: FormData) => void;
};

export function TeamOptionCard({
  optionId,
  optionNumber,
  teamA,
  teamB,
  ratingDiff,
  ratingSumA,
  ratingSumB,
  isConfirmed,
  confirmAction
}: TeamOptionCardProps) {
  return (
    <Card className={isConfirmed ? "border-emerald-400/60 ring-2 ring-emerald-400/25" : ""}>
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <CardTitle>Opcion {optionNumber}</CardTitle>
          <CardDescription>
            Suma A: {ratingSumA.toFixed(2)} | Suma B: {ratingSumB.toFixed(2)} | Diferencia:{" "}
            <span className="font-semibold text-emerald-300">{ratingDiff.toFixed(2)}</span>
          </CardDescription>
        </div>
        {isConfirmed ? (
          <span className="rounded-full border border-emerald-400/50 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
            Confirmada
          </span>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Equipo A</p>
          <ul className="space-y-2 text-sm text-slate-200">
            {teamA.map((player) => (
              <li className="flex items-center justify-between gap-2" key={player.id}>
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
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Equipo B</p>
          <ul className="space-y-2 text-sm text-slate-200">
            {teamB.map((player) => (
              <li className="flex items-center justify-between gap-2" key={player.id}>
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
              </li>
            ))}
          </ul>
        </div>
      </div>

      {!isConfirmed && confirmAction ? (
        <form action={confirmAction} className="mt-4">
          <input name="optionId" type="hidden" value={optionId} />
          <Button type="submit">Confirmar esta opcion</Button>
        </form>
      ) : null}
    </Card>
  );
}
