"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assertOrganizationAdminAction, getOrganizationQueryKeyById } from "@/lib/auth/admin";
import { TEAM_SIZE_BY_MODALITY } from "@/lib/constants";
import { createDraftMatchWithOptions } from "@/lib/domain/match-workflow";
import { datetimeLocalToMatchIso } from "@/lib/match-datetime";
import { isNextRedirectError } from "@/lib/next-redirect";
import { logError, logInfo } from "@/lib/observability/log";
import { withOrgQuery } from "@/lib/org";
import { refreshOrganizationPublicSnapshotSafe } from "@/lib/queries/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  organizationId: z.string().uuid(),
  scheduledAt: z.string().min(1, "La fecha es obligatoria."),
  modality: z.enum(["5v5", "6v6", "7v7", "9v9", "11v11"]),
  location: z.string().optional(),
  playerIds: z.array(z.string().uuid())
});

type GuestDraftInput = {
  key: string;
  name: string;
  rating: number;
};

type ManualTeamAssignment = {
  participantId: string;
  team: "A" | "B";
};

const manualAssignmentsSchema = z.array(
  z.object({
    participantId: z.string().min(1),
    team: z.enum(["A", "B"])
  })
);

function withError(organizationId: string, error: string) {
  const basePath = withOrgQuery("/admin/matches/new", organizationId);
  const separator = basePath.includes("?") ? "&" : "?";
  return `${basePath}${separator}error=${encodeURIComponent(error)}`;
}

function parseGuestsFromForm(formData: FormData): GuestDraftInput[] {
  const keys = formData.getAll("guestKeys").map((value) => String(value ?? "").trim());
  const names = formData.getAll("guestNames").map((value) => String(value ?? "").trim());
  const ratings = formData.getAll("guestRatings").map((value) => String(value ?? "").trim());
  const max = Math.max(keys.length, names.length, ratings.length);
  const guests: GuestDraftInput[] = [];
  const usedKeys = new Set<string>();

  for (let index = 0; index < max; index += 1) {
    const keyRaw = keys[index] ?? "";
    const name = names[index] ?? "";
    const ratingRaw = ratings[index] ?? "";
    const hasName = name.length > 0;
    const hasRating = ratingRaw.length > 0;

    if (!hasName && !hasRating) continue;
    if (!hasName || !hasRating) {
      throw new Error(`Completa nombre y nivel equivalente para el invitado ${index + 1}.`);
    }

    const numericRating = Number(ratingRaw);
    if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
      throw new Error(`El nivel equivalente del invitado ${index + 1} debe estar entre 1 y 5.`);
    }

    const key = keyRaw.length ? keyRaw : `guest-${index + 1}`;
    if (usedKeys.has(key)) {
      throw new Error("Hay invitados duplicados en el formulario. Recarga e intenta nuevamente.");
    }
    usedKeys.add(key);

    guests.push({
      key,
      name,
      rating: Math.trunc(numericRating)
    });
  }

  return guests;
}

function parseGoalkeeperSelection(formData: FormData) {
  const goalkeeperPlayerIds = formData
    .getAll("goalkeeperPlayerIds")
    .map((value) => String(value ?? "").trim())
    .filter((value) => value.length > 0);
  const uniqueGoalkeepers = [...new Set(goalkeeperPlayerIds)];

  if (goalkeeperPlayerIds.length !== uniqueGoalkeepers.length) {
    throw new Error("Hay arqueros duplicados en el formulario.");
  }
  if (uniqueGoalkeepers.length !== 0 && uniqueGoalkeepers.length !== 2) {
    throw new Error("Si seleccionas arqueros, debes elegir exactamente 2.");
  }

  return uniqueGoalkeepers;
}

function parseCreationMode(formData: FormData): "auto" | "manual" {
  const rawValue = String(formData.get("creationMode") ?? "auto");
  return rawValue === "manual" ? "manual" : "auto";
}

function parseManualAssignments(formData: FormData): ManualTeamAssignment[] {
  const rawPayload = String(formData.get("manualAssignmentsPayload") ?? "").trim();
  if (!rawPayload) {
    throw new Error("Falta el armado manual de equipos.");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawPayload);
  } catch {
    throw new Error("El armado manual de equipos es invalido.");
  }

  const parsed = manualAssignmentsSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "El armado manual de equipos es invalido.");
  }

  return parsed.data;
}

