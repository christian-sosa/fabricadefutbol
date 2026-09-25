import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calculateGuestDisplayRating } from "@/lib/domain/skill-level";
import { readAllRows } from "@/lib/queries/read-all-rows";
import { readRowsByIds } from "@/lib/supabase/pagination";
import type { TeamSide } from "@/types/domain";

export type AdminMatchSubstitute = {
  participantId: string;
  fullName: string;
  rating: number;
  source: "player" | "guest";
  initialTeam: TeamSide | "OUT";
  isSubstitute: true;
};

export async function getAdminMatchSubstitutes(matchId: string, organizationId: string): Promise<AdminMatchSubstitute[]> {
  const supabase = await createSupabaseServerClient();
  const { data: match, error: matchError } = await supabase.from("matches").select("id")
    .eq("id", matchId).eq("organization_id", organizationId).maybeSingle();
  if (matchError) throw new Error(matchError.message);
  if (!match) return [];
  const [players, guests] = await Promise.all([
    supabase.from("match_players").select("player_id, substitute_team").eq("match_id", matchId).eq("is_substitute", true),
    supabase.from("match_guests").select("id, guest_name, guest_rating, substitute_team").eq("match_id", matchId).eq("is_substitute", true)
  ]);
  if (players.error) throw new Error(players.error.message);
  if (guests.error) throw new Error(guests.error.message);
  const ids = (players.data ?? []).map((row) => row.player_id);
  const names = ids.length ? await supabase.from("players").select("id, full_name, current_rating")
    .eq("organization_id", organizationId).in("id", ids) : { data: [], error: null };
  if (names.error) throw new Error(names.error.message);
  const byId = new Map((names.data ?? []).map((row) => [row.id, row]));
  return [
    ...(players.data ?? []).flatMap((row): AdminMatchSubstitute[] => {
      const player = byId.get(row.player_id);
      return player ? [{ participantId: `player:${player.id}`, fullName: player.full_name, rating: Number(player.current_rating),
        source: "player", initialTeam: row.substitute_team ?? "OUT", isSubstitute: true }] : [];
    }),
    ...(guests.data ?? []).map((guest): AdminMatchSubstitute => ({ participantId: `guest:${guest.id}`, fullName: guest.guest_name,
      rating: calculateGuestDisplayRating(guest.guest_rating), source: "guest", initialTeam: guest.substitute_team ?? "OUT", isSubstitute: true }))
  ];
}

