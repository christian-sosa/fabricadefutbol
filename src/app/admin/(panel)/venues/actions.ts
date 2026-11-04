"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertOrganizationAdminAction } from "@/lib/auth/admin";
import { mapSupabaseError, toUserMessage } from "@/lib/errors";
import type { FormActionResult } from "@/lib/form-action-result";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { MAX_ACTIVE_VENUES, MAX_VENUE_NAME_LENGTH } from "./limits";

const capMessage = `Este grupo ya tiene ${MAX_ACTIVE_VENUES} canchas activas.`;
const venueNameSchema = z.string({ invalid_type_error: "Ingresá el nombre de la cancha." })
  .transform((name) => name.trim().replace(/\s+/g, " "))
  .pipe(z.string().min(1, "Ingresá el nombre de la cancha.").max(MAX_VENUE_NAME_LENGTH, `El nombre puede tener hasta ${MAX_VENUE_NAME_LENGTH} caracteres.`));

function venueWriteError(error: { code: string; message: string }, fallback: string) {
  if (error.code === "23505") {
    return "Ya existe una cancha con ese nombre. Si está archivada, podés restaurarla.";
  }
  if (error.code === "23514" && error.message === capMessage) {
    return `${capMessage} Archivá una para liberar un cupo.`;
  }
  return mapSupabaseError(error, fallback);
}

function revalidateVenuePages() {
  revalidatePath("/admin/venues");
  revalidatePath("/admin/matches/new");
  revalidatePath("/admin/matches/[id]", "page");
}

export async function saveVenueAction(organizationId: string, venueId: string | null, formData: FormData): Promise<FormActionResult> {
  const name = venueNameSchema.safeParse(formData.get("name"));
  if (!name.success) return { error: name.error.issues[0]?.message ?? "Ingresá un nombre válido." };

  const fallback = "No pudimos guardar la cancha.";
  try {
    await assertOrganizationAdminAction(organizationId);
    const supabase = await createSupabaseServerClient();
    const venues = supabase.from("organization_venues");
    const { data, error } = await (venueId
      ? venues.update({ name: name.data }).eq("organization_id", organizationId).eq("id", venueId).is("archived_at", null)
      : venues.insert({ organization_id: organizationId, name: name.data }))
      .select("id").maybeSingle();
    if (error) return { error: venueWriteError(error, fallback) };
    if (!data) return { error: "La cancha ya no está disponible para editar. Recargá la página." };
  } catch (error) {
    return { error: toUserMessage(error, fallback) };
  }

  revalidateVenuePages();
  return { error: null };
}

export async function setVenueArchivedAction(organizationId: string, venueId: string, archived: boolean): Promise<FormActionResult> {
  const fallback = archived ? "No pudimos archivar la cancha." : "No pudimos restaurar la cancha.";
  try {
    await assertOrganizationAdminAction(organizationId);
    const supabase = await createSupabaseServerClient();
    const update = supabase.from("organization_venues")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("organization_id", organizationId).eq("id", venueId);
    const { data, error } = await (archived ? update.is("archived_at", null) : update.not("archived_at", "is", null))
      .select("id").maybeSingle();
    if (error) return { error: venueWriteError(error, fallback) };
    if (!data) return { error: "La cancha cambió mientras la editabas. Recargá la página." };
  } catch (error) {
    return { error: toUserMessage(error, fallback) };
  }

  revalidateVenuePages();
  return { error: null };
}
