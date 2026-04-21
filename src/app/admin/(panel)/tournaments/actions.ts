"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assertAdminAction } from "@/lib/auth/admin";
import { assertTournamentMembershipAction, getTournamentSlugById } from "@/lib/auth/tournaments";
import { toUserMessage } from "@/lib/errors";
import { isNextRedirectError } from "@/lib/next-redirect";
import { slugifyTournamentName } from "@/lib/org";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createTournamentSchema = z.object({
  name: z.string().min(3, "El nombre del torneo debe tener al menos 3 caracteres.").max(100),
  seasonLabel: z.string().min(2, "La temporada debe tener al menos 2 caracteres.").max(50),
  description: z.string().max(600).optional(),
  isPublic: z.boolean().default(true)
});

function buildTournamentIndexPath(params?: { error?: string; success?: string }) {
  const basePath = "/admin/tournaments";
  const url = new URL(basePath, "http://localhost");
  if (params?.error) url.searchParams.set("error", params.error);
  if (params?.success) url.searchParams.set("success", params.success);
  if (!params?.error && !params?.success) return basePath;
  return `${basePath}?${url.searchParams.toString()}`;
}

function parseNextSlug(baseSlug: string, existingSlugs: string[]) {
  if (!existingSlugs.includes(baseSlug)) return baseSlug;

  let suffix = 2;
  while (existingSlugs.includes(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseSlug}-${suffix}`;
}

function revalidateTournamentPages(tournamentSlug?: string | null) {
  revalidatePath("/admin/tournaments");
  revalidatePath("/tournaments");
  if (tournamentSlug) {
    revalidatePath(`/tournaments/${tournamentSlug}`);
  }
}

export async function createTournamentAction(formData: FormData) {
  try {
    const admin = await assertAdminAction();
    const parsed = createTournamentSchema.safeParse({
      name: formData.get("name"),
      seasonLabel: formData.get("seasonLabel"),
      description: formData.get("description"),
      isPublic: formData.get("isPublic") === "on"
    });

    if (!parsed.success) {
      redirect(buildTournamentIndexPath({ error: parsed.error.issues[0]?.message ?? "Datos invalidos." }));
    }

    const supabase = await createSupabaseServerClient();
    const baseSlug = slugifyTournamentName(parsed.data.name) || `torneo-${Date.now()}`;
    const { data: existingRows, error: existingError } = await supabase
      .from("tournaments")
      .select("slug")
      .ilike("slug", `${baseSlug}%`);

    if (existingError) {
      redirect(buildTournamentIndexPath({ error: toUserMessage(existingError, "No se pudo crear el torneo.") }));
    }

    const existingSlugs = (existingRows ?? []).map((row) => row.slug.toLowerCase());
    const slug = parseNextSlug(baseSlug, existingSlugs);
    const { data: tournament, error: insertError } = await supabase
      .from("tournaments")
      .insert({
        name: parsed.data.name.trim(),
        slug,
        season_label: parsed.data.seasonLabel.trim(),
        description: parsed.data.description?.trim() || null,
        is_public: parsed.data.isPublic,
        status: "draft",
        created_by: admin.userId
      })
      .select("id")
      .single();

    if (insertError || !tournament) {
      redirect(buildTournamentIndexPath({ error: toUserMessage(insertError, "No se pudo crear el torneo.") }));
    }

    revalidateTournamentPages(slug);
    redirect(`/admin/tournaments/${tournament.id}`);
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildTournamentIndexPath({ error: toUserMessage(error, "No se pudo crear el torneo.") }));
  }
}

export async function archiveTournamentAction(formData: FormData) {
  try {
    const tournamentId = String(formData.get("tournamentId") ?? "");
    if (!tournamentId) {
      redirect(buildTournamentIndexPath({ error: "Falta el torneo a archivar." }));
    }

    await assertTournamentMembershipAction(tournamentId);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("tournaments")
      .update({ status: "archived" })
      .eq("id", tournamentId);

    if (error) {
      redirect(buildTournamentIndexPath({ error: toUserMessage(error, "No se pudo archivar el torneo.") }));
    }

    const slug = await getTournamentSlugById(tournamentId);
    revalidateTournamentPages(slug);
    redirect(buildTournamentIndexPath({ success: "Torneo archivado." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildTournamentIndexPath({ error: toUserMessage(error, "No se pudo archivar el torneo.") }));
  }
}
