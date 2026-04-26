"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  assertCompetitionWriteAction,
  getCompetitionPublicPathById
} from "@/lib/auth/tournaments";
import { MAX_TOURNAMENT_PLAYERS_PER_TEAM } from "@/lib/constants";
import {
  generateCompetitionCupPlayoff,
  generateCompetitionFixture,
  saveCompetitionMatchSheet,
  validateCompetitionMatchPair
} from "@/lib/domain/tournament-workflow";
import { getPlayerPhotosBucket, getSupabaseDbSchema } from "@/lib/env";
import { toUserMessage } from "@/lib/errors";
import { datetimeLocalToMatchIso } from "@/lib/match-datetime";
import { isNextRedirectError } from "@/lib/next-redirect";
import {
  assertPlayerPhotoUploadAllowed,
  registerPlayerPhotoUploadEvent
} from "@/lib/player-photo-upload-limits";
import {
  getCompetitionPlayerPhotoObjectPath,
  inferPlayerPhotoExtension,
  MAX_PLAYER_PHOTO_SIZE_MB,
  optimizePlayerAvatarImage
} from "@/lib/player-photos";
import { REPLACEABLE_IMAGE_UPLOAD_CACHE_CONTROL } from "@/lib/storage-image-responses";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CompetitionPhase, TournamentMatchSheetInput } from "@/types/domain";

const updateCompetitionSchema = z.object({
  name: z.string().min(3, "La competencia debe tener al menos 3 caracteres.").max(100),
  seasonLabel: z.string().max(40).optional(),
  description: z.string().max(500).optional(),
  venueOverride: z.string().max(120).optional(),
  type: z.enum(["league", "cup", "league_and_cup"]).default("league"),
  coverageMode: z.enum(["full_stats", "results_only"]).default("full_stats"),
  playoffSize: z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? Number(value) : null),
    z.union([z.literal(4), z.literal(8), z.null()])
  ),
  status: z.enum(["draft", "active", "finished", "archived"])
}).superRefine((value, ctx) => {
  if (value.type === "league_and_cup" && value.playoffSize === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["playoffSize"],
      message: "Liga + copa necesita definir un playoff de 4 u 8 equipos."
    });
  }

  if (value.type !== "league_and_cup" && value.playoffSize !== null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["playoffSize"],
      message: "El playoff solo aplica al formato Liga + copa."
    });
  }
});

const captainInviteSchema = z.object({
  competitionTeamId: z.string().uuid(),
  email: z.string().email("Ingresa un email válido.")
});

const captainInviteDeleteSchema = z.object({
  inviteId: z.string().uuid()
});

const competitionTeamSchema = z.object({
  competitionTeamId: z.string().uuid()
});

const playerSchema = z.object({
  competitionTeamId: z.string().uuid(),
  fullName: z.string().min(2, "El jugador debe tener al menos 2 caracteres.").max(80),
  shirtNumber: z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? Number(value) : null),
    z.number().int().positive().max(99).nullable()
  ),
  position: z.string().max(30).optional()
});

const playerUpdateSchema = playerSchema.extend({
  playerId: z.string().uuid()
});

const playerDeleteSchema = z.object({
  competitionTeamId: z.string().uuid(),
  playerId: z.string().uuid()
});

const playerPhotoSchema = z.object({
  competitionTeamId: z.string().uuid(),
  playerId: z.string().uuid()
});

const manualMatchSchema = z.object({
  roundName: z.string().min(2, "La fecha debe tener al menos 2 caracteres.").max(80),
  phase: z.enum(["league", "cup"]).optional(),
  homeTeamId: z.string().uuid(),
  awayTeamId: z.string().uuid(),
  scheduledAt: z.string().optional(),
  venue: z.string().max(120).optional(),
  status: z.enum(["draft", "scheduled", "cancelled"])
});

const updateMatchSchema = z.object({
  matchId: z.string().uuid(),
  roundId: z.string().uuid().nullable(),
  homeTeamId: z.string().uuid(),
  awayTeamId: z.string().uuid(),
  scheduledAt: z.string().optional(),
  venue: z.string().max(120).optional(),
  status: z.enum(["draft", "scheduled", "cancelled"])
});

const matchSheetSchema = z.object({
  mvpEntryKey: z.string().min(1).nullable().optional(),
  stats: z.array(
    z.object({
      entryKey: z.string().min(1),
      teamId: z.string().uuid(),
      playerId: z.string().uuid().nullable().optional(),
      playerName: z.string(),
      goals: z.coerce.number().int().min(0),
      yellowCards: z.coerce.number().int().min(0),
      redCards: z.coerce.number().int().min(0)
    })
  )
});

