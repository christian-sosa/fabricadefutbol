import { unstable_noStore as noStore } from "next/cache";

import { requireAdminSession } from "@/lib/auth/admin";
import { getAdminClubs } from "@/lib/auth/clubs";
import {
  buildClubPublicSnapshot,
  type ClubCompetitionRecord,
  type ClubLineupRecord,
  type ClubMatchPlayerStatRecord,
  type ClubMatchRecord,
  type ClubPlayerRecord,
  type ClubPublicMatch,
  type ClubPublicSnapshot,
  type ClubPublicStatRow,
  type ClubPublicSummary,
  type ClubPublicTeam,
  type ClubRecord,
  type ClubTeamPlayerRecord,
  type ClubTeamRecord
} from "@/lib/domain/clubs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ClubAdminListItem = {
  id: string;
  membershipId: string;
  displayName: string;
  email: string | null;
  createdAt: string;
};

export type ClubAdminInviteListItem = {
  id: string;
  clubId: string;
  email: string;
  inviteToken: string;
  expiresAt: string;
  createdAt: string;
  status: "pending" | "accepted" | "revoked";
};

export type AdminClubDetails = {
  club: ClubRecord;
  players: ClubPlayerRecord[];
  teams: ClubTeamRecord[];
  teamPlayers: ClubTeamPlayerRecord[];
  matches: ClubMatchRecord[];
  lineups: ClubLineupRecord[];
  stats: ClubMatchPlayerStatRecord[];
  publicSnapshot: ClubPublicSnapshot;
  admins: ClubAdminListItem[];
  pendingInvites: ClubAdminInviteListItem[];
  competitions: ClubCompetitionRecord[];
};

type ClubAdminRow = {
  id: string;
  club_id: string;
  admin_id: string;
  created_at: string;
  admins?: { id: string; display_name: string } | Array<{ id: string; display_name: string }> | null;
};

type ClubAdminInviteRow = {
  id: string;
  club_id: string;
  email: string;
  invite_token: string;
  expires_at: string;
  created_at: string;
  status: "pending" | "accepted" | "revoked";
};

type ClubSnapshotRow = {
  summary: ClubPublicSummary | null;
  teams: ClubPublicTeam[] | null;
  recent_matches: ClubPublicMatch[] | null;
  top_scorers: ClubPublicStatRow[] | null;
  top_assisters: ClubPublicStatRow[] | null;
  top_figures: ClubPublicStatRow[] | null;
  competition_stats: ClubPublicSnapshot["competitionStats"] | null;
};

function emptySnapshot(clubName: string): ClubPublicSnapshot {
  return {
    summary: {
      clubName,
      teamCount: 0,
      playerCount: 0,
      playedMatches: 0,
      goalsFor: 0,
      goalsAgainst: 0
    },
    teams: [],
    recentMatches: [],
    topScorers: [],
    topAssisters: [],
    topFigures: [],
    competitionStats: []
  };
}

function normalizeSnapshot(row: ClubSnapshotRow | null, clubName: string): ClubPublicSnapshot {
  if (!row) return emptySnapshot(clubName);

  return {
    summary: row.summary ?? emptySnapshot(clubName).summary,
    teams: row.teams ?? [],
    recentMatches: row.recent_matches ?? [],
    topScorers: row.top_scorers ?? [],
    topAssisters: row.top_assisters ?? [],
    topFigures: row.top_figures ?? [],
    competitionStats: row.competition_stats ?? []
  };
}

async function resolveAdminEmailsById(adminIds: string[]) {
  const adminClient = createSupabaseAdminClient();
  const emailsById = new Map<string, string>();
  if (!adminClient || !adminIds.length) return emailsById;

  const resolved = await Promise.all(
    Array.from(new Set(adminIds)).map(async (adminId) => {
      try {
        const { data } = await adminClient.auth.admin.getUserById(adminId);
        return [adminId, data?.user?.email?.toLowerCase() ?? null] as const;
      } catch {
        return [adminId, null] as const;
      }
    })
  );

  for (const [adminId, email] of resolved) {
    if (email) emailsById.set(adminId, email);
  }

  return emailsById;
}

