"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assertAdminAction } from "@/lib/auth/admin";
import { TEAM_SIZE_BY_MODALITY } from "@/lib/constants";
import { createDraftMatchWithOptions } from "@/lib/domain/match-workflow";
import { isNextRedirectError } from "@/lib/next-redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  scheduledAt: z.string().min(1, "La fecha es obligatoria."),
  modality: z.enum(["5v5", "6v6", "7v7"]),
  location: z.string().optional(),
  playerIds: z.array(z.string().uuid())
});

type GuestDraftInput = {
  name: string;
  rating: number;
};

function withError(error: string) {
  return `/admin/matches/new?error=${encodeURIComponent(error)}`;
}

function parseGuestsFromForm(formData: FormData): GuestDraftInput[] {
  const names = formData.getAll("guestNames").map((value) => String(value ?? "").trim());
  const ratings = formData.getAll("guestRatings").map((value) => String(value ?? "").trim());
  const max = Math.max(names.length, ratings.length);
  const guests: GuestDraftInput[] = [];

  for (let index = 0; index < max; index += 1) {
    const name = names[index] ?? "";
    const ratingRaw = ratings[index] ?? "";
    const hasName = name.length > 0;
    const hasRating = ratingRaw.length > 0;

    if (!hasName && !hasRating) continue;
    if (!hasName || !hasRating) {
      throw new Error(`Completa nombre y rank equivalente para el invitado ${index + 1}.`);
    }

    const numericRating = Number(ratingRaw);
    if (!Number.isFinite(numericRating) || numericRating <= 0) {
      throw new Error(`El rank equivalente del invitado ${index + 1} debe ser un numero positivo.`);
    }

    guests.push({
      name,
      rating: Number(numericRating.toFixed(2))
    });
  }

  return guests;
}

export async function createMatchAction(formData: FormData) {
  try {
    const admin = await assertAdminAction();
    const parsed = schema.safeParse({
      scheduledAt: formData.get("scheduledAt"),
      modality: formData.get("modality"),
      location: formData.get("location"),
      playerIds: formData.getAll("playerIds")
    });
    if (!parsed.success) {
      redirect(withError(parsed.error.issues[0]?.message ?? "Datos invalidos."));
    }

    const invitedGuests = parseGuestsFromForm(formData);
    const expected = TEAM_SIZE_BY_MODALITY[parsed.data.modality] * 2;
    const totalParticipants = parsed.data.playerIds.length + invitedGuests.length;
    if (totalParticipants !== expected) {
      redirect(
        withError(
          `Para ${parsed.data.modality} debes convocar exactamente ${expected} jugadores en total. Actualmente hay ${totalParticipants}.`
        )
      );
    }

    const supabase = await createSupabaseServerClient();
    const matchId = await createDraftMatchWithOptions({
      supabase,
      adminId: admin.userId,
      scheduledAt: new Date(parsed.data.scheduledAt).toISOString(),
      modality: parsed.data.modality,
      location: parsed.data.location ?? "",
      selectedPlayerIds: parsed.data.playerIds,
      invitedGuests
    });

    revalidatePath("/admin");
    revalidatePath("/admin/matches/new");
    revalidatePath(`/admin/matches/${matchId}`);
    redirect(`/admin/matches/${matchId}`);
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : "No se pudo crear el partido.";
    redirect(withError(message));
  }
}
