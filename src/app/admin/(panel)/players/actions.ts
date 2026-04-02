"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assertAdminAction } from "@/lib/auth/admin";
import { isNextRedirectError } from "@/lib/next-redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createSchema = z.object({
  fullName: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  initialRank: z.coerce.number().int().positive().max(99)
});

const updateSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().min(3),
  initialRank: z.coerce.number().int().positive().max(99),
  currentRating: z.coerce.number().positive(),
  active: z.boolean()
});

function withMessage(path: string, error: string | null) {
  if (!error) return path;
  const encoded = encodeURIComponent(error);
  return `${path}?error=${encoded}`;
}

export async function createPlayerAction(formData: FormData) {
  try {
    await assertAdminAction();
    const parsed = createSchema.safeParse({
      fullName: formData.get("fullName"),
      initialRank: formData.get("initialRank")
    });
    if (!parsed.success) {
      redirect(withMessage("/admin/players", parsed.error.issues[0]?.message ?? "Datos inválidos."));
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("players").insert({
      full_name: parsed.data.fullName,
      initial_rank: parsed.data.initialRank
    });
    if (error) {
      redirect(withMessage("/admin/players", error.message));
    }

    revalidatePath("/admin/players");
    revalidatePath("/players");
    revalidatePath("/ranking");
    redirect("/admin/players");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : "Error inesperado al crear jugador.";
    redirect(withMessage("/admin/players", message));
  }
}

export async function updatePlayerAction(formData: FormData) {
  try {
    await assertAdminAction();
    const parsed = updateSchema.safeParse({
      id: formData.get("id"),
      fullName: formData.get("fullName"),
      initialRank: formData.get("initialRank"),
      currentRating: formData.get("currentRating"),
      active: formData.get("active") === "on"
    });
    if (!parsed.success) {
      redirect(withMessage("/admin/players", parsed.error.issues[0]?.message ?? "Datos inválidos."));
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("players")
      .update({
        full_name: parsed.data.fullName,
        initial_rank: parsed.data.initialRank,
        current_rating: parsed.data.currentRating,
        active: parsed.data.active
      })
      .eq("id", parsed.data.id);
    if (error) {
      redirect(withMessage("/admin/players", error.message));
    }

    revalidatePath("/admin/players");
    revalidatePath("/players");
    revalidatePath("/ranking");
    redirect("/admin/players");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : "Error inesperado al actualizar jugador.";
    redirect(withMessage("/admin/players", message));
  }
}
