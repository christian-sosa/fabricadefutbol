import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { DEFAULT_TEAM_A_LABEL, DEFAULT_TEAM_B_LABEL } from "@/lib/team-labels";
import { cn, formatRendimiento } from "@/lib/utils";

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
  teamALabel?: string;
  teamBLabel?: string;
  isConfirmed: boolean;
  confirmAction?: (formData: FormData) => void;
};

function buildBalanceSummary(params: {
  ratingDiff: number;
  ratingSumA: number;
  ratingSumB: number;
  teamALabel: string;
  teamBLabel: string;
  playersPerTeam: number;
}) {
  const { ratingDiff, ratingSumA, ratingSumB, teamALabel, teamBLabel, playersPerTeam } = params;
  const leadingTeamLabel = ratingSumA > ratingSumB ? teamALabel : teamBLabel;
  const averageDiff = Math.abs(ratingDiff) / Math.max(playersPerTeam, 1);

  if (ratingDiff === 0) {
    return {
      label: "Parejo perfecto",
      detail: "Sin ventaja clara",
      tone: "excellent"
    } as const;
  }

  if (averageDiff <= 20) {
    return {
      label: "Muy parejo",
      detail: `Apenas inclina para ${leadingTeamLabel}`,
      tone: "excellent"
    } as const;
  }

  if (averageDiff <= 45) {
    return {
      label: "Buen balance",
      detail: `Leve ventaja para ${leadingTeamLabel}`,
      tone: "good"
    } as const;
  }

  if (averageDiff <= 75) {
    return {
      label: "Balance ajustado",
      detail: `${leadingTeamLabel} queda mas fuerte`,
      tone: "warning"
    } as const;
  }

  return {
    label: "Para revisar",
    detail: `${leadingTeamLabel} queda bastante mas fuerte`,
    tone: "danger"
  } as const;
}

const balanceToneClassName = {
  excellent: "border-emerald-400/45 bg-emerald-500/10 text-emerald-200",
  good: "border-cyan-400/40 bg-cyan-500/10 text-cyan-200",
  warning: "border-amber-400/45 bg-amber-500/10 text-amber-100",
  danger: "border-rose-400/45 bg-rose-500/10 text-rose-100"
} as const;

export function TeamOptionCard({
  optionId,
  optionNumber,
  teamA,
  teamB,
  ratingDiff,
  ratingSumA,
  ratingSumB,
  teamALabel = DEFAULT_TEAM_A_LABEL,
  teamBLabel = DEFAULT_TEAM_B_LABEL,
  isConfirmed,
  confirmAction
}: TeamOptionCardProps) {
  const balanceSummary = buildBalanceSummary({
    ratingDiff,
    ratingSumA,
    ratingSumB,
    teamALabel,
    teamBLabel,
    playersPerTeam: Math.max(teamA.length, teamB.length)
  });

  return (
    <Card className={isConfirmed ? "border-emerald-400/60 ring-2 ring-emerald-400/25" : ""}>
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <CardTitle>Opcion {optionNumber}</CardTitle>
          <CardDescription className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-semibold",
                balanceToneClassName[balanceSummary.tone]
              )}
            >
              {balanceSummary.label}
            </span>
            <span className="text-slate-300">{balanceSummary.detail}</span>
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
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{teamALabel}</p>
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
                {!player.is_guest ? <span className="font-semibold text-emerald-300">{formatRendimiento(player.current_rating)}</span> : null}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{teamBLabel}</p>
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
                {!player.is_guest ? <span className="font-semibold text-emerald-300">{formatRendimiento(player.current_rating)}</span> : null}
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