async function loadCompetitionSummary(competitionId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("competitions")
    .select("id, type, coverage_mode, playoff_size")
    .eq("id", competitionId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "No se encontro la competencia.");
  }

  return {
    id: String(data.id),
    type: String(data.type) as "league" | "cup" | "league_and_cup",
    coverageMode: String(data.coverage_mode ?? "full_stats") as "full_stats" | "results_only",
    playoffSize: data.playoff_size === 4 || data.playoff_size === 8 ? data.playoff_size : null
  };
}

function resolveManualMatchPhase(params: {
  competitionType: "league" | "cup" | "league_and_cup";
  requestedPhase?: CompetitionPhase | undefined;
}): CompetitionPhase {
  if (params.competitionType === "cup") {
    return "cup";
  }

  if (params.competitionType === "league_and_cup") {
    return params.requestedPhase === "cup" ? "cup" : "league";
  }

  return "league";
}

function buildCompetitionDetailPath(params: {
  leagueId: string;
  competitionId: string;
  tab?: string;
  error?: string;
  success?: string;
}) {
  const basePath = `/admin/tournaments/${params.leagueId}/competitions/${params.competitionId}`;
  const searchParams = new URLSearchParams();
  if (params.tab) searchParams.set("tab", params.tab);
  if (params.error) searchParams.set("error", params.error);
  if (params.success) searchParams.set("success", params.success);
  const search = searchParams.toString();
  return search ? `${basePath}?${search}` : basePath;
}

function buildMatchSheetPath(params: {
  leagueId: string;
  competitionId: string;
  matchId: string;
  error?: string;
  success?: string;
}) {
  const basePath = `/admin/tournaments/${params.leagueId}/competitions/${params.competitionId}/matches/${params.matchId}`;
  const searchParams = new URLSearchParams();
  if (params.error) searchParams.set("error", params.error);
  if (params.success) searchParams.set("success", params.success);
  const search = searchParams.toString();
  return search ? `${basePath}?${search}` : basePath;
}

function normalizeScheduledAt(value: string | undefined) {
  if (!value?.trim()) return null;
  return datetimeLocalToMatchIso(value);
}

function buildInviteExpiresAt() {
  return new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
}

async function revalidateCompetitionPaths(leagueId: string, competitionId: string) {
  revalidatePath("/admin/tournaments");
  revalidatePath(`/admin/tournaments/${leagueId}`);
  revalidatePath(`/admin/tournaments/${leagueId}/competitions/${competitionId}`);
  revalidatePath("/tournaments");

  const publicPath = await getCompetitionPublicPathById(competitionId);
  if (publicPath) {
    revalidatePath(`/tournaments/${publicPath.leagueSlug}`);
    revalidatePath(`/tournaments/${publicPath.leagueSlug}/${publicPath.competitionSlug}`);
  }
}

async function assertCompetitionTeamPlayerCapacity(competitionTeamId: string) {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("competition_team_players")
    .select("id", { count: "exact", head: true })
    .eq("competition_team_id", competitionTeamId);

  if (error) {
    throw new Error(error.message);
  }

  if ((count ?? 0) >= MAX_TOURNAMENT_PLAYERS_PER_TEAM) {
    throw new Error(`Cada equipo admite hasta ${MAX_TOURNAMENT_PLAYERS_PER_TEAM} jugadores.`);
  }
}

async function activateCompetitionIfStillDraft(competitionId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: competition, error: competitionError } = await supabase
    .from("competitions")
    .select("status")
    .eq("id", competitionId)
    .maybeSingle();

  if (competitionError || !competition) {
    throw new Error(competitionError?.message ?? "No se encontró la competencia.");
  }

  if (competition.status !== "draft") return;

  const { error: updateError } = await supabase
    .from("competitions")
    .update({ status: "active" })
    .eq("id", competitionId)
    .eq("status", "draft");

  if (updateError) {
    throw new Error(updateError.message);
  }
}