export async function getAdminClubList() {
  const admin = await requireAdminSession();
  return getAdminClubs(admin);
}

async function loadClubPrivateData(clubId: string) {
  const supabase = await createSupabaseServerClient();
  const [
    { data: club, error: clubError },
    { data: players, error: playersError },
    { data: competitions, error: competitionsError },
    { data: teams, error: teamsError },
    { data: teamPlayers, error: teamPlayersError },
    { data: matches, error: matchesError },
    { data: lineups, error: lineupsError },
    { data: stats, error: statsError }
  ] = await Promise.all([
    supabase
      .from("clubs")
      .select("id, name, slug, description, home_venue, is_public, status, created_at")
      .eq("id", clubId)
      .maybeSingle(),
    supabase
      .from("club_players")
      .select("id, club_id, full_name, nickname, position, shirt_number, photo_path, active")
      .eq("club_id", clubId)
      .order("full_name", { ascending: true }),
    supabase
      .from("club_competitions")
      .select("id, club_id, name, slug, active, notes")
      .eq("club_id", clubId)
      .order("name", { ascending: true }),
    supabase
      .from("club_teams")
      .select("id, club_id, name, short_name, logo_path, active")
      .eq("club_id", clubId)
      .order("name", { ascending: true }),
    supabase.from("club_team_players").select("id, club_team_id, club_player_id"),
    supabase
      .from("club_matches")
      .select("id, club_id, club_team_id, club_competition_id, played_at, opponent_name, venue, goals_for, goals_against, status, notes")
      .eq("club_id", clubId)
      .order("played_at", { ascending: false }),
    supabase.from("club_match_lineups").select("id, match_id, club_player_id, guest_name, display_name, role"),
    supabase.from("club_match_player_stats").select("id, match_id, lineup_id, goals, assists, is_mvp")
  ]);

  if (clubError) throw new Error(clubError.message);
  if (playersError) throw new Error(playersError.message);
  if (competitionsError) throw new Error(competitionsError.message);
  if (teamsError) throw new Error(teamsError.message);
  if (teamPlayersError) throw new Error(teamPlayersError.message);
  if (matchesError) throw new Error(matchesError.message);
  if (lineupsError) throw new Error(lineupsError.message);
  if (statsError) throw new Error(statsError.message);
  if (!club) return null;

  const matchIds = new Set((matches ?? []).map((match) => String(match.id)));
  const filteredLineups = ((lineups ?? []) as ClubLineupRecord[]).filter((lineup) =>
    matchIds.has(lineup.match_id)
  );
  const lineupIds = new Set(filteredLineups.map((lineup) => lineup.id));

  return {
    club: club as ClubRecord,
    players: (players ?? []) as ClubPlayerRecord[],
    competitions: (competitions ?? []) as ClubCompetitionRecord[],
    teams: (teams ?? []) as ClubTeamRecord[],
    teamPlayers: ((teamPlayers ?? []) as ClubTeamPlayerRecord[]).filter((teamPlayer) =>
      ((teams ?? []) as ClubTeamRecord[]).some((team) => team.id === teamPlayer.club_team_id)
    ),
    matches: (matches ?? []) as ClubMatchRecord[],
    lineups: filteredLineups,
    stats: ((stats ?? []) as ClubMatchPlayerStatRecord[]).filter((stat) => lineupIds.has(stat.lineup_id))
  };
}

