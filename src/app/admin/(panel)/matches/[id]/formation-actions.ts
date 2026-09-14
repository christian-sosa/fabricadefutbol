"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertOrganizationAdminAction } from "@/lib/auth/admin";
import { toFormationPlayers, validateMatchFormation, type FormationSaveResult } from "@/lib/domain/match-formation";
import { getAdminMatchDetails } from "@/lib/queries/admin";
import { isNextRedirectError } from "@/lib/next-redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export async function saveMatchFormationAction(matchId: string, organizationId: string, expectedVersion: number, payload: string): Promise<FormationSaveResult> {
  const input = z.object({ matchId: z.string().uuid(), organizationId: z.string().uuid(), expectedVersion: z.number().int().nonnegative(), payload: z.string().max(6000) }).safeParse({ matchId, organizationId, expectedVersion, payload });
  if (!input.success) return { ok: false, error: "La formación enviada no es válida." };
  try {
    await assertOrganizationAdminAction(organizationId);
    const details = await getAdminMatchDetails(matchId, organizationId);
    if (!details || details.match.status !== "confirmed") return { ok: false, error: "Solo se pueden armar formaciones de partidos confirmados sin resultado." };
    const option = details.options.find((candidate) => candidate.id === details.match.confirmed_option_id && candidate.is_confirmed);
    if (!option) return { ok: false, error: "Primero confirmá los equipos del partido." };
    let value: unknown;
    try { value = JSON.parse(payload); } catch { return { ok: false, error: "La formación enviada no es válida." }; }
    if (value !== null) value = validateMatchFormation(value, details.match.modality, {
      teamA: toFormationPlayers(option.teamA, details.match.goalkeeper_player_ids),
      teamB: toFormationPlayers(option.teamB, details.match.goalkeeper_player_ids)
    });
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("save_group_match_formation", {
      p_match_id: matchId, p_organization_id: organizationId, p_expected_version: expectedVersion, p_formation: value as Json
    });
    if (error) return { ok: false, conflict: error.code === "PT409", error: error.code === "PT409" ? "Otra sesión cambió la formación o los equipos. Recargá antes de guardar." : error.message };
    const version = (data as { formation_version: number }).formation_version;
    revalidatePath(`/admin/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}`);
    revalidatePath("/upcoming");
    return { ok: true, version };
  } catch (cause) {
    if (isNextRedirectError(cause)) throw cause;
    return { ok: false, error: cause instanceof Error ? cause.message : "No se pudo guardar la formación. Volvé a intentar." };
  }
}
