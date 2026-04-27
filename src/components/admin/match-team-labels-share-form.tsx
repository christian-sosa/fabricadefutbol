"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildWhatsAppShareUrl } from "@/lib/share";
import { DEFAULT_TEAM_A_LABEL, DEFAULT_TEAM_B_LABEL, normalizeTeamLabel, TEAM_LABEL_MAX_LENGTH } from "@/lib/team-labels";

type MatchTeamLabelsShareFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  canShare: boolean;
  initialTeamALabel: string | null;
  initialTeamBLabel: string | null;
  matchUrl: string;
};

export function MatchTeamLabelsShareForm({
  action,
  canShare,
  initialTeamALabel,
  initialTeamBLabel,
  matchUrl
}: MatchTeamLabelsShareFormProps) {
  const [teamALabel, setTeamALabel] = useState(initialTeamALabel ?? "");
  const [teamBLabel, setTeamBLabel] = useState(initialTeamBLabel ?? "");

  const shareLabels = useMemo(
    () => ({
      teamA: normalizeTeamLabel(teamALabel) ?? DEFAULT_TEAM_A_LABEL,
      teamB: normalizeTeamLabel(teamBLabel) ?? DEFAULT_TEAM_B_LABEL
    }),
    [teamALabel, teamBLabel]
  );

  const handleShare = () => {
    window.open(
      buildWhatsAppShareUrl({
        matchUrl,
        teamAName: shareLabels.teamA,
        teamBName: shareLabels.teamB
      }),
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <form action={action} className="mt-4 grid gap-3 md:grid-cols-3">
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="teamALabel">
          Nombre del primer equipo
        </label>
        <Input
          id="teamALabel"
          maxLength={TEAM_LABEL_MAX_LENGTH}
          name="teamALabel"
          onChange={(event) => setTeamALabel(event.target.value)}
          placeholder={DEFAULT_TEAM_A_LABEL}
          value={teamALabel}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="teamBLabel">
          Nombre del segundo equipo
        </label>
        <Input
          id="teamBLabel"
          maxLength={TEAM_LABEL_MAX_LENGTH}
          name="teamBLabel"
          onChange={(event) => setTeamBLabel(event.target.value)}
          placeholder={DEFAULT_TEAM_B_LABEL}
          value={teamBLabel}
        />
      </div>
      <div className="flex items-end gap-2">
        <Button className="flex-1" type="submit" variant="secondary">
          Guardar
        </Button>
        {canShare ? (
          <Button className="flex-1" onClick={handleShare} type="button">
            WhatsApp
          </Button>
        ) : null}
      </div>
    </form>
  );
}
