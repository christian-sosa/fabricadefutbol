import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";

import { getAdminSession, type AdminSession } from "@/lib/auth/admin";
import { buildAdminLoginPath } from "@/lib/auth/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CompetitionStatus } from "@/types/domain";

export type CaptainAssignment = {
  assignmentId: string;
  leagueId: string;
  leagueName: string;
  leagueSlug: string;
  competitionId: string;
  competitionName: string;
  competitionSlug: string;
  competitionStatus: CompetitionStatus;
  competitionIsPublic: boolean;
  seasonLabel: string;
  competitionTeamId: string;
  leagueTeamId: string;
  teamName: string;
  teamShortName: string | null;
  createdAt: string;
  tournamentId: string;
  tournamentName: string;
  tournamentSlug: string;
  teamId: string;
};

function buildCaptainSelectionPath(params: { competitionId?: string | null; teamId?: string | null }) {
  const searchParams = new URLSearchParams();
  if (params.competitionId) searchParams.set("competition", params.competitionId);
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
    .from("competition_team_captains")
    .select("id, competition_id, competition_team_id, created_at")
    .eq("captain_id", userId)
    .order("created_at", { ascending: true });

  if (captainError) {
    throw new Error(captainError.message);
  }

  if (!captainRows?.length) {
    return [];
  }

  const competitionIds = Array.from(new Set(captainRows.map((row) => String(row.competition_id))));
  const competitionTeamIds = Array.from(new Set(captainRows.map((row) => String(row.competition_team_id))));

  const [{ data: competitions, error: competitionsError }, { data: competitionTeams, error: competitionTeamsError }] =
    await Promise.all([
      supabase
        .from("competitions")
        .select("id, league_id, name, slug, season_label, status, is_public")
        .in("id", competitionIds),
      supabase
        .from("competition_teams")
        .select("id, competition_id, league_team_id, display_name, short_name")
        .in("id", competitionTeamIds)
    ]);

  if (competitionsError) {
    throw new Error(competitionsError.message);
  }
  if (competitionTeamsError) {
    throw new Error(competitionTeamsError.message);
  }

  const leagueIds = Array.from(
    new Set((competitions ?? []).map((row) => String(row.league_id)).filter(Boolean))
  );
  const { data: leagues, error: leaguesError } = await supabase
    .from("leagues")
    .select("id, name, slug")
    .in("id", leagueIds);

  if (leaguesError) {
    throw new Error(leaguesError.message);
  }

  const competitionsById = new Map((competitions ?? []).map((row) => [String(row.id), row]));
  const competitionTeamsById = new Map((competitionTeams ?? []).map((row) => [String(row.id), row]));
  const leaguesById = new Map((leagues ?? []).map((row) => [String(row.id), row]));

  return (captainRows ?? [])
    .flatMap((row) => {
      const competition = competitionsById.get(String(row.competition_id));
      const competitionTeam = competitionTeamsById.get(String(row.competition_team_id));
      const league = competition ? leaguesById.get(String(competition.league_id)) : null;

      if (!competition || !competitionTeam || !league) {
        return [];
      }

      return [
        {
          assignmentId: String(row.id),
          leagueId: String(league.id),
          leagueName: String(league.name),
          leagueSlug: String(league.slug),
          competitionId: String(competition.id),
          competitionName: String(competition.name),
          competitionSlug: String(competition.slug),
          competitionStatus: competition.status as CompetitionStatus,
          competitionIsPublic: Boolean(competition.is_public),
          seasonLabel: String(competition.season_label),
          competitionTeamId: String(competitionTeam.id),
          leagueTeamId: String(competitionTeam.league_team_id),
          teamName: String(competitionTeam.display_name),
          teamShortName: competitionTeam.short_name ? String(competitionTeam.short_name) : null,
          createdAt: String(row.created_at),
          tournamentId: String(competition.id),
          tournamentName: String(competition.name),
          tournamentSlug: String(competition.slug),
          teamId: String(competitionTeam.id)
        } satisfies CaptainAssignment
      ];
    })
    .sort((left, right) => {
      const leagueComparison = left.leagueName.localeCompare(right.leagueName, "es");
      if (leagueComparison !== 0) return leagueComparison;
      const competitionComparison = left.competitionName.localeCompare(right.competitionName, "es");
      if (competitionComparison !== 0) return competitionComparison;
      return left.teamName.localeCompare(right.teamName, "es");
    });
}

function findSelectedAssignment(params: {
  assignments: CaptainAssignment[];
  competitionId?: string | null;
  teamId?: string | null;
}) {
  const { assignments, competitionId, teamId } = params;
  if (!assignments.length) return null;

  if (teamId) {
    const byTeam = assignments.find((assignment) => assignment.competitionTeamId === teamId);
    if (byTeam) return byTeam;
  }

  if (competitionId) {
    const byCompetition = assignments.find((assignment) => assignment.competitionId === competitionId);
    if (byCompetition) return byCompetition;
  }

  return assignments[0] ?? null;
}

export async function getCaptainContext(params?: {
  competitionId?: string | null;
  teamId?: string | null;
  nextPath?: string;
}) {
  noStore();

  const nextPath =
    params?.nextPath ??
    buildCaptainSelectionPath({ competitionId: params?.competitionId, teamId: params?.teamId });
  const captain = await requireCaptainSession(nextPath);
  const assignments = await getCaptainAssignments(captain.userId);
  const selectedAssignment = findSelectedAssignment({
    assignments,
    competitionId: params?.competitionId,
    teamId: params?.teamId
  });

  return {
    captain,
    assignments,
    selectedAssignment
  };
}

export async function assertCaptainTeamAction(params: {
  competitionId: string;
  competitionTeamId: string;
}) {
  const captain = await requireCaptainSession(
    buildCaptainSelectionPath({
      competitionId: params.competitionId,
      teamId: params.competitionTeamId
    })
  );
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("competition_team_captains")
    .select("id")
    .eq("captain_id", captain.userId)
    .eq("competition_id", params.competitionId)
    .eq("competition_team_id", params.competitionTeamId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("No tienes permisos para gestionar este equipo.");
  }

  return captain;
}
