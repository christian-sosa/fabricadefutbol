"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assertLeagueMembershipAction, getLeagueSlugById } from "@/lib/auth/tournaments";
import { toUserMessage } from "@/lib/errors";
import { isNextRedirectError } from "@/lib/next-redirect";
import { normalizeEmail, slugifyTournamentName } from "@/lib/org";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const updateLeagueSchema = z.object({
  name: z.string().min(3, "El nombre de la liga debe tener al menos 3 caracteres.").max(100),
  description: z.string().max(500).optional(),
  venueName: z.string().max(120).optional(),
  locationNotes: z.string().max(300).optional(),
  isPublic: z.boolean().default(false),
  status: z.enum(["draft", "active", "finished", "archived"])
});

const leagueTeamSchema = z.object({
  name: z.string().min(2, "El equipo debe tener al menos 2 caracteres.").max(80),
  shortName: z.string().max(20).optional(),
  notes: z.string().max(300).optional()
});

const leagueTeamUpdateSchema = leagueTeamSchema.extend({
  teamId: z.string().uuid()
});

const leagueAdminInviteSchema = z.object({
  email: z.string().email("Ingresa un email válido.")
});

const removeLeagueAdminSchema = z.object({
  adminId: z.string().uuid()
});

const leagueAdminInviteDeleteSchema = z.object({
  inviteId: z.string().uuid()
});

const createCompetitionSchema = z.object({
  name: z.string().min(3, "La competencia debe tener al menos 3 caracteres.").max(100),
  seasonLabel: z.string().max(40).optional(),
  description: z.string().max(500).optional(),
  venueOverride: z.string().max(120).optional(),
  isPublic: z.boolean().default(false)
});