export async function refreshClubPublicSnapshot(clubId: string) {
  const privateData = await loadClubPrivateData(clubId);
  if (!privateData) return null;

  const snapshot = buildClubPublicSnapshot(privateData);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("club_public_snapshots").upsert(
    {
      club_id: clubId,
      summary: snapshot.summary,
      teams: snapshot.teams,
      recent_matches: snapshot.recentMatches,
      top_scorers: snapshot.topScorers,
      top_assisters: snapshot.topAssisters,
      top_figures: snapshot.topFigures,
      competition_stats: snapshot.competitionStats,
      refreshed_at: new Date().toISOString()
    },
    { onConflict: "club_id" }
  );

  if (error) throw new Error(error.message);
  return snapshot;
}

export async function getAdminClubDetails(clubId: string): Promise<AdminClubDetails | null> {
  noStore();
  const privateData = await loadClubPrivateData(clubId);
  if (!privateData) return null;

  const supabase = await createSupabaseServerClient();
  const [
    { data: snapshotRow, error: snapshotError },
    { data: adminsData, error: adminsError },
    { data: invitesData, error: invitesError }
  ] = await Promise.all([
    supabase
      .from("club_public_snapshots")
      .select("summary, teams, recent_matches, top_scorers, top_assisters, top_figures, competition_stats")
      .eq("club_id", clubId)
      .maybeSingle(),
    supabase
      .from("club_admins")
      .select("id, club_id, admin_id, created_at, admins!club_admins_admin_id_fkey(id, display_name)")
      .eq("club_id", clubId)
      .order("created_at", { ascending: true }),
    supabase
      .from("club_admin_invites")
      .select("id, club_id, email, invite_token, expires_at, created_at, status")
      .eq("club_id", clubId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
  ]);

  if (snapshotError) throw new Error(snapshotError.message);
  if (adminsError) throw new Error(adminsError.message);
  if (invitesError) throw new Error(invitesError.message);

  const adminRows = (adminsData ?? []) as ClubAdminRow[];
  const emailsById = await resolveAdminEmailsById(adminRows.map((row) => row.admin_id));
  const now = Date.now();

  return {
    ...privateData,
    publicSnapshot: normalizeSnapshot((snapshotRow ?? null) as ClubSnapshotRow | null, privateData.club.name),
    admins: adminRows.map((row) => {
      const relation = row.admins;
      const adminRow = Array.isArray(relation) ? relation[0] ?? null : relation ?? null;
      return {
        id: row.admin_id,
        membershipId: row.id,
        displayName: adminRow?.display_name ?? "Admin",
        email: emailsById.get(row.admin_id) ?? null,
        createdAt: row.created_at
      };
    }),
    pendingInvites: ((invitesData ?? []) as ClubAdminInviteRow[])
      .filter((invite) => {
        const expiresAt = Date.parse(invite.expires_at);
        return !Number.isFinite(expiresAt) || expiresAt > now;
      })
      .map((invite) => ({
        id: invite.id,
        clubId: invite.club_id,
        email: invite.email,
        inviteToken: invite.invite_token,
        expiresAt: invite.expires_at,
        createdAt: invite.created_at,
        status: invite.status
      }))
  };
}

export async function getPublicClubBySlug(slug: string) {
  noStore();
  const supabase = await createSupabaseServerClient();
  const { data: club, error: clubError } = await supabase
    .from("clubs")
    .select("id, name, slug, description, home_venue, is_public, status, created_at")
    .eq("slug", slug)
    .eq("is_public", true)
    .eq("status", "active")
    .maybeSingle();

  if (clubError) throw new Error(clubError.message);
  if (!club) return null;

  const { data: snapshot, error: snapshotError } = await supabase
    .from("club_public_snapshots")
    .select("summary, teams, recent_matches, top_scorers, top_assisters, top_figures, competition_stats")
    .eq("club_id", club.id)
    .maybeSingle();

  if (snapshotError) throw new Error(snapshotError.message);

  return {
    club: club as ClubRecord,
    snapshot: normalizeSnapshot((snapshot ?? null) as ClubSnapshotRow | null, String(club.name))
  };
}
