"use client";

import { useState } from "react";

import { MatchResultEditor } from "@/components/admin/match-result-editor";
import { useUpdateMatchResultMutation } from "@/lib/query/hooks";
import type { TeamSide } from "@/types/domain";

type ExistingParticipant = {
  participantId: string;
  fullName: string;
  rating: number;
  source: "player" | "guest";
  initialTeam: TeamSide;
};

type MatchResultEditorQueryProps = {
  organizationId: string;
  matchId: string;
  existingParticipants: ExistingParticipant[];
  defaultScoreA: number;
  defaultScoreB: number;
  defaultNotes?: string | null;
  submitLabel: string;
  teamALabel?: string;
  teamBLabel?: string;
};

export function MatchResultEditorQuery(props: MatchResultEditorQueryProps) {
  const { organizationId, matchId, ...editorProps } = props;
  const mutation = useUpdateMatchResultMutation({ organizationId, matchId });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  return (
    <div>
      <MatchResultEditor
        {...editorProps}
        onSubmit={async (payload) => {
          await mutation.mutateAsync(payload);
          setSuccessMessage("Resultado guardado. Se actualizaran solo los datos de este grupo.");
        }}
      />
      {successMessage ? <p className="mt-2 text-sm font-semibold text-emerald-300">{successMessage}</p> : null}
    </div>
  );
}