async function validateCompetitionNameAvailability(params: {
  leagueId: string;
  name: string;
  ignoreCompetitionId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("competitions")
    .select("id")
    .eq("league_id", params.leagueId)
    .ilike("name", params.name)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (data && String(data.id) !== params.ignoreCompetitionId) {
    return "Ya existe una competencia con ese nombre dentro de la liga.";
  }

  return null;
}

async function resolveRoundIdByName(params: {
  competitionId: string;
  roundName: string;
  phase: CompetitionPhase;
  stageLabel?: string;
}) {
  const { competitionId, roundName, phase } = params;
  const supabase = await createSupabaseServerClient();
  const normalizedRoundName = roundName.trim().toLowerCase();
  const { data: existingRounds, error: roundsError } = await supabase
    .from("competition_rounds")
    .select("id, round_number, name, phase")
    .eq("competition_id", competitionId)
    .order("round_number", { ascending: true });

  if (roundsError) {
    throw new Error(`No se pudieron leer las fechas de la competencia: ${roundsError.message}`);
  }

  const existingRound = (existingRounds ?? []).find(
    (row) => row.name.trim().toLowerCase() === normalizedRoundName && row.phase === phase
  );
  if (existingRound) return existingRound.id;

  const nextRoundNumber = Math.max(0, ...(existingRounds ?? []).map((row) => Number(row.round_number))) + 1;
  const { data: insertedRound, error: insertError } = await supabase
    .from("competition_rounds")
    .insert({
      competition_id: competitionId,
      round_number: nextRoundNumber,
      name: roundName.trim(),
      phase,
      stage_label: params.stageLabel?.trim() || roundName.trim()
    })
    .select("id")
    .single();

  if (insertError || !insertedRound) {
    throw new Error(`No se pudo crear la fecha de la competencia: ${insertError?.message ?? "sin detalle"}`);
  }

  return insertedRound.id;
}

export async function updateCompetitionAction(
  leagueId: string,
  competitionId: string,
  formData: FormData
) {
  try {
    await assertCompetitionWriteAction(competitionId);
    const parsed = updateCompetitionSchema.safeParse({
      name: formData.get("name"),
      seasonLabel: formData.get("seasonLabel"),
      description: formData.get("description"),
      venueOverride: formData.get("venueOverride"),
      type: formData.get("type"),
      coverageMode: formData.get("coverageMode"),
      playoffSize: formData.get("playoffSize"),
      status: formData.get("status")
    });

    if (!parsed.success) {
      redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "summary", error: parsed.error.issues[0]?.message ?? "Datos inválidos." }));
    }

    const normalizedName = parsed.data.name.trim();
    const duplicateNameMessage = await validateCompetitionNameAvailability({
      leagueId,
      name: normalizedName,
      ignoreCompetitionId: competitionId
    });
    if (duplicateNameMessage) {
      redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "summary", error: duplicateNameMessage }));
    }

    const supabase = await createSupabaseServerClient();
    const currentCompetition = await loadCompetitionSummary(competitionId);
    const [{ count: existingMatchCount, error: matchCountError }, { count: existingByeCount, error: byeCountError }] =
      await Promise.all([
        supabase
          .from("competition_matches")
          .select("id", { count: "exact", head: true })
          .eq("competition_id", competitionId),
        supabase
          .from("competition_byes")
          .select("id", { count: "exact", head: true })
          .eq("competition_id", competitionId)
      ]);

    if (matchCountError || byeCountError) {
      redirect(
        buildCompetitionDetailPath({
          leagueId,
          competitionId,
          tab: "summary",
          error: "No se pudo validar el fixture actual."
        })
      );
    }

    const hasFixture = (existingMatchCount ?? 0) > 0 || (existingByeCount ?? 0) > 0;
    if (
      hasFixture &&
      (parsed.data.type !== currentCompetition.type ||
        (parsed.data.type === "league_and_cup"
          ? parsed.data.playoffSize !== currentCompetition.playoffSize
          : currentCompetition.playoffSize !== null))
    ) {
      redirect(
        buildCompetitionDetailPath({
          leagueId,
          competitionId,
          tab: "summary",
          error: "No puedes cambiar el formato despues de generar el fixture."
        })
      );
    }

    const { error } = await supabase
      .from("competitions")
      .update({
        name: normalizedName,
        season_label: parsed.data.seasonLabel?.trim() || String(new Date().getFullYear()),
        description: parsed.data.description?.trim() || null,
        venue_override: parsed.data.venueOverride?.trim() || null,
        type: parsed.data.type,
        coverage_mode: parsed.data.coverageMode,
        playoff_size: parsed.data.type === "league_and_cup" ? parsed.data.playoffSize : null,
        is_public: true,
        status: parsed.data.status
      })
      .eq("id", competitionId)
      .eq("league_id", leagueId);

    if (error) {
      redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "summary", error: toUserMessage(error, "No se pudo actualizar la competencia.") }));
    }

    await revalidateCompetitionPaths(leagueId, competitionId);
    redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "summary", success: "Resumen actualizado." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "summary", error: toUserMessage(error, "No se pudo actualizar la competencia.") }));
  }
}

