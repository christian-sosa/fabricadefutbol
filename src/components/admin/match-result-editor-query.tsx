"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

type ReplacementPlayerOption = {
  id: string;
  fullName: string;
  rating: number;
};

type MatchResultEditorQueryProps = {
  organizationId: string;
  matchId: string;
  existingParticipants: ExistingParticipant[];
  availablePlayers?: ReplacementPlayerOption[];
  defaultScoreA: number;
  defaultScoreB: number;
  defaultMvpParticipantId?: string | null;
  defaultNotes?: string | null;
  submitLabel: string;
  successRedirectHref?: string;
  teamALabel?: string;
  teamBLabel?: string;
};

export function MatchResultEditorQuery(props: MatchResultEditorQueryProps) {
  const { organizationId, matchId, successRedirectHref, ...editorProps } = props;
  const mutation = useUpdateMatchResultMutation({ organizationId, matchId });
  const router = useRouter();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  return (
    <div>
      <MatchResultEditor
        {...editorProps}
        onSubmit={async (payload) => {
          await mutation.mutateAsync(payload);
          if (successRedirectHref) {
            router.push(successRedirectHref);
            return;
          }
          setSuccessMessage("Resultado guardado. Se actualizaran solo los datos de este grupo.");
        }}
      />
      {successMessage ? <p className="mt-2 text-sm font-semibold text-emerald-300">{successMessage}</p> : null}
    </div>
  );
}
