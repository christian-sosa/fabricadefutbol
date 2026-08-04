import { notFound, redirect } from "next/navigation";

import { assertAdminAction, requireAdminSession, type AdminSession } from "@/lib/auth/admin";
import { assertCanAccessClubsProduct, canAccessClubsProduct } from "@/lib/features";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ClubStatus } from "@/lib/domain/clubs";

export type AdminClub = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  home_venue: string | null;
  is_public: boolean;
  status: ClubStatus;
  created_at: string;
};

function findClubByKey(clubs: AdminClub[], clubKey?: string | null) {
  if (!clubKey) return null;
  const normalizedKey = clubKey.trim().toLowerCase();
  if (!normalizedKey) return null;
  return clubs.find((club) => club.slug.toLowerCase() === normalizedKey || club.id === clubKey) ?? null;
}

async function loadClubById(clubId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clubs")
    .select("id, name, slug, description, home_venue, is_public, status, created_at")
    .eq("id", clubId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as AdminClub | null;
}

export async function getAdminClubs(admin: AdminSession): Promise<AdminClub[]> {
  if (!canAccessClubsProduct()) return [];

  const supabase = await createSupabaseServerClient();

  if (admin.isSuperAdmin) {
    const { data, error } = await supabase
      .from("clubs")
      .select("id, name, slug, description, home_venue, is_public, status, created_at")
      .order("name", { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []) as AdminClub[];
  }

  const [{ data: createdRows, error: createdError }, { data: membershipRows, error: membershipError }] =
    await Promise.all([
      supabase.from("clubs").select("id").eq("created_by", admin.userId),
      supabase.from("club_admins").select("club_id").eq("admin_id", admin.userId)
    ]);

  if (createdError) throw new Error(createdError.message);
  if (membershipError) throw new Error(membershipError.message);

  const clubIds = Array.from(
    new Set([
      ...(createdRows ?? []).map((row) => String(row.id)),
      ...(membershipRows ?? []).map((row) => String(row.club_id))
    ])
  );

  if (!clubIds.length) return [];

  const { data, error } = await supabase
    .from("clubs")
    .select("id, name, slug, description, home_venue, is_public, status, created_at")
    .in("id", clubIds)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as AdminClub[];
}

async function assertClubMembership(clubId: string) {
  assertCanAccessClubsProduct();

  const admin = await assertAdminAction();

  if (admin.isSuperAdmin) {
    return admin;
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: membership, error: membershipError }, { data: createdClub, error: creatorError }] =
    await Promise.all([
      supabase
        .from("club_admins")
        .select("id")
        .eq("club_id", clubId)
        .eq("admin_id", admin.userId)
        .maybeSingle(),
      supabase
        .from("clubs")
        .select("id")
        .eq("id", clubId)
        .eq("created_by", admin.userId)
        .maybeSingle()
    ]);

  const hasAccess = Boolean(membership || createdClub);
  if (!hasAccess && (membershipError || creatorError)) {
    throw new Error(membershipError?.message ?? creatorError?.message ?? "No autorizado para administrar este club.");
  }

  if (!hasAccess) {
    throw new Error("No autorizado para administrar este club.");
  }

  return admin;
}

export async function assertClubMembershipAction(clubId: string) {
  return assertClubMembership(clubId);
}

export async function assertClubWriteAction(clubId: string) {
  return assertClubMembership(clubId);
}

export async function getAdminClubContext(preferredClubKey?: string | null) {
  const admin = await requireAdminSession();
  const clubs = await getAdminClubs(admin);
  const selectedClub = findClubByKey(clubs, preferredClubKey) ?? clubs[0] ?? null;

  return {
    admin,
    clubs,
    selectedClub
  };
}

export async function requireAdminClub(clubId: string) {
  if (!canAccessClubsProduct()) notFound();

  await assertClubMembershipAction(clubId);

  const [admin, club] = await Promise.all([requireAdminSession(), loadClubById(clubId)]);
  if (!club) {
    redirect("/admin/clubs");
  }

  return {
    admin,
    club
  };
}

export async function getClubSlugById(clubId: string) {
  const club = await loadClubById(clubId);
  return club?.slug ?? clubId;
}