function buildLeagueDetailPath(params: {
  leagueId: string;
  tab?: string;
  error?: string;
  success?: string;
}) {
  const { leagueId, tab, error, success } = params;
  const basePath = `/admin/tournaments/${leagueId}`;
  const searchParams = new URLSearchParams();
  if (tab) searchParams.set("tab", tab);
  if (error) searchParams.set("error", error);
  if (success) searchParams.set("success", success);
  const search = searchParams.toString();
  return search ? `${basePath}?${search}` : basePath;
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

function parseNextSlug(baseSlug: string, existingSlugs: string[]) {
  if (!existingSlugs.includes(baseSlug)) return baseSlug;

  let suffix = 2;
  while (existingSlugs.includes(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseSlug}-${suffix}`;
}

function buildInviteExpiresAt() {
  return new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
}

async function validateLeagueNameAvailability(params: {
  name: string;
  ignoreLeagueId: string;
}) {
  const supabase = createSupabaseAdminClient() ?? (await createSupabaseServerClient());
  const { data, error } = await supabase
    .from("leagues")
    .select("id")
    .ilike("name", params.name)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (data && String(data.id) !== params.ignoreLeagueId) {
    return "Ya existe una liga con ese nombre.";
  }

  return null;
}

async function leagueAlreadyHasAdminWithEmail(params: {
  leagueId: string;
  normalizedEmail: string;
}) {
  const supabaseAdmin = createSupabaseAdminClient();
  if (!supabaseAdmin) return false;

  const { data: memberships, error: membershipsError } = await supabaseAdmin
    .from("league_admins")
    .select("admin_id")
    .eq("league_id", params.leagueId);

  if (membershipsError) {
    throw new Error(membershipsError.message);
  }

  const adminIds = Array.from(new Set((memberships ?? []).map((row) => row.admin_id)));
  if (!adminIds.length) return false;

  const { data: authUsers, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });

  if (authUsersError) {
    throw new Error(authUsersError.message);
  }

  const currentAdminEmails = new Map(
    (authUsers?.users ?? [])
      .filter((user) => adminIds.includes(user.id))
      .map((user) => [user.id, normalizeEmail(user.email ?? "")])
  );

  return adminIds.some((adminId) => currentAdminEmails.get(adminId) === params.normalizedEmail);
}

async function revalidateLeaguePaths(leagueId: string) {
  const slug = await getLeagueSlugById(leagueId);
  revalidatePath("/admin/tournaments");
  revalidatePath(`/admin/tournaments/${leagueId}`);
  revalidatePath("/tournaments");
  revalidatePath(`/tournaments/${slug}`);
  return slug;
}

async function resolveUniqueCompetitionSlug(params: {
  leagueId: string;
  normalizedName: string;
}) {
  const supabase = createSupabaseAdminClient() ?? (await createSupabaseServerClient());
  const baseSlug = slugifyTournamentName(params.normalizedName) || `competencia-${Date.now()}`;
  const { data: existingRows, error } = await supabase
    .from("competitions")
    .select("slug")
    .eq("league_id", params.leagueId)
    .ilike("slug", `${baseSlug}%`);

  if (error) {
    throw new Error(error.message);
  }

  return parseNextSlug(
    baseSlug,
    (existingRows ?? []).map((row) => String(row.slug).toLowerCase())
  );
}

export async function updateLeagueAction(leagueId: string, formData: FormData) {
  try {
    await assertLeagueMembershipAction(leagueId);
    const parsed = updateLeagueSchema.safeParse({
      name: formData.get("name"),
      description: formData.get("description"),
      venueName: formData.get("venueName"),
      locationNotes: formData.get("locationNotes"),
      isPublic: formData.get("isPublic") === "on",
      status: formData.get("status")
    });

    if (!parsed.success) {
      redirect(
        buildLeagueDetailPath({
          leagueId,
          tab: "summary",
          error: parsed.error.issues[0]?.message ?? "Datos inválidos."
        })
      );
    }

    const normalizedName = parsed.data.name.trim();
    const duplicateNameMessage = await validateLeagueNameAvailability({
      name: normalizedName,
      ignoreLeagueId: leagueId
    });
    if (duplicateNameMessage) {
      redirect(buildLeagueDetailPath({ leagueId, tab: "summary", error: duplicateNameMessage }));
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("leagues")
      .update({
        name: normalizedName,
        description: parsed.data.description?.trim() || null,
        venue_name: parsed.data.venueName?.trim() || null,
        location_notes: parsed.data.locationNotes?.trim() || null,
        is_public: parsed.data.isPublic,
        status: parsed.data.status
      })
      .eq("id", leagueId);

    if (error) {
      redirect(buildLeagueDetailPath({ leagueId, tab: "summary", error: toUserMessage(error, "No se pudo actualizar la liga.") }));
    }

    await revalidateLeaguePaths(leagueId);
    redirect(buildLeagueDetailPath({ leagueId, tab: "summary", success: "Resumen actualizado." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildLeagueDetailPath({ leagueId, tab: "summary", error: toUserMessage(error, "No se pudo actualizar la liga.") }));
  }
}

export async function inviteLeagueAdminAction(leagueId: string, formData: FormData) {
  try {
    const admin = await assertLeagueMembershipAction(leagueId);
    const parsed = leagueAdminInviteSchema.safeParse({
      email: formData.get("email")
    });

    if (!parsed.success) {
      redirect(buildLeagueDetailPath({ leagueId, tab: "admins", error: parsed.error.issues[0]?.message ?? "Datos inválidos." }));
    }

    const normalizedEmail = normalizeEmail(parsed.data.email);
    if (normalizedEmail === admin.email) {
      redirect(buildLeagueDetailPath({ leagueId, tab: "admins", error: "Tu usuario ya administra esta liga." }));
    }

    if (await leagueAlreadyHasAdminWithEmail({ leagueId, normalizedEmail })) {
      redirect(buildLeagueDetailPath({ leagueId, tab: "admins", error: "Ese email ya administra esta liga." }));
    }

    const supabase = await createSupabaseServerClient();
    const [{ count: currentAdmins, error: adminCountError }, { data: inviteRows, error: inviteRowsError }] =
      await Promise.all([
        supabase.from("league_admins").select("id", { count: "exact", head: true }).eq("league_id", leagueId),
        supabase
          .from("league_admin_invites")
          .select("id, expires_at")
          .eq("league_id", leagueId)
          .eq("status", "pending")
      ]);

    if (adminCountError) {
      redirect(buildLeagueDetailPath({ leagueId, tab: "admins", error: toUserMessage(adminCountError, "No se pudo verificar los admins actuales.") }));
    }

    if (inviteRowsError) {
      redirect(buildLeagueDetailPath({ leagueId, tab: "admins", error: toUserMessage(inviteRowsError, "No se pudo verificar invitaciones pendientes.") }));
    }

    const activePendingInvites = (inviteRows ?? []).filter((row) => {
      const expiresAt = Date.parse(row.expires_at);
      return !Number.isFinite(expiresAt) || expiresAt > Date.now();
    });
    const slotsUsed = (currentAdmins ?? 0) + activePendingInvites.length;
    if (slotsUsed >= 4) {
      redirect(buildLeagueDetailPath({ leagueId, tab: "admins", error: "Esta liga ya alcanzó el máximo de 4 administradores." }));
    }

    const { error: cleanupInviteError } = await supabase
      .from("league_admin_invites")
      .delete()
      .eq("league_id", leagueId)
      .eq("email", normalizedEmail)
      .eq("status", "pending")
      .lte("expires_at", new Date().toISOString());

    if (cleanupInviteError) {
      redirect(buildLeagueDetailPath({ leagueId, tab: "admins", error: toUserMessage(cleanupInviteError, "No se pudo preparar la invitación.") }));
    }

    const { error: inviteError } = await supabase.from("league_admin_invites").insert({
      league_id: leagueId,
      email: normalizedEmail,
      invited_by: admin.userId,
      status: "pending",
      expires_at: buildInviteExpiresAt()
    });

    if (inviteError) {
      redirect(buildLeagueDetailPath({
        leagueId,
        tab: "admins",
        error:
          inviteError.code === "23505"
            ? "Ese email ya tiene una invitación pendiente."
            : toUserMessage(inviteError, "No se pudo generar la invitación.")
      }));
    }

    await revalidateLeaguePaths(leagueId);
    redirect(buildLeagueDetailPath({ leagueId, tab: "admins", success: "Invitación de admin preparada." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildLeagueDetailPath({ leagueId, tab: "admins", error: toUserMessage(error, "No se pudo generar la invitación.") }));
  }
}

export async function revokeLeagueAdminInviteAction(leagueId: string, formData: FormData) {
  try {
    await assertLeagueMembershipAction(leagueId);
    const parsed = leagueAdminInviteDeleteSchema.safeParse({
      inviteId: formData.get("inviteId")
    });

    if (!parsed.success) {
      redirect(buildLeagueDetailPath({ leagueId, tab: "admins", error: parsed.error.issues[0]?.message ?? "Datos inválidos." }));
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("league_admin_invites")
      .delete()
      .eq("id", parsed.data.inviteId)
      .eq("league_id", leagueId);

    if (error) {
      redirect(buildLeagueDetailPath({ leagueId, tab: "admins", error: toUserMessage(error, "No se pudo cancelar la invitación.") }));
    }

    await revalidateLeaguePaths(leagueId);
    redirect(buildLeagueDetailPath({ leagueId, tab: "admins", success: "Invitación cancelada." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildLeagueDetailPath({ leagueId, tab: "admins", error: toUserMessage(error, "No se pudo cancelar la invitación.") }));
  }
}

export async function removeLeagueAdminAction(leagueId: string, formData: FormData) {
  try {
    const actingAdmin = await assertLeagueMembershipAction(leagueId);
    const parsed = removeLeagueAdminSchema.safeParse({
      adminId: formData.get("adminId")
    });

    if (!parsed.success) {
      redirect(buildLeagueDetailPath({ leagueId, tab: "admins", error: parsed.error.issues[0]?.message ?? "Datos inválidos." }));
    }

    if (actingAdmin.userId === parsed.data.adminId) {
      redirect(buildLeagueDetailPath({ leagueId, tab: "admins", error: "No puedes quitarte a ti mismo como admin de esta liga." }));
    }

    const supabase = await createSupabaseServerClient();
    const { count: adminsCount, error: adminsCountError } = await supabase
      .from("league_admins")
      .select("id", { count: "exact", head: true })
      .eq("league_id", leagueId);

    if (adminsCountError) {
      redirect(buildLeagueDetailPath({ leagueId, tab: "admins", error: toUserMessage(adminsCountError, "No se pudo contar los admins actuales.") }));
    }

    if ((adminsCount ?? 0) <= 1) {
      redirect(buildLeagueDetailPath({ leagueId, tab: "admins", error: "La liga debe mantener al menos 1 admin activo." }));
    }

    const { error: deleteError } = await supabase
      .from("league_admins")
      .delete()
      .eq("league_id", leagueId)
      .eq("admin_id", parsed.data.adminId);

    if (deleteError) {
      redirect(buildLeagueDetailPath({ leagueId, tab: "admins", error: toUserMessage(deleteError, "No se pudo quitar al administrador.") }));
    }

    await revalidateLeaguePaths(leagueId);
    redirect(buildLeagueDetailPath({ leagueId, tab: "admins", success: "Administrador quitado." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildLeagueDetailPath({ leagueId, tab: "admins", error: toUserMessage(error, "No se pudo quitar al administrador.") }));
  }
}

export async function addLeagueTeamAction(leagueId: string, formData: FormData) {
  try {
    await assertLeagueMembershipAction(leagueId);
    const parsed = leagueTeamSchema.safeParse({
      name: formData.get("name"),
      shortName: formData.get("shortName"),
      notes: formData.get("notes")
    });

    if (!parsed.success) {
      redirect(buildLeagueDetailPath({ leagueId, tab: "teams", error: parsed.error.issues[0]?.message ?? "Datos inválidos." }));
    }

    const supabase = await createSupabaseServerClient();
    const normalizedName = parsed.data.name.trim();
    const normalizedSlug = slugifyTournamentName(normalizedName) || `equipo-${Date.now()}`;
    const { data: existingTeams, error: existingTeamsError } = await supabase
      .from("league_teams")
      .select("id, name, slug")
      .eq("league_id", leagueId);

    if (existingTeamsError) {
      redirect(buildLeagueDetailPath({ leagueId, tab: "teams", error: toUserMessage(existingTeamsError, "No se pudo validar el equipo.") }));
    }

    const normalizedNames = new Set((existingTeams ?? []).map((team) => String(team.name).trim().toLowerCase()));
    if (normalizedNames.has(normalizedName.toLowerCase())) {
      redirect(buildLeagueDetailPath({ leagueId, tab: "teams", error: "Ya existe un equipo con ese nombre en la liga." }));
    }

    const teamSlug = parseNextSlug(
      normalizedSlug,
      (existingTeams ?? []).map((team) => String(team.slug).toLowerCase())
    );

    const { error } = await supabase.from("league_teams").insert({
      league_id: leagueId,
      name: normalizedName,
      short_name: parsed.data.shortName?.trim() || null,
      slug: teamSlug,
      notes: parsed.data.notes?.trim() || null
    });

    if (error) {
      redirect(buildLeagueDetailPath({ leagueId, tab: "teams", error: toUserMessage(error, "No se pudo agregar el equipo.") }));
    }

    await revalidateLeaguePaths(leagueId);
    redirect(buildLeagueDetailPath({ leagueId, tab: "teams", success: "Equipo maestro agregado." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildLeagueDetailPath({ leagueId, tab: "teams", error: toUserMessage(error, "No se pudo agregar el equipo.") }));
  }
}

export async function updateLeagueTeamAction(leagueId: string, formData: FormData) {
  try {
    await assertLeagueMembershipAction(leagueId);
    const parsed = leagueTeamUpdateSchema.safeParse({
      teamId: formData.get("teamId"),
      name: formData.get("name"),
      shortName: formData.get("shortName"),
      notes: formData.get("notes")
    });

    if (!parsed.success) {
      redirect(buildLeagueDetailPath({ leagueId, tab: "teams", error: parsed.error.issues[0]?.message ?? "Datos inválidos." }));
    }

    const supabase = await createSupabaseServerClient();
    const normalizedName = parsed.data.name.trim();

    const { data: siblingTeams, error: siblingTeamsError } = await supabase
      .from("league_teams")
      .select("id, name")
      .eq("league_id", leagueId);

    if (siblingTeamsError) {
      redirect(buildLeagueDetailPath({ leagueId, tab: "teams", error: toUserMessage(siblingTeamsError, "No se pudo validar el equipo.") }));
    }

    const duplicate = (siblingTeams ?? []).find(
      (team) => String(team.id) !== parsed.data.teamId && String(team.name).trim().toLowerCase() === normalizedName.toLowerCase()
    );
    if (duplicate) {
      redirect(buildLeagueDetailPath({ leagueId, tab: "teams", error: "Ya existe otro equipo con ese nombre en la liga." }));
    }

    const { error } = await supabase
      .from("league_teams")
      .update({
        name: normalizedName,
        short_name: parsed.data.shortName?.trim() || null,
        notes: parsed.data.notes?.trim() || null
      })
      .eq("id", parsed.data.teamId)
      .eq("league_id", leagueId);

    if (error) {
      redirect(buildLeagueDetailPath({ leagueId, tab: "teams", error: toUserMessage(error, "No se pudo actualizar el equipo.") }));
    }

    await revalidateLeaguePaths(leagueId);
    redirect(buildLeagueDetailPath({ leagueId, tab: "teams", success: "Equipo maestro actualizado." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildLeagueDetailPath({ leagueId, tab: "teams", error: toUserMessage(error, "No se pudo actualizar el equipo.") }));
  }
}

export async function deleteLeagueTeamAction(leagueId: string, formData: FormData) {
  try {
    await assertLeagueMembershipAction(leagueId);
    const teamId = String(formData.get("teamId") ?? "");
    if (!teamId) {
      redirect(buildLeagueDetailPath({ leagueId, tab: "teams", error: "Falta el equipo a borrar." }));
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("league_teams")
      .delete()
      .eq("id", teamId)
      .eq("league_id", leagueId);

    if (error) {
      const userMessage =
        error.code === "23503"
          ? "No se puede borrar el equipo porque ya está inscripto en alguna competencia."
          : toUserMessage(error, "No se pudo borrar el equipo.");
      redirect(buildLeagueDetailPath({ leagueId, tab: "teams", error: userMessage }));
    }

    await revalidateLeaguePaths(leagueId);
    redirect(buildLeagueDetailPath({ leagueId, tab: "teams", success: "Equipo maestro eliminado." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildLeagueDetailPath({ leagueId, tab: "teams", error: toUserMessage(error, "No se pudo borrar el equipo.") }));
  }
}

export async function createCompetitionAction(leagueId: string, formData: FormData) {
  try {
    await assertLeagueMembershipAction(leagueId);
    const parsed = createCompetitionSchema.safeParse({
      name: formData.get("name"),
      seasonLabel: formData.get("seasonLabel"),
      description: formData.get("description"),
      venueOverride: formData.get("venueOverride"),
      isPublic: formData.get("isPublic") === "on"
    });

    if (!parsed.success) {
      redirect(buildLeagueDetailPath({ leagueId, tab: "competitions", error: parsed.error.issues[0]?.message ?? "Datos inválidos." }));
    }

    const selectedLeagueTeamIds = formData
      .getAll("leagueTeamIds")
      .map((value) => String(value))
      .filter(Boolean);

    const supabase = await createSupabaseServerClient();
    const normalizedName = parsed.data.name.trim();
    const competitionSlug = await resolveUniqueCompetitionSlug({
      leagueId,
      normalizedName
    });

    const { data: competition, error: competitionError } = await supabase
      .from("competitions")
      .insert({
        league_id: leagueId,
        name: normalizedName,
        slug: competitionSlug,
        season_label: parsed.data.seasonLabel?.trim() || String(new Date().getFullYear()),
        description: parsed.data.description?.trim() || null,
        venue_override: parsed.data.venueOverride?.trim() || null,
        is_public: parsed.data.isPublic,
        status: "draft"
      })
      .select("id")
      .single();

    if (competitionError || !competition) {
      redirect(buildLeagueDetailPath({ leagueId, tab: "competitions", error: toUserMessage(competitionError, "No se pudo crear la competencia.") }));
    }

    if (selectedLeagueTeamIds.length) {
      const { data: leagueTeams, error: leagueTeamsError } = await supabase
        .from("league_teams")
        .select("id, name, short_name, notes")
        .eq("league_id", leagueId)
        .in("id", selectedLeagueTeamIds);

      if (leagueTeamsError) {
        redirect(buildLeagueDetailPath({ leagueId, tab: "competitions", error: toUserMessage(leagueTeamsError, "No se pudieron cargar los equipos seleccionados.") }));
      }

      const orderedTeams = [...(leagueTeams ?? [])].sort((left, right) =>
        String(left.name).localeCompare(String(right.name), "es")
      );

      if (orderedTeams.length) {
        const { error: competitionTeamsError } = await supabase.from("competition_teams").insert(
          orderedTeams.map((team, index) => ({
            competition_id: competition.id,
            league_team_id: team.id,
            display_name: team.name,
            short_name: team.short_name ?? null,
            display_order: index + 1,
            notes: team.notes ?? null
          }))
        );

        if (competitionTeamsError) {
          redirect(buildLeagueDetailPath({ leagueId, tab: "competitions", error: toUserMessage(competitionTeamsError, "No se pudieron inscribir los equipos seleccionados.") }));
        }
      }
    }

    await revalidateLeaguePaths(leagueId);
    revalidatePath(`/admin/tournaments/${leagueId}/competitions/${competition.id}`);
    redirect(buildCompetitionDetailPath({ leagueId, competitionId: competition.id, success: "Competencia creada." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildLeagueDetailPath({ leagueId, tab: "competitions", error: toUserMessage(error, "No se pudo crear la competencia.") }));
  }
}
