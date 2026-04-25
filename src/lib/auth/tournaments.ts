import { redirect } from "next/navigation";

import { assertAdminAction, requireAdminSession, type AdminSession } from "@/lib/auth/admin";
import {
  resolveLeagueWriteWindow,
  toShortDate,
  type LeagueSubscriptionSnapshot
} from "@/lib/domain/billing";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  CompetitionCoverageMode,
  CompetitionStatus,
  CompetitionType,
  LeagueStatus
} from "@/types/domain";

export type AdminLeague = {
  id: string;
  name: string;
  slug: string;
  logo_path: string | null;
  photo_path: string | null;
  venue_name: string | null;
  location_notes: string | null;
  status: LeagueStatus;
  is_public: boolean;
  created_at: string;
};

export type AdminCompetition = {
  id: string;
  league_id: string;
  name: string;
  slug: string;
  season_label: string;
  description: string | null;
  venue_override: string | null;
  type: CompetitionType;
  coverage_mode: CompetitionCoverageMode;
  playoff_size: number | null;
  status: CompetitionStatus;
  is_public: boolean;
  created_at: string;
};

export type LeagueWriteAccess = {
  canWrite: boolean;
  reason: string | null;
  accessValidUntil: string | null;
  writeLockedAt: string | null;
  subscriptionStatus: string | null;
  subscriptionCurrentPeriodEnd: string | null;
  subscriptionActive: boolean;
};

function isLeagueBillingSchemaMissing(message: string) {
  return /league_billing_subscriptions|league_billing_payments|purpose|period_start|period_end|subscription_applied_at/i.test(
    message
  );
}

async function loadLeagueById(leagueId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("leagues")
    .select("id, name, slug, logo_path, photo_path, venue_name, location_notes, status, is_public, created_at")
    .eq("id", leagueId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as AdminLeague | null;
}

export async function getAdminLeagues(admin: AdminSession): Promise<AdminLeague[]> {
  const supabase = await createSupabaseServerClient();

  if (admin.isSuperAdmin) {
    const { data, error } = await supabase
      .from("leagues")
      .select("id, name, slug, logo_path, photo_path, venue_name, location_notes, status, is_public, created_at")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as AdminLeague[];
  }

  const [{ data: createdRows, error: createdError }, { data: membershipRows, error: membershipError }] =
    await Promise.all([
      supabase.from("leagues").select("id").eq("created_by", admin.userId),
      supabase.from("league_admins").select("league_id").eq("admin_id", admin.userId)
    ]);

  if (createdError) throw new Error(createdError.message);
  if (membershipError) throw new Error(membershipError.message);

  const leagueIds = Array.from(
    new Set([
      ...(createdRows ?? []).map((row) => String(row.id)),
      ...(membershipRows ?? []).map((row) => String(row.league_id))
    ])
  );

  if (!leagueIds.length) return [];

  const { data, error } = await supabase
    .from("leagues")
    .select("id, name, slug, logo_path, photo_path, venue_name, location_notes, status, is_public, created_at")
    .in("id", leagueIds)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as AdminLeague[];
}

export async function getAdminCompetitionsForLeague(leagueId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("competitions")
    .select("id, league_id, name, slug, season_label, description, venue_override, type, coverage_mode, playoff_size, status, is_public, created_at")
    .eq("league_id", leagueId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as AdminCompetition[];
}

export async function getLeagueSlugById(leagueId: string) {
  const league = await loadLeagueById(leagueId);
  return league?.slug ?? leagueId;
}

export async function getCompetitionPublicPathById(competitionId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: competition, error: competitionError } = await supabase
    .from("competitions")
    .select("id, slug, league_id")
    .eq("id", competitionId)
    .maybeSingle();

  if (competitionError || !competition) {
    return null;
  }

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("slug")
    .eq("id", competition.league_id)
    .maybeSingle();

  if (leagueError || !league?.slug) {
    return null;
  }

  return {
    leagueId: String(competition.league_id),
    leagueSlug: String(league.slug),
    competitionSlug: String(competition.slug)
  };
}

async function assertLeagueMembership(leagueId: string) {
  const admin = await assertAdminAction();

  if (admin.isSuperAdmin) {
    return admin;
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: membership, error: membershipError }, { data: createdLeague, error: creatorError }] =
    await Promise.all([
      supabase
        .from("league_admins")
        .select("id")
        .eq("league_id", leagueId)
        .eq("admin_id", admin.userId)
        .maybeSingle(),
      supabase
        .from("leagues")
        .select("id")
        .eq("id", leagueId)
        .eq("created_by", admin.userId)
        .maybeSingle()
    ]);

  const hasAccess = Boolean(membership || createdLeague);
  if (!hasAccess && (membershipError || creatorError)) {
    throw new Error(membershipError?.message ?? creatorError?.message ?? "No autorizado para administrar esta liga.");
  }

  if (!hasAccess) {
    throw new Error("No autorizado para administrar esta liga.");
  }

  return admin;
}

