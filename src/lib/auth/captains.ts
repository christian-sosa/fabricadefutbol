import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";

import { getAdminSession, type AdminSession } from "@/lib/auth/admin";
import { buildAdminLoginPath } from "@/lib/auth/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TournamentStatus } from "@/types/domain";

export type CaptainAssignment = {
  assignmentId: string;
  tournamentId: string;
  teamId: string;
  tournamentName: string;
  tournamentSlug: string;
  tournamentStatus: TournamentStatus;
  tournamentIsPublic: boolean;
  seasonLabel: string;
  teamName: string;
  teamShortName: string | null;
  createdAt: string;
};

function isMissingCaptainTableError(error: { message?: string | null } | null | undefined) {
  const message = String(error?.message ?? "").toLowerCase();
  if (!message) return false;

  return (
    (message.includes("tournament_team_captains") &&
      (message.includes("schema cache") ||
        message.includes("could not find the table") ||
        message.includes("does not exist"))) ||
    message.includes("relation \"public.tournament_team_captains\" does not exist")
  );
}

function buildCaptainSelectionPath(params: { tournamentId?: string | null; teamId?: string | null }) {
  const searchParams = new URLSearchParams();
  if (params.tournamentId) searchParams.set("tournament", params.tournamentId);
  if (params.teamId) searchParams.set("team", params.teamId);
  const query = searchParams.toString();
  return query ? `/captain?${query}` : "/captain";
}

export async function requireCaptainSession(nextPath = "/captain"): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    redirect(buildAdminLoginPath(nextPath));
  }

  return session;
}

export async function getCaptainAssignments(userId: string): Promise<CaptainAssignment[]> {
  const supabase = await createSupabaseServerClient();
  const { data: captainRows, error: captainError } = await supabase
    .from("tournament_team_captains")
    .select("id, tournament_id, team_id, created_at")
    .eq("captain_id", userId)
    .order("created_at", { ascending: true });

  if (captainError) {
    if (isMissingCaptainTableError(captainError)) {
      return [];
    }
    throw new Error(captainError.message);
  }

  if (!captainRows?.length) {
    return [];
  }

  const tournamentIds = Array.from(new Set(captainRows.map((row) => row.tournament_id)));
  const teamIds = Array.from(new Set(captainRows.map((row) => row.team_id)));

  const [{ data: tournaments, error: tournamentsError }, { data: teams, error: teamsError }] = await Promise.all([
    supabase
      .from("tournaments")
      .select("id, name, slug, season_label, status, is_public")
      .in("id", tournamentIds),
    supabase.from("tournament_teams").select("id, tournament_id, name, short_name").in("id", teamIds)
  ]);

  if (tournamentsError) {
    throw new Error(tournamentsError.message);
  }
  if (teamsError) {
    throw new Error(teamsError.message);
  }

  const tournamentsById = new Map((tournaments ?? []).map((row) => [row.id, row]));
  const teamsById = new Map((teams ?? []).map((row) => [row.id, row]));

  return captainRows
    .flatMap((row) => {
      const tournament = tournamentsById.get(row.tournament_id);
      const team = teamsById.get(row.team_id);

      if (!tournament || !team) {
        return [];
      }

      return [
        {
          assignmentId: row.id,
          tournamentId: tournament.id,
          teamId: team.id,
          tournamentName: tournament.name,
          tournamentSlug: tournament.slug,
          tournamentStatus: tournament.status,
          tournamentIsPublic: tournament.is_public,
          seasonLabel: tournament.season_label,
          teamName: team.name,
          teamShortName: team.short_name,
          createdAt: row.created_at
        } satisfies CaptainAssignment
      ];
    })
    .sort((left, right) => {
      const tournamentComparison = left.tournamentName.localeCompare(right.tournamentName, "es");
      if (tournamentComparison !== 0) return tournamentComparison;
      return left.teamName.localeCompare(right.teamName, "es");
    });
}

export async function hasCaptainAssignments(userId: string) {
  const assignments = await getCaptainAssignments(userId);
  return assignments.length > 0;
}

function findSelectedAssignment(params: {
  assignments: CaptainAssignment[];
  tournamentId?: string | null;
  teamId?: string | null;
}) {
  const { assignments, tournamentId, teamId } = params;
  if (!assignments.length) return null;

  if (teamId) {
    const byTeam = assignments.find((assignment) => assignment.teamId === teamId);
    if (byTeam) return byTeam;
  }

  if (tournamentId) {
    const byTournament = assignments.find((assignment) => assignment.tournamentId === tournamentId);
    if (byTournament) return byTournament;
  }

  return assignments[0] ?? null;
}

export async function getCaptainContext(params?: {
  tournamentId?: string | null;
  teamId?: string | null;
  nextPath?: string;
}) {
  noStore();

  const nextPath =
    params?.nextPath ?? buildCaptainSelectionPath({ tournamentId: params?.tournamentId, teamId: params?.teamId });
  const captain = await requireCaptainSession(nextPath);
  const assignments = await getCaptainAssignments(captain.userId);
  const selectedAssignment = findSelectedAssignment({
    assignments,
    tournamentId: params?.tournamentId,
    teamId: params?.teamId
  });

  return {
    captain,
    assignments,
    selectedAssignment
  };
}

export async function assertCaptainTeamAction(params: { tournamentId: string; teamId: string }) {
  const captain = await requireCaptainSession(
    buildCaptainSelectionPath({
      tournamentId: params.tournamentId,
      teamId: params.teamId
    })
  );
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tournament_team_captains")
    .select("id")
    .eq("captain_id", captain.userId)
    .eq("tournament_id", params.tournamentId)
    .eq("team_id", params.teamId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("No tienes permisos para gestionar este equipo.");
  }

  return captain;
}