export async function syncCompetitionTeamsAction(
  leagueId: string,
  competitionId: string,
  formData: FormData
) {
  try {
    await assertCompetitionWriteAction(competitionId);
    const selectedLeagueTeamIds = new Set(
      formData
        .getAll("leagueTeamIds")
        .map((value) => String(value))
        .filter(Boolean)
    );

    const supabase = await createSupabaseServerClient();
    const [{ data: leagueTeams, error: leagueTeamsError }, { data: existingTeams, error: existingTeamsError }] =
      await Promise.all([
        supabase
          .from("league_teams")
          .select("id, name, short_name, logo_path, notes")
          .eq("league_id", leagueId),
        supabase
          .from("competition_teams")
          .select("id, league_team_id, display_order")
          .eq("competition_id", competitionId)
      ]);

    if (leagueTeamsError) {
      redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "teams", error: toUserMessage(leagueTeamsError, "No se pudieron cargar los equipos de la liga.") }));
    }
    if (existingTeamsError) {
      redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "teams", error: toUserMessage(existingTeamsError, "No se pudieron cargar los equipos inscriptos.") }));
    }

    const existingByLeagueTeamId = new Map(
      (existingTeams ?? []).map((team) => [String(team.league_team_id), team])
    );

    const newTeams = (leagueTeams ?? [])
      .filter((team) => selectedLeagueTeamIds.has(String(team.id)) && !existingByLeagueTeamId.has(String(team.id)))
      .sort((left, right) => String(left.name).localeCompare(String(right.name), "es"));

    const nextDisplayOrder = Math.max(0, ...((existingTeams ?? []).map((team) => Number(team.display_order)))) + 1;
    if (newTeams.length) {
      const { error: insertError } = await supabase.from("competition_teams").insert(
        newTeams.map((team, index) => ({
          competition_id: competitionId,
          league_team_id: team.id,
          display_name: team.name,
          short_name: team.short_name ?? null,
          logo_path: team.logo_path ?? null,
          display_order: nextDisplayOrder + index,
          notes: team.notes ?? null
        }))
      );

      if (insertError) {
        redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "teams", error: toUserMessage(insertError, "No se pudieron inscribir los equipos nuevos.") }));
      }
    }

    const teamsToRemove = (existingTeams ?? []).filter(
      (team) => !selectedLeagueTeamIds.has(String(team.league_team_id))
    );

    for (const team of teamsToRemove) {
      const { error: deleteError } = await supabase
        .from("competition_teams")
        .delete()
        .eq("id", team.id)
        .eq("competition_id", competitionId);

      if (deleteError) {
        const userMessage =
          deleteError.code === "23503"
            ? "No se puede quitar un inscripto que ya tiene plantel, capitán, partidos o estadísticas asociadas."
            : toUserMessage(deleteError, "No se pudo actualizar la lista de inscriptos.");
        redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "teams", error: userMessage }));
      }
    }

    await revalidateCompetitionPaths(leagueId, competitionId);
    redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "teams", success: "Equipos inscriptos actualizados." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "teams", error: toUserMessage(error, "No se pudo actualizar la lista de inscriptos.") }));
  }
}

export async function inviteCompetitionCaptainAction(
  leagueId: string,
  competitionId: string,
  formData: FormData
) {
  try {
    await assertCompetitionWriteAction(competitionId);
    const parsed = captainInviteSchema.safeParse({
      competitionTeamId: formData.get("competitionTeamId"),
      email: formData.get("email")
    });

    if (!parsed.success) {
      redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "teams", error: parsed.error.issues[0]?.message ?? "Datos inválidos." }));
    }

    const normalizedEmail = parsed.data.email.trim().toLowerCase();
    const supabase = await createSupabaseServerClient();
    const [{ data: team, error: teamError }, { data: currentCaptain, error: captainError }] = await Promise.all([
      supabase
        .from("competition_teams")
        .select("id")
        .eq("id", parsed.data.competitionTeamId)
        .eq("competition_id", competitionId)
        .maybeSingle(),
      supabase
        .from("competition_team_captains")
        .select("id")
        .eq("competition_id", competitionId)
        .eq("competition_team_id", parsed.data.competitionTeamId)
        .maybeSingle()
    ]);

    if (teamError || !team) {
      redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "teams", error: "No se encontró el equipo inscripto dentro de esta competencia." }));
    }

    if (captainError) {
      redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "teams", error: toUserMessage(captainError, "No se pudo preparar la invitación del capitán.") }));
    }

    if (currentCaptain) {
      redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "teams", error: "Este equipo ya tiene un capitán asignado. Quítalo antes de invitar a otro." }));
    }

    const { error } = await supabase.from("competition_captain_invites").upsert(
      {
        competition_id: competitionId,
        competition_team_id: parsed.data.competitionTeamId,
        email: normalizedEmail,
        invite_token: crypto.randomUUID(),
        expires_at: buildInviteExpiresAt()
      },
      {
        onConflict: "competition_team_id"
      }
    );

    if (error) {
      redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "teams", error: toUserMessage(error, "No se pudo preparar la invitación del capitán.") }));
    }

    await revalidateCompetitionPaths(leagueId, competitionId);
    revalidatePath("/captain");
    redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "teams", success: "Invitación de capitán preparada." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "teams", error: toUserMessage(error, "No se pudo preparar la invitación del capitán.") }));
  }
}

