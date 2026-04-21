"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assertTournamentMembershipAction, getTournamentSlugById } from "@/lib/auth/tournaments";
import { generateTournamentFixture, validateTournamentMatchPair } from "@/lib/domain/tournament-workflow";
import { toUserMessage } from "@/lib/errors";
import { isNextRedirectError } from "@/lib/next-redirect";
import { slugifyTournamentName } from "@/lib/org";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const updateTournamentSchema = z.object({
  name: z.string().min(3, "El nombre del torneo debe tener al menos 3 caracteres.").max(100),
  seasonLabel: z.string().min(2, "La temporada debe tener al menos 2 caracteres.").max(50),
  description: z.string().max(600).optional(),
  isPublic: z.boolean().default(false),
  status: z.enum(["draft", "active", "finished", "archived"])
});

const teamSchema = z.object({
  name: z.string().min(2, "El equipo debe tener al menos 2 caracteres.").max(80),
  shortName: z.string().max(20).optional(),
  notes: z.string().max(300).optional(),
  displayOrder: z.coerce.number().int().positive("El orden debe ser positivo.")
});

const playerSchema = z.object({
  teamId: z.string().uuid(),
  fullName: z.string().min(2, "El jugador debe tener al menos 2 caracteres.").max(80),
  shirtNumber: z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? Number(value) : null),
    z.number().int().positive().max(99).nullable()
  ),
  position: z.string().max(30).optional()
});