export async function createMatchAction(formData: FormData) {
  const startedAt = Date.now();
  try {
    const parsed = schema.safeParse({
      organizationId: formData.get("organizationId"),
      scheduledAt: formData.get("scheduledAt"),
      modality: formData.get("modality"),
      location: formData.get("location"),
      playerIds: formData.getAll("playerIds")
    });
    if (!parsed.success) {
      redirect(
        withError(
          String(formData.get("organizationId") ?? ""),
          parsed.error.issues[0]?.message ?? "Datos invalidos."
        )
      );
    }

    const admin = await assertOrganizationAdminAction(parsed.data.organizationId);
    const organizationQueryKey = await getOrganizationQueryKeyById(parsed.data.organizationId);
    const invitedGuests = parseGuestsFromForm(formData);
    const creationMode = parseCreationMode(formData);
    const goalkeeperPlayerIds = parseGoalkeeperSelection(formData);

    for (const goalkeeperId of goalkeeperPlayerIds) {
      if (!parsed.data.playerIds.includes(goalkeeperId)) {
        throw new Error("Los arqueros seleccionados deben estar marcados dentro de los jugadores convocados.");
      }
    }

    const expected = TEAM_SIZE_BY_MODALITY[parsed.data.modality] * 2;
    const totalParticipants = parsed.data.playerIds.length + invitedGuests.length;
    if (totalParticipants !== expected) {
      redirect(
        withError(
          organizationQueryKey,
          `Para ${parsed.data.modality} debes convocar exactamente ${expected} jugadores en total. Actualmente hay ${totalParticipants}.`
        )
      );
    }

    let manualTeamAssignments: ManualTeamAssignment[] | undefined;
    if (creationMode === "manual") {
      const parsedAssignments = parseManualAssignments(formData);
      const expectedParticipantIds = new Set<string>([
        ...parsed.data.playerIds.map((playerId) => `player:${playerId}`),
        ...invitedGuests.map((guest) => `guest:${guest.key}`)
      ]);
      const usedParticipantIds = new Set<string>();
      let teamACount = 0;
      let teamBCount = 0;

      for (const assignment of parsedAssignments) {
        if (!expectedParticipantIds.has(assignment.participantId)) {
          throw new Error("El armado manual incluye participantes que no estan convocados.");
        }
        if (usedParticipantIds.has(assignment.participantId)) {
          throw new Error("Hay participantes duplicados en el armado manual.");
        }
        usedParticipantIds.add(assignment.participantId);
        if (assignment.team === "A") teamACount += 1;
        if (assignment.team === "B") teamBCount += 1;
      }

      if (usedParticipantIds.size !== expectedParticipantIds.size) {
        throw new Error("El armado manual debe incluir a todos los convocados exactamente una vez.");
      }

      const expectedTeamSize = TEAM_SIZE_BY_MODALITY[parsed.data.modality];
      if (teamACount !== expectedTeamSize || teamBCount !== expectedTeamSize) {
        throw new Error(`Los equipos manuales deben quedar en ${expectedTeamSize} vs ${expectedTeamSize}.`);
      }

      if (goalkeeperPlayerIds.length === 2) {
        const firstGoalkeeperTeam = parsedAssignments.find(
          (assignment) => assignment.participantId === `player:${goalkeeperPlayerIds[0]}`
        )?.team;
        const secondGoalkeeperTeam = parsedAssignments.find(
          (assignment) => assignment.participantId === `player:${goalkeeperPlayerIds[1]}`
        )?.team;

        if (!firstGoalkeeperTeam || !secondGoalkeeperTeam || firstGoalkeeperTeam === secondGoalkeeperTeam) {
          throw new Error("Los dos arqueros deben quedar en equipos separados.");
        }
      }

      manualTeamAssignments = parsedAssignments;
    }

    const supabase = await createSupabaseServerClient();
    const matchId = await createDraftMatchWithOptions({
      supabase,
      adminId: admin.userId,
      organizationId: parsed.data.organizationId,
      scheduledAt: datetimeLocalToMatchIso(parsed.data.scheduledAt),
      modality: parsed.data.modality,
      location: parsed.data.location ?? "",
      selectedPlayerIds: parsed.data.playerIds,
      invitedGuests,
      teamCreationMode: creationMode,
      manualTeamAssignments,
      goalkeeperPlayerIds
    });

    await refreshOrganizationPublicSnapshotSafe(parsed.data.organizationId);
    revalidatePath("/admin");
    revalidatePath("/admin/matches/new");
    revalidatePath(`/admin/matches/${matchId}`);
    logInfo("matches.create.succeeded", {
      organizationId: parsed.data.organizationId,
      matchId,
      adminId: admin.userId,
      modality: parsed.data.modality,
      creationMode,
      playerCount: parsed.data.playerIds.length,
      guestCount: invitedGuests.length,
      durationMs: Date.now() - startedAt
    });
    redirect(withOrgQuery(`/admin/matches/${matchId}`, organizationQueryKey));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    logError("matches.create.failed", error, {
      organizationId: String(formData.get("organizationId") ?? ""),
      durationMs: Date.now() - startedAt
    });
    const message = error instanceof Error ? error.message : "No se pudo crear el partido.";
    const organizationId = String(formData.get("organizationId") ?? "");
    redirect(withError(organizationId, message));
  }
}