export async function deleteCompetitionCaptainInviteAction(
  leagueId: string,
  competitionId: string,
  formData: FormData
) {
  try {
    await assertCompetitionWriteAction(competitionId);
    const parsed = captainInviteDeleteSchema.safeParse({
      inviteId: formData.get("inviteId")
    });

    if (!parsed.success) {
      redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "teams", error: parsed.error.issues[0]?.message ?? "Falta la invitación a revocar." }));
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("competition_captain_invites")
      .delete()
      .eq("id", parsed.data.inviteId)
      .eq("competition_id", competitionId);

    if (error) {
      redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "teams", error: toUserMessage(error, "No se pudo revocar la invitación.") }));
    }

    await revalidateCompetitionPaths(leagueId, competitionId);
    redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "teams", success: "Invitación revocada." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "teams", error: toUserMessage(error, "No se pudo revocar la invitación.") }));
  }
}

export async function removeCompetitionCaptainAction(
  leagueId: string,
  competitionId: string,
  formData: FormData
) {
  try {
    await assertCompetitionWriteAction(competitionId);
    const parsed = competitionTeamSchema.safeParse({
      competitionTeamId: formData.get("competitionTeamId")
    });

    if (!parsed.success) {
      redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "teams", error: parsed.error.issues[0]?.message ?? "Falta el capitán a quitar." }));
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("competition_team_captains")
      .delete()
      .eq("competition_id", competitionId)
      .eq("competition_team_id", parsed.data.competitionTeamId);

    if (error) {
      redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "teams", error: toUserMessage(error, "No se pudo quitar al capitán.") }));
    }

    await revalidateCompetitionPaths(leagueId, competitionId);
    revalidatePath("/captain");
    redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "teams", success: "Capitán removido." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "teams", error: toUserMessage(error, "No se pudo quitar al capitán.") }));
  }
}

export async function addCompetitionPlayerAction(
  leagueId: string,
  competitionId: string,
  formData: FormData
) {
  try {
    await assertCompetitionWriteAction(competitionId);
    const parsed = playerSchema.safeParse({
      competitionTeamId: formData.get("competitionTeamId"),
      fullName: formData.get("fullName"),
      shirtNumber: formData.get("shirtNumber"),
      position: formData.get("position")
    });

    if (!parsed.success) {
      redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "rosters", error: parsed.error.issues[0]?.message ?? "Datos inválidos." }));
    }

    await assertCompetitionTeamPlayerCapacity(parsed.data.competitionTeamId);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("competition_team_players").insert({
      competition_team_id: parsed.data.competitionTeamId,
      full_name: parsed.data.fullName.trim(),
      shirt_number: parsed.data.shirtNumber,
      position: parsed.data.position?.trim() || null,
      active: true
    });

    if (error) {
      redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "rosters", error: toUserMessage(error, "No se pudo agregar el jugador.") }));
    }

    await revalidateCompetitionPaths(leagueId, competitionId);
    redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "rosters", success: "Jugador agregado." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "rosters", error: toUserMessage(error, "No se pudo agregar el jugador.") }));
  }
}

export async function updateCompetitionPlayerAction(
  leagueId: string,
  competitionId: string,
  formData: FormData
) {
  try {
    await assertCompetitionWriteAction(competitionId);
    const parsed = playerUpdateSchema.safeParse({
      competitionTeamId: formData.get("competitionTeamId"),
      playerId: formData.get("playerId"),
      fullName: formData.get("fullName"),
      shirtNumber: formData.get("shirtNumber"),
      position: formData.get("position")
    });

    if (!parsed.success) {
      redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "rosters", error: parsed.error.issues[0]?.message ?? "Datos inválidos." }));
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("competition_team_players")
      .update({
        full_name: parsed.data.fullName.trim(),
        shirt_number: parsed.data.shirtNumber,
        position: parsed.data.position?.trim() || null
      })
      .eq("id", parsed.data.playerId)
      .eq("competition_team_id", parsed.data.competitionTeamId);

    if (error) {
      redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "rosters", error: toUserMessage(error, "No se pudo actualizar el jugador.") }));
    }

    await revalidateCompetitionPaths(leagueId, competitionId);
    redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "rosters", success: "Jugador actualizado." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "rosters", error: toUserMessage(error, "No se pudo actualizar el jugador.") }));
  }
}

