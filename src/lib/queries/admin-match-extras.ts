import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calculateGuestDisplayRating } from "@/lib/domain/skill-level";
import { readAllRows } from "@/lib/queries/read-all-rows";
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

export async function getAdminScorerHistory(organizationId: string, page = 1) {
  const supabase = await createSupabaseServerClient();
  const pageSize = 20;
  const { count, error: countError } = await supabase.from("matches")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId).eq("status", "finished").in("modality", ["9v9", "10v10", "11v11"]);
  if (countError) throw new Error(countError.message);
  const pageCount = Math.max(1, Math.ceil((count ?? 0) / pageSize));
  const currentPage = Math.min(pageCount, Number.isSafeInteger(page) ? Math.max(1, page) : 1);
  const offset = (currentPage - 1) * pageSize;
  const { data: matches, error: matchesError } = await supabase.from("matches")
    .select("id, scheduled_at, modality, team_a_label, team_b_label")
    .eq("organization_id", organizationId).eq("status", "finished").in("modality", ["9v9", "10v10", "11v11"])
    .order("scheduled_at", { ascending: false }).order("id").range(offset, offset + pageSize - 1);
  if (matchesError) throw new Error(matchesError.message);
  if (!matches?.length) return { matches: [], pageCount, page: currentPage };
  const matchIds = matches.map((match) => match.id);
  const { data: scorers, error } = await readAllRows((from, to) => supabase.from("match_goal_scorers")
    .select("match_id, participant_id, display_name, team, goals", { count: "exact" })
    .in("match_id", matchIds).order("match_id").order("participant_id").range(from, to));
  if (error) throw new Error(error.message);
  const scorersByMatch = new Map<string, typeof scorers>();
  for (const scorer of scorers) {
    const group = scorersByMatch.get(scorer.match_id) ?? [];
    group.push(scorer);
    scorersByMatch.set(scorer.match_id, group);
  }
  return { matches: matches.map((match) => ({ ...match, scorers: scorersByMatch.get(match.id) ?? [] })), pageCount, page: currentPage };
}