export async function assertLeagueMembershipAction(leagueId: string) {
  return assertLeagueMembership(leagueId);
}

export async function getLeagueWriteAccess(
  admin: AdminSession,
  leagueId: string
): Promise<LeagueWriteAccess> {
  if (admin.isSuperAdmin) {
    return {
      canWrite: true,
      reason: null,
      accessValidUntil: null,
      writeLockedAt: null,
      subscriptionStatus: null,
      subscriptionCurrentPeriodEnd: null,
      subscriptionActive: false
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: subscription, error } = await supabase
    .from("league_billing_subscriptions")
    .select("status, current_period_end")
    .eq("league_id", leagueId)
    .maybeSingle();

  if (error && !isLeagueBillingSchemaMissing(error.message)) {
    throw new Error(error.message);
  }

  if (error && isLeagueBillingSchemaMissing(error.message)) {
    return {
      canWrite: true,
      reason: null,
      accessValidUntil: null,
      writeLockedAt: null,
      subscriptionStatus: null,
      subscriptionCurrentPeriodEnd: null,
      subscriptionActive: false
    };
  }

  const safeSubscription = (subscription ?? null) as LeagueSubscriptionSnapshot | null;
  const writeWindow = resolveLeagueWriteWindow({
    subscription: safeSubscription
  });
  const accessValidUntil = writeWindow.accessValidUntil;

  if (!writeWindow.canWrite) {
    const reason = accessValidUntil
      ? `El acceso de esta liga vencio el ${toShortDate(accessValidUntil)}. Necesitas pagar otro mes para volver a editar.`
      : "Esta liga no tiene un periodo pago activo. Necesitas pagar el mes para poder editar.";

    return {
      canWrite: false,
      reason,
      accessValidUntil,
      writeLockedAt: writeWindow.writeLockedAt,
      subscriptionStatus: safeSubscription?.status ?? null,
      subscriptionCurrentPeriodEnd: safeSubscription?.current_period_end ?? null,
      subscriptionActive: writeWindow.subscriptionActive
    };
  }

  return {
    canWrite: true,
    reason: null,
    accessValidUntil,
    writeLockedAt: writeWindow.writeLockedAt,
    subscriptionStatus: safeSubscription?.status ?? null,
    subscriptionCurrentPeriodEnd: safeSubscription?.current_period_end ?? null,
    subscriptionActive: writeWindow.subscriptionActive
  };
}

export async function assertLeagueWriteAction(leagueId: string) {
  const admin = await assertLeagueMembership(leagueId);
  const writeAccess = await getLeagueWriteAccess(admin, leagueId);
  if (!writeAccess.canWrite) {
    throw new Error(writeAccess.reason ?? "No tienes acceso de escritura para esta liga.");
  }
  return admin;
}

export async function assertCompetitionMembershipAction(competitionId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: competition, error } = await supabase
    .from("competitions")
    .select("league_id")
    .eq("id", competitionId)
    .maybeSingle();

  if (error || !competition?.league_id) {
    throw new Error("No autorizado para administrar esta competencia.");
  }

  const admin = await assertLeagueMembership(String(competition.league_id));
  return {
    admin,
    leagueId: String(competition.league_id)
  };
}

export async function assertCompetitionWriteAction(competitionId: string) {
  const { admin, leagueId } = await assertCompetitionMembershipAction(competitionId);
  const writeAccess = await getLeagueWriteAccess(admin, leagueId);
  if (!writeAccess.canWrite) {
    throw new Error(writeAccess.reason ?? "No tienes acceso de escritura para esta liga.");
  }

  return {
    admin,
    leagueId
  };
}

export async function requireAdminLeague(leagueId: string) {
  await assertLeagueMembershipAction(leagueId);

  const admin = await requireAdminSession();
  const league = await loadLeagueById(leagueId);

  if (!league) {
    redirect("/admin/tournaments");
  }

  return {
    admin,
    league
  };
}

export async function requireAdminCompetition(params: {
  leagueId: string;
  competitionId: string;
}) {
  const { leagueId, competitionId } = params;
  await assertLeagueMembershipAction(leagueId);

  const [admin, league, competition] = await Promise.all([
    requireAdminSession(),
    loadLeagueById(leagueId),
    (async () => {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase
        .from("competitions")
        .select("id, league_id, name, slug, season_label, description, venue_override, type, coverage_mode, playoff_size, status, is_public, created_at")
        .eq("id", competitionId)
        .eq("league_id", leagueId)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      return (data ?? null) as AdminCompetition | null;
    })()
  ]);

  if (!league || !competition) {
    redirect(`/admin/tournaments/${leagueId}`);
  }

  return {
    admin,
    league,
    competition
  };
}