export async function deleteCompetitionPlayerAction(
  leagueId: string,
  competitionId: string,
  formData: FormData
) {
  try {
    await assertCompetitionWriteAction(competitionId);
    const parsed = playerDeleteSchema.safeParse({
      competitionTeamId: formData.get("competitionTeamId"),
      playerId: formData.get("playerId")
    });

    if (!parsed.success) {
      redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "rosters", error: parsed.error.issues[0]?.message ?? "Falta el jugador a borrar." }));
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("competition_team_players")
      .delete()
      .eq("id", parsed.data.playerId)
      .eq("competition_team_id", parsed.data.competitionTeamId);

    if (error) {
      redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "rosters", error: toUserMessage(error, "No se pudo borrar el jugador.") }));
    }

    await revalidateCompetitionPaths(leagueId, competitionId);
    redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "rosters", success: "Jugador eliminado." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "rosters", error: toUserMessage(error, "No se pudo borrar el jugador.") }));
  }
}

export async function uploadCompetitionPlayerPhotoAction(
  leagueId: string,
  competitionId: string,
  formData: FormData
) {
  try {
    const { admin } = await assertCompetitionWriteAction(competitionId);
    const parsed = playerPhotoSchema.safeParse({
      competitionTeamId: formData.get("competitionTeamId"),
      playerId: formData.get("playerId")
    });

    if (!parsed.success) {
      redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "rosters", error: parsed.error.issues[0]?.message ?? "Datos inválidos." }));
    }

    const file = formData.get("photo");
    if (!(file instanceof File) || file.size <= 0) {
      redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "rosters", error: "Selecciona una imagen para subir." }));
    }

    const sizeLimitBytes = MAX_PLAYER_PHOTO_SIZE_MB * 1024 * 1024;
    if (file.size > sizeLimitBytes) {
      redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "rosters", error: `La imagen no puede superar ${MAX_PLAYER_PHOTO_SIZE_MB} MB.` }));
    }

    const extension = inferPlayerPhotoExtension(file);
    if (!extension) {
      redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "rosters", error: "Formato no soportado. Usa JPG, JPEG, PNG o WEBP." }));
    }

    const supabase = await createSupabaseServerClient();
    const { data: player, error: playerError } = await supabase
      .from("competition_team_players")
      .select("id")
      .eq("id", parsed.data.playerId)
      .eq("competition_team_id", parsed.data.competitionTeamId)
      .maybeSingle();

    if (playerError || !player) {
      redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "rosters", error: "No se encontró el jugador en la competencia seleccionada." }));
    }

    await assertPlayerPhotoUploadAllowed({
      supabase: supabase as never,
      uploaderId: admin.userId,
      uploaderRole: "league_admin",
      targetPlayerId: parsed.data.playerId,
      targetType: "competition_player"
    });

    const optimizedBuffer = await optimizePlayerAvatarImage(file);
    const objectPath = getCompetitionPlayerPhotoObjectPath(
      getSupabaseDbSchema(),
      competitionId,
      parsed.data.playerId
    );
    const bucketName = getPlayerPhotosBucket();
    const { error: uploadError } = await supabase.storage.from(bucketName).upload(objectPath, optimizedBuffer, {
      upsert: true,
      contentType: "image/webp",
      cacheControl: REPLACEABLE_IMAGE_UPLOAD_CACHE_CONTROL
    });

    if (uploadError) {
      redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "rosters", error: "No se pudo guardar la foto del jugador." }));
    }

    await registerPlayerPhotoUploadEvent({
      supabase: supabase as never,
      uploaderId: admin.userId,
      uploaderRole: "league_admin",
      targetPlayerId: parsed.data.playerId,
      targetType: "competition_player"
    });

    await revalidateCompetitionPaths(leagueId, competitionId);
    revalidatePath(`/api/player-photo/${parsed.data.playerId}`);
    redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "rosters", success: "Foto actualizada." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "rosters", error: toUserMessage(error, "No se pudo subir la foto.") }));
  }
}

