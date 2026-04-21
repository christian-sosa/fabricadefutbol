import { redirect } from "next/navigation";

import { assertAdminAction, requireAdminSession, type AdminSession } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TournamentStatus } from "@/types/domain";

export type AdminTournament = {
  id: string;
  name: string;
  slug: string;
  season_label: string;
  status: TournamentStatus;
  is_public: boolean;
  created_at: string;
};

export async function getAdminTournaments(admin: AdminSession): Promise<AdminTournament[]> {
  const supabase = await createSupabaseServerClient();

  if (admin.isSuperAdmin) {
    const { data, error } = await supabase
      .from("tournaments")
      .select("id, name, slug, season_label, status, is_public, created_at")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as AdminTournament[];
  }

  const [{ data: createdRows, error: createdError }, { data: membershipRows, error: membershipError }] =
    await Promise.all([
      supabase.from("tournaments").select("id").eq("created_by", admin.userId),
      supabase.from("tournament_admins").select("tournament_id").eq("admin_id", admin.userId)
    ]);

  if (createdError) throw new Error(createdError.message);
  if (membershipError) throw new Error(membershipError.message);

  const tournamentIds = Array.from(
    new Set([
      ...(createdRows ?? []).map((row) => row.id),
      ...(membershipRows ?? []).map((row) => row.tournament_id)
    ])
  );

  if (!tournamentIds.length) return [];

  const { data, error } = await supabase
    .from("tournaments")
    .select("id, name, slug, season_label, status, is_public, created_at")
    .in("id", tournamentIds)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as AdminTournament[];
}

export async function getTournamentSlugById(tournamentId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tournaments")
    .select("slug")
    .eq("id", tournamentId)
    .maybeSingle();

  if (error || !data?.slug) return tournamentId;
  return data.slug;
}

export async function assertTournamentMembershipAction(tournamentId: string) {
  const admin = await assertAdminAction();

  if (admin.isSuperAdmin) return admin;

  const supabase = await createSupabaseServerClient();
  const [{ data: membership, error: membershipError }, { data: createdTournament, error: creatorError }] =
    await Promise.all([
      supabase
        .from("tournament_admins")
        .select("id")
        .eq("tournament_id", tournamentId)
        .eq("admin_id", admin.userId)
        .maybeSingle(),
      supabase
        .from("tournaments")
        .select("id")
        .eq("id", tournamentId)
        .eq("created_by", admin.userId)
        .maybeSingle()
    ]);

  const hasAccess = Boolean(membership || createdTournament);
  if (!hasAccess && (membershipError || creatorError)) {
    throw new Error(
      membershipError?.message ?? creatorError?.message ?? "No autorizado para administrar este torneo."
    );
  }

  if (!hasAccess) {
    throw new Error("No autorizado para administrar este torneo.");
  }

  return admin;
}

export async function requireAdminTournament(tournamentId: string) {
  await assertTournamentMembershipAction(tournamentId);

  const admin = await requireAdminSession();
  const tournaments = await getAdminTournaments(admin);
  const tournament = tournaments.find((item) => item.id === tournamentId) ?? null;

  if (!tournament) {
    redirect("/admin/tournaments");
  }

  return {
    admin,
    tournament
  };
}
