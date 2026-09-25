"use client";

import { useId, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ActionForm } from "@/components/ui/action-form";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { formActionResult } from "@/lib/form-action-result";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { GROWTH_EVENTS } from "@/lib/growth";
import { buildWhatsAppShareUrl, getWhatsAppShareTarget, type MatchWhatsAppShareParams } from "@/lib/share";
import { DEFAULT_TEAM_A_LABEL, DEFAULT_TEAM_B_LABEL, normalizeTeamLabel, TEAM_LABEL_MAX_LENGTH } from "@/lib/team-labels";

type MatchTeamLabelsShareFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  canShare: boolean;
  initialTeamALabel: string | null;
  initialTeamBLabel: string | null;
  matchUrl: string;
  substitutes?: MatchWhatsAppShareParams["substitutes"];
};

function MatchTeamLabelsFields({
  canShare,
  initialTeamALabel,
  initialTeamBLabel,
  matchUrl,
  substitutes
}: Omit<MatchTeamLabelsShareFormProps, "action">) {
  const { pending } = useFormStatus();
  const [teamALabel, setTeamALabel] = useState(initialTeamALabel ?? "");
  const [teamBLabel, setTeamBLabel] = useState(initialTeamBLabel ?? "");
  const helpId = useId();
  const savedTeamA = normalizeTeamLabel(initialTeamALabel) ?? DEFAULT_TEAM_A_LABEL;
  const savedTeamB = normalizeTeamLabel(initialTeamBLabel) ?? DEFAULT_TEAM_B_LABEL;
  const dirty = (normalizeTeamLabel(teamALabel) ?? DEFAULT_TEAM_A_LABEL) !== savedTeamA ||
    (normalizeTeamLabel(teamBLabel) ?? DEFAULT_TEAM_B_LABEL) !== savedTeamB;

  const handleShare = () => {
    if (pending || dirty) return;
    const target = getWhatsAppShareTarget(window.navigator.userAgent);
    trackAnalyticsEvent(GROWTH_EVENTS.matchShared, { source: "admin_match_detail" });

    window.open(
      buildWhatsAppShareUrl(
        {
          matchUrl,
          teamAName: savedTeamA,
          teamBName: savedTeamB,
          substitutes
        },
        target
      ),
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <>
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="teamALabel">
          Nombre del primer equipo
        </label>
        <Input
          disabled={pending}
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
          disabled={pending}
          id="teamBLabel"
          maxLength={TEAM_LABEL_MAX_LENGTH}
          name="teamBLabel"
          onChange={(event) => setTeamBLabel(event.target.value)}
          placeholder={DEFAULT_TEAM_B_LABEL}
          value={teamBLabel}
        />
      </div>
      <p className="text-sm text-slate-300 md:col-span-2" id={helpId} role="status">
        {pending ? "Guardando nombres. Esperá a que termine para editar o compartir." : dirty ? "Tenés cambios sin guardar. Guardá los nombres antes de compartir para que el mensaje y el enlace coincidan." : "El enlace y el mensaje usan los nombres guardados."}
      </p>
      <div className="flex flex-wrap items-end gap-2 md:col-span-2">
        <FormSubmitButton disabled={!dirty} pendingLabel="Guardando nombres…" variant="secondary">
          Guardar nombres
        </FormSubmitButton>
        {canShare ? (
          <Button aria-describedby={helpId} disabled={pending || dirty} onClick={handleShare} type="button">
            Compartir en WhatsApp
          </Button>
        ) : null}
      </div>
    </>
  );
}

export function MatchTeamLabelsShareForm({ action, ...props }: MatchTeamLabelsShareFormProps) {
  const saveLabels = (data: FormData) => formActionResult(
    async (values) => { await action(values); },
    data,
    new URL(props.matchUrl).pathname.replace(/^\/matches\//, "/admin/matches/")
  );

  return <ActionForm action={saveLabels} className="mt-4 grid gap-3 md:grid-cols-2">
    <MatchTeamLabelsFields {...props} />
  </ActionForm>;
}