export async function getAdminMatchScorers(matchId: string) {
  const supabase = await createSupabaseServerClient();
  // RLS allows only administrators of the match's group to read these rows.
  const { data, error } = await supabase.from("match_goal_scorers")
    .select("participant_id, display_name, team, goals").eq("match_id", matchId).order("display_name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type AdminHistoricalScorer = {
  playerId: string;
  displayName: string;
  goals: number;
  matchesPlayed: number;
  rank: number;
};

export type AdminHistoricalScorers = {
  scorers: AdminHistoricalScorer[];
  page: number;
  pageCount: number;
  totalScorers: number;
  totalGoals: number;
  guestGoals: number;
  matchesRecorded: number;
};

export async function getAdminHistoricalScorers(organizationId: string, page = 1): Promise<AdminHistoricalScorers> {
  const supabase = await createSupabaseServerClient();
  const pageSize = 20;
  const { data: matches, error: matchesError } = await readAllRows((from, to) => supabase.from("matches")
    .select("id, scheduled_at, confirmed_option_id", { count: "exact" })
    .eq("organization_id", organizationId).eq("status", "finished").in("modality", ["9v9", "10v10", "11v11"])
    .order("scheduled_at", { ascending: false }).order("id").range(from, to));
  if (matchesError) throw new Error(matchesError.message);

  // Read every season before paginating players; paging matches would undercount totals.
  // Every read uses count-aware pagination, including when the API caps its response.
  const matchIds = matches.map((match) => match.id);
  const [scorers, scorelessDraws] = await Promise.all([
    readRowsByIds(matchIds, (ids, from, to) => supabase.from("match_goal_scorers")
      .select("match_id, participant_id, player_id, display_name, goals", { count: "exact" })
      .in("match_id", ids).order("match_id").order("participant_id").range(from, to)),
    readRowsByIds(matchIds, (ids, from, to) => supabase.from("match_result")
      .select("match_id", { count: "exact" }).in("match_id", ids)
      .eq("score_a", 0).eq("score_b", 0).order("match_id").range(from, to))
  ]);
  const matchRecency = new Map(matches.map((match, index) => [match.id, index]));
  const playersById = new Map<string, {
    displayName: string;
    latestMatchIndex: number;
    goals: number;
    matchIds: Set<string>;
  }>();
  const matchesRecorded = new Set(scorelessDraws.map((result) => result.match_id));
  let totalGoals = 0;
  let guestGoals = 0;
  for (const scorer of scorers) {
    totalGoals += scorer.goals;
    matchesRecorded.add(scorer.match_id);
    // Guest IDs belong to a single match, so names cannot establish a historical identity.
    if (!scorer.player_id) {
      guestGoals += scorer.goals;
      continue;
    }
    const matchIndex = matchRecency.get(scorer.match_id)!;
    const player = playersById.get(scorer.player_id) ?? {
      displayName: scorer.display_name, latestMatchIndex: matchIndex, goals: 0, matchIds: new Set<string>()
    };
    player.goals += scorer.goals;
    if (matchIndex < player.latestMatchIndex) {
      player.displayName = scorer.display_name;
      player.latestMatchIndex = matchIndex;
    }
    playersById.set(scorer.player_id, player);
  }

  const recordedOptions = new Map(matches.flatMap((match) => matchesRecorded.has(match.id) && match.confirmed_option_id
    ? [[match.confirmed_option_id, match.id] as const] : []));
  const [players, participants] = await Promise.all([
    readRowsByIds([...playersById.keys()], (ids, from, to) => supabase.from("players")
      .select("id, full_name", { count: "exact" }).eq("organization_id", organizationId)
      .in("id", ids).order("id").range(from, to)),
    readRowsByIds(playersById.size ? [...recordedOptions.keys()] : [], (ids, from, to) => supabase.from("team_option_players")
      .select("team_option_id, player_id", { count: "exact" }).in("team_option_id", ids)
      .in("team", ["A", "B"]).order("team_option_id").order("player_id").range(from, to))
  ]);
  // The result RPC rebuilds this confirmed option from final A/B assignments.
  // It includes substitutes who played and excludes unused substitutes and absences.
  for (const participant of participants) {
    playersById.get(participant.player_id)?.matchIds.add(recordedOptions.get(participant.team_option_id)!);
  }
  const currentNames = new Map(players.map((player) => [player.id, player.full_name]));
  const ranking = [...playersById].map(([playerId, player]) => ({
    playerId, displayName: currentNames.get(playerId) ?? player.displayName,
    goals: player.goals, matchesPlayed: player.matchIds.size, rank: 0
  })).sort((left, right) => right.goals - left.goals
    || left.displayName.localeCompare(right.displayName, "es")
    || left.playerId.localeCompare(right.playerId));
  ranking.forEach((scorer, index) => {
    scorer.rank = index > 0 && scorer.goals === ranking[index - 1].goals ? ranking[index - 1].rank : index + 1;
  });

  const pageCount = Math.max(1, Math.ceil(ranking.length / pageSize));
  const currentPage = Math.min(pageCount, Number.isSafeInteger(page) ? Math.max(1, page) : 1);
  const offset = (currentPage - 1) * pageSize;
  return {
    scorers: ranking.slice(offset, offset + pageSize), page: currentPage, pageCount,
    totalScorers: ranking.length, totalGoals, guestGoals, matchesRecorded: matchesRecorded.size
  };
}