export async function generateCompetitionFixtureAction(leagueId: string, competitionId: string) {
  try {
    const { admin } = await assertCompetitionWriteAction(competitionId);
    const supabase = await createSupabaseServerClient();
    await generateCompetitionFixture({
      supabase: supabase as never,
      adminId: admin.userId,
      competitionId
    });
    await activateCompetitionIfStillDraft(competitionId);

    await revalidateCompetitionPaths(leagueId, competitionId);
    redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "fixture", success: "Fixture generado." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "fixture", error: toUserMessage(error, "No se pudo generar el fixture.") }));
  }
}

export async function generateCompetitionPlayoffAction(leagueId: string, competitionId: string) {
  try {
    const { admin } = await assertCompetitionWriteAction(competitionId);
    const supabase = await createSupabaseServerClient();
    await generateCompetitionCupPlayoff({
      supabase: supabase as never,
      adminId: admin.userId,
      competitionId
    });

    await revalidateCompetitionPaths(leagueId, competitionId);
    redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "fixture", success: "Copa generada." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "fixture", error: toUserMessage(error, "No se pudo generar la copa.") }));
  }
}

export async function createManualCompetitionMatchAction(
  leagueId: string,
  competitionId: string,
  formData: FormData
) {
  try {
    const { admin } = await assertCompetitionWriteAction(competitionId);
    const competition = await loadCompetitionSummary(competitionId);
    const parsed = manualMatchSchema.safeParse({
      roundName: formData.get("roundName"),
      phase: formData.get("phase") || undefined,
      homeTeamId: formData.get("homeTeamId"),
      awayTeamId: formData.get("awayTeamId"),
      scheduledAt: formData.get("scheduledAt"),
      venue: formData.get("venue"),
      status: formData.get("status")
    });

    if (!parsed.success) {
      redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "fixture", error: parsed.error.issues[0]?.message ?? "Datos inválidos." }));
    }

    const supabase = await createSupabaseServerClient();
    const phase = resolveManualMatchPhase({
      competitionType: competition.type,
      requestedPhase: parsed.data.phase
    });
    await validateCompetitionMatchPair({
      supabase: supabase as never,
      competitionId,
      homeTeamId: parsed.data.homeTeamId,
      awayTeamId: parsed.data.awayTeamId,
      phase
    });
    const roundId = await resolveRoundIdByName({
      competitionId,
      roundName: parsed.data.roundName,
      phase,
      stageLabel: parsed.data.roundName
    });

    const { error } = await supabase.from("competition_matches").insert({
      competition_id: competitionId,
      round_id: roundId,
      home_team_id: parsed.data.homeTeamId,
      away_team_id: parsed.data.awayTeamId,
      phase,
      stage_label: parsed.data.roundName.trim(),
      scheduled_at: normalizeScheduledAt(parsed.data.scheduledAt),
      venue: parsed.data.venue?.trim() || null,
      status: parsed.data.status,
      created_by: admin.userId
    });

    if (error) {
      redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "fixture", error: toUserMessage(error, "No se pudo crear el partido manual.") }));
    }

    await activateCompetitionIfStillDraft(competitionId);
    await revalidateCompetitionPaths(leagueId, competitionId);
    redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "fixture", success: "Partido creado." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "fixture", error: toUserMessage(error, "No se pudo crear el partido manual.") }));
  }
}

export async function updateCompetitionMatchAction(
  leagueId: string,
  competitionId: string,
  formData: FormData
) {
  try {
    await assertCompetitionWriteAction(competitionId);
    const parsed = updateMatchSchema.safeParse({
      matchId: formData.get("matchId"),
      roundId: formData.get("roundId") ? String(formData.get("roundId")) : null,
      homeTeamId: formData.get("homeTeamId"),
      awayTeamId: formData.get("awayTeamId"),
      scheduledAt: formData.get("scheduledAt"),
      venue: formData.get("venue"),
      status: formData.get("status")
    });

    if (!parsed.success) {
      redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "fixture", error: parsed.error.issues[0]?.message ?? "Datos inválidos." }));
    }

    const supabase = await createSupabaseServerClient();
    const { data: currentMatch, error: matchError } = await supabase
      .from("competition_matches")
      .select("id, home_team_id, away_team_id, round_id, phase, status")
      .eq("id", parsed.data.matchId)
      .eq("competition_id", competitionId)
      .maybeSingle();

    if (matchError || !currentMatch) {
      redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "fixture", error: "No se encontró el partido." }));
    }
    if (currentMatch.status === "played") {
      redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "fixture", error: "Los partidos jugados solo se editan desde el acta." }));
    }

    await validateCompetitionMatchPair({
      supabase: supabase as never,
      competitionId,
      homeTeamId: parsed.data.homeTeamId,
      awayTeamId: parsed.data.awayTeamId,
      phase: (currentMatch.phase as CompetitionPhase) ?? "league",
      ignoreMatchId: parsed.data.matchId
    });

    if (parsed.data.roundId) {
      const { data: round, error: roundError } = await supabase
        .from("competition_rounds")
        .select("id")
        .eq("id", parsed.data.roundId)
        .eq("competition_id", competitionId)
        .maybeSingle();

      if (roundError || !round) {
        redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "fixture", error: "La fecha elegida no existe." }));
      }
    }

    const { error } = await supabase
      .from("competition_matches")
      .update({
        round_id: parsed.data.roundId,
        home_team_id: parsed.data.homeTeamId,
        away_team_id: parsed.data.awayTeamId,
        scheduled_at: normalizeScheduledAt(parsed.data.scheduledAt),
        venue: parsed.data.venue?.trim() || null,
        status: parsed.data.status
      })
      .eq("id", parsed.data.matchId)
      .eq("competition_id", competitionId);

    if (error) {
      redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "fixture", error: toUserMessage(error, "No se pudo actualizar el partido.") }));
    }

    await revalidateCompetitionPaths(leagueId, competitionId);
    redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "fixture", success: "Partido actualizado." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildCompetitionDetailPath({ leagueId, competitionId, tab: "fixture", error: toUserMessage(error, "No se pudo actualizar el partido.") }));
  }
}

