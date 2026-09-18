"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { setPlayerInjuryFormAction } from "@/app/admin/(panel)/form-actions";
import { ActionForm } from "@/components/ui/action-form";
import { organizationQueryKeys } from "@/lib/query/keys";

export function PlayerInjuryForm({ children, organizationId }: { children: ReactNode; organizationId: string }) {
  const queryClient = useQueryClient();

  async function saveInjury(data: FormData) {
    try {
      return await setPlayerInjuryFormAction(data);
    } finally {
      // Successful Server Actions redirect by throwing. Refresh previously visited
      // rankings too, before that redirect reaches Next's navigation boundary.
      await queryClient.invalidateQueries({
        queryKey: organizationQueryKeys.byId(organizationId),
        refetchType: "all"
      });
    }
  }

  return <ActionForm action={saveInjury} className="flex flex-wrap items-center gap-2">{children}</ActionForm>;
}