const manualMatchSchema = z.object({
  roundName: z.string().min(2, "La fecha debe tener al menos 2 caracteres.").max(80),
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

function buildTournamentDetailPath(params: {
  tournamentId: string;
  tab?: string;
  error?: string;
  success?: string;
}) {
  const { tournamentId, tab, error, success } = params;
  const basePath = `/admin/tournaments/${tournamentId}`;
  const searchParams = new URLSearchParams();
  if (tab) searchParams.set("tab", tab);
  if (error) searchParams.set("error", error);
  if (success) searchParams.set("success", success);
  const search = searchParams.toString();
  return search ? `${basePath}?${search}` : basePath;
}

function parseNextSlug(baseSlug: string, existingSlugs: string[]) {
  if (!existingSlugs.includes(baseSlug)) return baseSlug;

  let suffix = 2;
  while (existingSlugs.includes(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseSlug}-${suffix}`;
}

function normalizeScheduledAt(value: string | undefined) {
  if (!value?.trim()) return null;
  return new Date(value).toISOString();
}

async function revalidateTournamentPaths(tournamentId: string) {
  const slug = await getTournamentSlugById(tournamentId);
  revalidatePath("/admin/tournaments");
  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath("/tournaments");
  revalidatePath(`/tournaments/${slug}`);
  return slug;
}

async function resolveRoundIdByName(params: {
  tournamentId: string;
  roundName: string;
}) {
  const { tournamentId, roundName } = params;
  const supabase = await createSupabaseServerClient();
  const normalizedRoundName = roundName.trim().toLowerCase();
  const { data: existingRounds, error: roundsError } = await supabase
    .from("tournament_rounds")
    .select("id, round_number, name")
    .eq("tournament_id", tournamentId)
    .order("round_number", { ascending: true });

  if (roundsError) {
    throw new Error(`No se pudieron leer las fechas del torneo: ${roundsError.message}`);
  }

  const existingRound = (existingRounds ?? []).find((row) => row.name.trim().toLowerCase() === normalizedRoundName);
  if (existingRound) return existingRound.id;

  const nextRoundNumber =
    Math.max(0, ...(existingRounds ?? []).map((row) => Number(row.round_number))) + 1;
  const { data: insertedRound, error: insertError } = await supabase
    .from("tournament_rounds")
    .insert({
      tournament_id: tournamentId,
      round_number: nextRoundNumber,
      name: roundName.trim()
    })
    .select("id")
    .single();

  if (insertError || !insertedRound) {
    throw new Error(`No se pudo crear la fecha del torneo: ${insertError?.message ?? "sin detalle"}`);
  }

  return insertedRound.id;
}

export async function updateTournamentAction(tournamentId: string, formData: FormData) {
  try {
    await assertTournamentMembershipAction(tournamentId);
    const parsed = updateTournamentSchema.safeParse({
      name: formData.get("name"),
      seasonLabel: formData.get("seasonLabel"),
      description: formData.get("description"),
      isPublic: formData.get("isPublic") === "on",
      status: formData.get("status")
    });

    if (!parsed.success) {
      redirect(
        buildTournamentDetailPath({
          tournamentId,
          tab: "summary",
          error: parsed.error.issues[0]?.message ?? "Datos invalidos."
        })
      );
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("tournaments")
      .update({
        name: parsed.data.name.trim(),
        season_label: parsed.data.seasonLabel.trim(),
        description: parsed.data.description?.trim() || null,
        is_public: parsed.data.isPublic,
        status: parsed.data.status
      })
      .eq("id", tournamentId);

    if (error) {
      redirect(
        buildTournamentDetailPath({
          tournamentId,
          tab: "summary",
          error: toUserMessage(error, "No se pudo actualizar el torneo.")
        })
      );
    }

    await revalidateTournamentPaths(tournamentId);
    redirect(buildTournamentDetailPath({ tournamentId, tab: "summary", success: "Resumen actualizado." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(
      buildTournamentDetailPath({
        tournamentId,
        tab: "summary",
        error: toUserMessage(error, "No se pudo actualizar el torneo.")
      })
    );
  }
}

export async function addTournamentTeamAction(tournamentId: string, formData: FormData) {
  try {
    await assertTournamentMembershipAction(tournamentId);
    const parsed = teamSchema.safeParse({
      name: formData.get("name"),
      shortName: formData.get("shortName"),
      notes: formData.get("notes"),
      displayOrder: formData.get("displayOrder")
    });

    if (!parsed.success) {
      redirect(
        buildTournamentDetailPath({
          tournamentId,
          tab: "teams",
          error: parsed.error.issues[0]?.message ?? "Datos invalidos."
        })
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data: existingTeams, error: existingError } = await supabase
      .from("tournament_teams")
      .select("slug")
      .eq("tournament_id", tournamentId);

    if (existingError) {
      redirect(
        buildTournamentDetailPath({
          tournamentId,
          tab: "teams",
          error: toUserMessage(existingError, "No se pudo crear el equipo.")
        })
      );
    }

    const baseSlug = slugifyTournamentName(parsed.data.name) || `equipo-${Date.now()}`;
    const slug = parseNextSlug(
      baseSlug,
      (existingTeams ?? []).map((row) => row.slug.toLowerCase())
    );

    const { error } = await supabase.from("tournament_teams").insert({
      tournament_id: tournamentId,
      name: parsed.data.name.trim(),
      short_name: parsed.data.shortName?.trim() || null,
      slug,
      display_order: parsed.data.displayOrder,
      notes: parsed.data.notes?.trim() || null
    });

    if (error) {
      redirect(
        buildTournamentDetailPath({
          tournamentId,
          tab: "teams",
          error: toUserMessage(error, "No se pudo crear el equipo.")
        })
      );
    }

    await revalidateTournamentPaths(tournamentId);
    redirect(buildTournamentDetailPath({ tournamentId, tab: "teams", success: "Equipo agregado." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(
      buildTournamentDetailPath({
        tournamentId,
        tab: "teams",
        error: toUserMessage(error, "No se pudo crear el equipo.")
      })
    );
  }
}

export async function updateTournamentTeamAction(tournamentId: string, formData: FormData) {
  try {
    await assertTournamentMembershipAction(tournamentId);
    const teamId = String(formData.get("teamId") ?? "");
    const parsed = teamSchema.safeParse({
      name: formData.get("name"),
      shortName: formData.get("shortName"),
      notes: formData.get("notes"),
      displayOrder: formData.get("displayOrder")
    });

    if (!teamId) {
      redirect(buildTournamentDetailPath({ tournamentId, tab: "teams", error: "Falta el equipo a actualizar." }));
    }
    if (!parsed.success) {
      redirect(
        buildTournamentDetailPath({
          tournamentId,
          tab: "teams",
          error: parsed.error.issues[0]?.message ?? "Datos invalidos."
        })
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data: existingTeams, error: existingError } = await supabase
      .from("tournament_teams")
      .select("id, slug")
      .eq("tournament_id", tournamentId);

    if (existingError) {
      redirect(buildTournamentDetailPath({ tournamentId, tab: "teams", error: toUserMessage(existingError) }));
    }

    const baseSlug = slugifyTournamentName(parsed.data.name) || `equipo-${Date.now()}`;
    const otherSlugs = (existingTeams ?? [])
      .filter((row) => row.id !== teamId)
      .map((row) => row.slug.toLowerCase());
    const slug = parseNextSlug(baseSlug, otherSlugs);

    const { error } = await supabase
      .from("tournament_teams")
      .update({
        name: parsed.data.name.trim(),
        short_name: parsed.data.shortName?.trim() || null,
        notes: parsed.data.notes?.trim() || null,
        display_order: parsed.data.displayOrder,
        slug
      })
      .eq("id", teamId)
      .eq("tournament_id", tournamentId);

    if (error) {
      redirect(
        buildTournamentDetailPath({
          tournamentId,
          tab: "teams",
          error: toUserMessage(error, "No se pudo actualizar el equipo.")
        })
      );
    }

    await revalidateTournamentPaths(tournamentId);
    redirect(buildTournamentDetailPath({ tournamentId, tab: "teams", success: "Equipo actualizado." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(
      buildTournamentDetailPath({
        tournamentId,
        tab: "teams",
        error: toUserMessage(error, "No se pudo actualizar el equipo.")
      })
    );
  }
}

export async function deleteTournamentTeamAction(tournamentId: string, formData: FormData) {
  try {
    await assertTournamentMembershipAction(tournamentId);
    const teamId = String(formData.get("teamId") ?? "");
    if (!teamId) {
      redirect(buildTournamentDetailPath({ tournamentId, tab: "teams", error: "Falta el equipo a borrar." }));
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("tournament_teams")
      .delete()
      .eq("id", teamId)
      .eq("tournament_id", tournamentId);

    if (error) {
      const userMessage =
        error.code === "23503"
          ? "No se puede borrar el equipo porque ya esta vinculado a partidos del fixture."
          : toUserMessage(error, "No se pudo borrar el equipo.");
      redirect(buildTournamentDetailPath({ tournamentId, tab: "teams", error: userMessage }));
    }

    await revalidateTournamentPaths(tournamentId);
    redirect(buildTournamentDetailPath({ tournamentId, tab: "teams", success: "Equipo eliminado." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(
      buildTournamentDetailPath({
        tournamentId,
        tab: "teams",
        error: toUserMessage(error, "No se pudo borrar el equipo.")
      })
    );
  }
}

export async function addTournamentPlayerAction(tournamentId: string, formData: FormData) {
  try {
    await assertTournamentMembershipAction(tournamentId);
    const parsed = playerSchema.safeParse({
      teamId: formData.get("teamId"),
      fullName: formData.get("fullName"),
      shirtNumber: formData.get("shirtNumber"),
      position: formData.get("position")
    });

    if (!parsed.success) {
      redirect(
        buildTournamentDetailPath({
          tournamentId,
          tab: "players",
          error: parsed.error.issues[0]?.message ?? "Datos invalidos."
        })
      );
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("tournament_players").insert({
      tournament_id: tournamentId,
      team_id: parsed.data.teamId,
      full_name: parsed.data.fullName.trim(),
      shirt_number: parsed.data.shirtNumber,
      position: parsed.data.position?.trim() || null,
      active: true
    });

    if (error) {
      redirect(
        buildTournamentDetailPath({
          tournamentId,
          tab: "players",
          error: toUserMessage(error, "No se pudo agregar el jugador.")
        })
      );
    }

    await revalidateTournamentPaths(tournamentId);
    redirect(buildTournamentDetailPath({ tournamentId, tab: "players", success: "Jugador agregado." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(
      buildTournamentDetailPath({
        tournamentId,
        tab: "players",
        error: toUserMessage(error, "No se pudo agregar el jugador.")
      })
    );
  }
}

export async function deleteTournamentPlayerAction(tournamentId: string, formData: FormData) {
  try {
    await assertTournamentMembershipAction(tournamentId);
    const playerId = String(formData.get("playerId") ?? "");
    if (!playerId) {
      redirect(buildTournamentDetailPath({ tournamentId, tab: "players", error: "Falta el jugador a borrar." }));
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("tournament_players")
      .delete()
      .eq("id", playerId)
      .eq("tournament_id", tournamentId);

    if (error) {
      redirect(
        buildTournamentDetailPath({
          tournamentId,
          tab: "players",
          error: toUserMessage(error, "No se pudo borrar el jugador.")
        })
      );
    }

    await revalidateTournamentPaths(tournamentId);
    redirect(buildTournamentDetailPath({ tournamentId, tab: "players", success: "Jugador eliminado." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(
      buildTournamentDetailPath({
        tournamentId,
        tab: "players",
        error: toUserMessage(error, "No se pudo borrar el jugador.")
      })
    );
  }
}

export async function generateTournamentFixtureAction(tournamentId: string) {
  try {
    const admin = await assertTournamentMembershipAction(tournamentId);
    const supabase = await createSupabaseServerClient();
    await generateTournamentFixture({
      supabase: supabase as never,
      adminId: admin.userId,
      tournamentId
    });

    await revalidateTournamentPaths(tournamentId);
    redirect(buildTournamentDetailPath({ tournamentId, tab: "fixture", success: "Fixture generado." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(
      buildTournamentDetailPath({
        tournamentId,
        tab: "fixture",
        error: toUserMessage(error, "No se pudo generar el fixture.")
      })
    );
  }
}

export async function createManualTournamentMatchAction(tournamentId: string, formData: FormData) {
  try {
    const admin = await assertTournamentMembershipAction(tournamentId);
    const parsed = manualMatchSchema.safeParse({
      roundName: formData.get("roundName"),
      homeTeamId: formData.get("homeTeamId"),
      awayTeamId: formData.get("awayTeamId"),
      scheduledAt: formData.get("scheduledAt"),
      venue: formData.get("venue"),
      status: formData.get("status")
    });

    if (!parsed.success) {
      redirect(
        buildTournamentDetailPath({
          tournamentId,
          tab: "fixture",
          error: parsed.error.issues[0]?.message ?? "Datos invalidos."
        })
      );
    }

    const supabase = await createSupabaseServerClient();
    await validateTournamentMatchPair({
      supabase: supabase as never,
      tournamentId,
      homeTeamId: parsed.data.homeTeamId,
      awayTeamId: parsed.data.awayTeamId
    });
    const roundId = await resolveRoundIdByName({
      tournamentId,
      roundName: parsed.data.roundName
    });

    const { error } = await supabase.from("tournament_matches").insert({
      tournament_id: tournamentId,
      round_id: roundId,
      home_team_id: parsed.data.homeTeamId,
      away_team_id: parsed.data.awayTeamId,
      scheduled_at: normalizeScheduledAt(parsed.data.scheduledAt),
      venue: parsed.data.venue?.trim() || null,
      status: parsed.data.status,
      created_by: admin.userId
    });

    if (error) {
      redirect(
        buildTournamentDetailPath({
          tournamentId,
          tab: "fixture",
          error: toUserMessage(error, "No se pudo crear el partido manual.")
        })
      );
    }

    await revalidateTournamentPaths(tournamentId);
    redirect(buildTournamentDetailPath({ tournamentId, tab: "fixture", success: "Partido creado." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(
      buildTournamentDetailPath({
        tournamentId,
        tab: "fixture",
        error: toUserMessage(error, "No se pudo crear el partido manual.")
      })
    );
  }
}

export async function updateTournamentMatchAction(tournamentId: string, formData: FormData) {
  try {
    await assertTournamentMembershipAction(tournamentId);
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
      redirect(
        buildTournamentDetailPath({
          tournamentId,
          tab: "fixture",
          error: parsed.error.issues[0]?.message ?? "Datos invalidos."
        })
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data: currentMatch, error: matchError } = await supabase
      .from("tournament_matches")
      .select("id, home_team_id, away_team_id, round_id, status")
      .eq("id", parsed.data.matchId)
      .eq("tournament_id", tournamentId)
      .maybeSingle();

    if (matchError || !currentMatch) {
      redirect(buildTournamentDetailPath({ tournamentId, tab: "fixture", error: "No se encontro el partido." }));
    }
    if (currentMatch.status === "played") {
      redirect(
        buildTournamentDetailPath({
          tournamentId,
          tab: "fixture",
          error: "Los partidos jugados solo se editan desde el acta."
        })
      );
    }

    await validateTournamentMatchPair({
      supabase: supabase as never,
      tournamentId,
      homeTeamId: parsed.data.homeTeamId,
      awayTeamId: parsed.data.awayTeamId,
      ignoreMatchId: parsed.data.matchId
    });

    if (parsed.data.roundId) {
      const { data: round, error: roundError } = await supabase
        .from("tournament_rounds")
        .select("id")
        .eq("id", parsed.data.roundId)
        .eq("tournament_id", tournamentId)
        .maybeSingle();

      if (roundError || !round) {
        redirect(buildTournamentDetailPath({ tournamentId, tab: "fixture", error: "La fecha elegida no existe." }));
      }
    }

    const { error } = await supabase
      .from("tournament_matches")
      .update({
        round_id: parsed.data.roundId,
        home_team_id: parsed.data.homeTeamId,
        away_team_id: parsed.data.awayTeamId,
        scheduled_at: normalizeScheduledAt(parsed.data.scheduledAt),
        venue: parsed.data.venue?.trim() || null,
        status: parsed.data.status
      })
      .eq("id", parsed.data.matchId)
      .eq("tournament_id", tournamentId);

    if (error) {
      redirect(
        buildTournamentDetailPath({
          tournamentId,
          tab: "fixture",
          error: toUserMessage(error, "No se pudo actualizar el partido.")
        })
      );
    }

    await revalidateTournamentPaths(tournamentId);
    redirect(buildTournamentDetailPath({ tournamentId, tab: "fixture", success: "Partido actualizado." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(
      buildTournamentDetailPath({
        tournamentId,
        tab: "fixture",
        error: toUserMessage(error, "No se pudo actualizar el partido.")
      })
    );
  }
}