export async function saveCompetitionMatchSheetAction(
  leagueId: string,
  competitionId: string,
  matchId: string,
  formData: FormData
) {
  try {
    const { admin } = await assertCompetitionWriteAction(competitionId);
    const payloadRaw = String(formData.get("sheetPayload") ?? "");
    if (!payloadRaw) {
      redirect(buildMatchSheetPath({ leagueId, competitionId, matchId, error: "Falta el payload del acta." }));
    }

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(payloadRaw);
    } catch {
      redirect(buildMatchSheetPath({ leagueId, competitionId, matchId, error: "El acta enviada es inválida." }));
    }

    const normalizedPayload = matchSheetSchema.safeParse(parsedPayload);
    if (!normalizedPayload.success) {
      redirect(buildMatchSheetPath({
        leagueId,
        competitionId,
        matchId,
        error: normalizedPayload.error.issues[0]?.message ?? "El acta enviada es inválida."
      }));
    }

    const homeScore = Number(formData.get("homeScore"));
    const awayScore = Number(formData.get("awayScore"));
    const penaltyHomeScoreRaw = formData.get("penaltyHomeScore");
    const penaltyAwayScoreRaw = formData.get("penaltyAwayScore");
    const notesValue = String(formData.get("notes") ?? "");
    const penaltyHomeScore =
      typeof penaltyHomeScoreRaw === "string" && penaltyHomeScoreRaw.trim()
        ? Number(penaltyHomeScoreRaw)
        : null;
    const penaltyAwayScore =
      typeof penaltyAwayScoreRaw === "string" && penaltyAwayScoreRaw.trim()
        ? Number(penaltyAwayScoreRaw)
        : null;
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
      redirect(buildMatchSheetPath({ leagueId, competitionId, matchId, error: "El marcador enviado es inválido." }));
    }

    if (
      (penaltyHomeScore !== null && !Number.isFinite(penaltyHomeScore)) ||
      (penaltyAwayScore !== null && !Number.isFinite(penaltyAwayScore))
    ) {
      redirect(buildMatchSheetPath({ leagueId, competitionId, matchId, error: "La tanda de penales enviada es invÃ¡lida." }));
    }

    const input: TournamentMatchSheetInput = {
      homeScore,
      awayScore,
      penaltyHomeScore,
      penaltyAwayScore,
      notes: notesValue,
      mvpEntryKey: normalizedPayload.data.mvpEntryKey ?? null,
      stats: normalizedPayload.data.stats
    };

    const supabase = await createSupabaseServerClient();
    await saveCompetitionMatchSheet({
      supabase: supabase as never,
      adminId: admin.userId,
      competitionId,
      matchId,
      input
    });

    await revalidateCompetitionPaths(leagueId, competitionId);
    revalidatePath(`/admin/tournaments/${leagueId}/competitions/${competitionId}/matches/${matchId}`);

    const publicPath = await getCompetitionPublicPathById(competitionId);
    if (publicPath) {
      revalidatePath(`/tournaments/${publicPath.leagueSlug}/${publicPath.competitionSlug}/matches/${matchId}`);
    }

    redirect(buildMatchSheetPath({ leagueId, competitionId, matchId, success: "Acta guardada correctamente." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildMatchSheetPath({ leagueId, competitionId, matchId, error: toUserMessage(error, "No se pudo guardar el acta.") }));
  }
}
