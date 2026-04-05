import { createSupabaseServerClient } from "@/lib/supabase/server";

function notNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function isGuestSchemaMissing(error: { message: string } | null) {
  if (!error) return false;
  return /match_guests|team_option_guests/i.test(error.message);
}

export async function getAdminDashboardData(organizationId: string) {
  const supabase = await createSupabaseServerClient();

  const [
    { count: draftsCount, error: draftsError },
    { count: confirmedCount, error: confirmedError },
    { count: finishedCount, error: finishedError },
    { data: latestMatches, error: latestMatchesError }
  ] = await Promise.all([
    supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "draft"),
    supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "confirmed"),
    supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "finished"),
    supabase
      .from("matches")
      .select("id, scheduled_at, modality, status")
      .eq("organization_id", organizationId)
      .order("scheduled_at", { ascending: false })
      .limit(8)
  ]);

  if (draftsError) throw new Error(draftsError.message);
  if (confirmedError) throw new Error(confirmedError.message);
  if (finishedError) throw new Error(finishedError.message);
  if (latestMatchesError) throw new Error(latestMatchesError.message);

  return {
    draftsCount: draftsCount ?? 0,
    confirmedCount: confirmedCount ?? 0,
    finishedCount: finishedCount ?? 0,
    latestMatches: latestMatches ?? []
  };
}

export async function getOrganizationAdminData(organizationId: string) {
  const supabase = await createSupabaseServerClient();

  const [{ data: adminsData, error: adminsError }, { data: invitesData, error: invitesError }] = await Promise.all([
    supabase
      .from("organization_admins")
      .select("id, admin_id, created_at, admins!organization_admins_admin_id_fkey(id, display_name)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true }),
    supabase
      .from("organization_invites")
      .select("id, email, invite_token, status, created_at")
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
  ]);

  if (adminsError) throw new Error(adminsError.message);
  if (invitesError) throw new Error(invitesError.message);

  const admins = (adminsData ?? []).map((row) => {
    const relation = row.admins;
    const adminRow = Array.isArray(relation) ? relation[0] : relation;

    return {
      id: row.admin_id,
      displayName: adminRow?.display_name ?? "Admin",
      createdAt: row.created_at
    };
  });

  const pendingInvites = (invitesData ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    inviteToken: row.invite_token,
    status: row.status,
    createdAt: row.created_at
  }));

  return {
    admins,
    pendingInvites
  };
}

export async function getAdminPlayers(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("organization_id", organizationId)
    .order("initial_rank", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSelectablePlayers(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("players")
    .select("id, full_name, current_rating, initial_rank")
    .eq("organization_id", organizationId)
    .eq("active", true)
    .order("initial_rank", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAdminMatchDetails(matchId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (matchError) throw new Error(matchError.message);
  if (!match) return null;

  const [{ data: matchPlayers, error: matchPlayersError }, { data: matchGuests, error: matchGuestsError }] =
    await Promise.all([
      supabase.from("match_players").select("player_id").eq("match_id", matchId),
      supabase.from("match_guests").select("id, guest_name, guest_rating").eq("match_id", matchId)
    ]);
  if (matchPlayersError) throw new Error(matchPlayersError.message);
  if (matchGuestsError && !isGuestSchemaMissing(matchGuestsError)) throw new Error(matchGuestsError.message);
  const safeMatchGuests = matchGuestsError && isGuestSchemaMissing(matchGuestsError) ? [] : matchGuests ?? [];

  const playerIds = (matchPlayers ?? []).map((row) => row.player_id);
  const { data: players, error: playersError } = playerIds.length
    ? await supabase
        .from("players")
        .select("id, full_name, current_rating")
        .eq("organization_id", organizationId)
        .in("id", playerIds)
    : { data: [], error: null };
  if (playersError) throw new Error(playersError.message);
  const playersById = new Map((players ?? []).map((player) => [player.id, player]));
  const guestsById = new Map(safeMatchGuests.map((guest) => [guest.id, guest]));

  const { data: options, error: optionsError } = await supabase
    .from("team_options")
    .select("*")
    .eq("match_id", matchId)
    .order("option_number", { ascending: true });
  if (optionsError) throw new Error(optionsError.message);

  const optionIds = (options ?? []).map((option) => option.id);
  const [{ data: optionPlayers, error: optionPlayersError }, { data: optionGuests, error: optionGuestsError }] =
    optionIds.length
      ? await Promise.all([
          supabase
            .from("team_option_players")
            .select("team_option_id, player_id, team")
            .in("team_option_id", optionIds),
          supabase
            .from("team_option_guests")
            .select("team_option_id, guest_id, team")
            .in("team_option_id", optionIds)
        ])
      : [{ data: [], error: null }, { data: [], error: null }];
  if (optionPlayersError) throw new Error(optionPlayersError.message);
  if (optionGuestsError && !isGuestSchemaMissing(optionGuestsError)) throw new Error(optionGuestsError.message);
  const safeOptionGuests = optionGuestsError && isGuestSchemaMissing(optionGuestsError) ? [] : optionGuests ?? [];

  const optionsWithPlayers =
    options?.map((option) => {
      const memberPlayers = (optionPlayers ?? []).filter((player) => player.team_option_id === option.id);
      const memberGuests = safeOptionGuests.filter((guest) => guest.team_option_id === option.id);
      const teamAFromPlayers = memberPlayers
        .filter((member) => member.team === "A")
        .map((member) => playersById.get(member.player_id))
        .filter(notNull)
        .map((player) => ({ ...player, is_guest: false }));
      const teamAFromGuests = memberGuests
        .filter((member) => member.team === "A")
        .map((member) => guestsById.get(member.guest_id))
        .filter(notNull)
        .map((guest) => ({
          id: guest.id,
          full_name: guest.guest_name,
          current_rating: Number(guest.guest_rating),
          is_guest: true
        }));
      const teamBFromPlayers = memberPlayers
        .filter((member) => member.team === "B")
        .map((member) => playersById.get(member.player_id))
        .filter(notNull)
        .map((player) => ({ ...player, is_guest: false }));
      const teamBFromGuests = memberGuests
        .filter((member) => member.team === "B")
        .map((member) => guestsById.get(member.guest_id))
        .filter(notNull)
        .map((guest) => ({
          id: guest.id,
          full_name: guest.guest_name,
          current_rating: Number(guest.guest_rating),
          is_guest: true
        }));

      const teamA = [...teamAFromPlayers, ...teamAFromGuests];
      const teamB = [...teamBFromPlayers, ...teamBFromGuests];

      return {
        ...option,
        teamA,
        teamB
      };
    }) ?? [];

  const { data: result, error: resultError } = await supabase
    .from("match_result")
    .select("*")
    .eq("match_id", matchId)
    .maybeSingle();
  if (resultError) throw new Error(resultError.message);

  const rosterPlayers = (matchPlayers ?? [])
    .map((row) => playersById.get(row.player_id))
    .filter((player): player is NonNullable<typeof player> => Boolean(player))
    .map((player) => ({ ...player, is_guest: false }));
  const rosterGuests = safeMatchGuests.map((guest) => ({
    id: guest.id,
    full_name: guest.guest_name,
    current_rating: Number(guest.guest_rating),
    is_guest: true
  }));
  const roster = [...rosterPlayers, ...rosterGuests];

  return {
    match,
    roster,
    options: optionsWithPlayers,
    result
  };
}

type OrgPlayersAggregate = {
  total: number;
  active: number;
  inactive: number;
};

type OrgMatchesAggregate = {
  total: number;
  draft: number;
  confirmed: number;
  finished: number;
  cancelled: number;
};

export type SuperAdminDashboardMetrics = {
  generatedAt: string;
  totals: {
    organizations: number;
    admins: number;
    orgAdminMemberships: number;
    pendingInvites: number;
    players: number;
    activePlayers: number;
    inactivePlayers: number;
    matches: number;
    draftMatches: number;
    confirmedMatches: number;
    finishedMatches: number;
    cancelledMatches: number;
    matchResults: number;
    matchGuests: number;
  };
  derived: {
    avgPlayersPerOrganization: number;
    avgMatchesPerOrganization: number;
    completionRatePercent: number;
    organizationsWithoutPlayers: number;
    organizationsWithoutAdmins: number;
  };
  last30Days: {
    organizationsCreated: number;
    playersCreated: number;
    matchesCreated: number;
    matchesFinished: number;
  };
  organizationsBreakdown: Array<{
    id: string;
    name: string;
    slug: string;
    players: number;
    activePlayers: number;
    matches: number;
    finishedMatches: number;
    admins: number;
    pendingInvites: number;
    createdAt: string;
  }>;
  topOrganizations: Array<{
    id: string;
    name: string;
    slug: string;
    players: number;
    activePlayers: number;
    matches: number;
    finishedMatches: number;
    admins: number;
    pendingInvites: number;
    createdAt: string;
  }>;
};

function isRecentDate(value: string | null | undefined, sinceDate: Date) {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed >= sinceDate;
}

function formatMetricNumber(value: number) {
  return Number(value.toFixed(2));
}

export async function getSuperAdminDashboardMetrics(): Promise<SuperAdminDashboardMetrics> {
  const supabase = await createSupabaseServerClient();
  const generatedAt = new Date().toISOString();
  const sinceDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    { data: organizations, error: organizationsError },
    { data: players, error: playersError },
    { data: matches, error: matchesError },
    { data: orgAdmins, error: orgAdminsError },
    { data: pendingInvites, error: pendingInvitesError },
    { count: adminsCount, error: adminsCountError },
    { count: resultsCount, error: resultsCountError },
    { count: guestsCount, error: guestsCountError }
  ] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, slug, created_at")
      .order("created_at", { ascending: true }),
    supabase.from("players").select("id, organization_id, active, created_at"),
    supabase.from("matches").select("id, organization_id, status, created_at, finished_at"),
    supabase.from("organization_admins").select("organization_id"),
    supabase
      .from("organization_invites")
      .select("organization_id")
      .eq("status", "pending"),
    supabase.from("admins").select("id", { count: "exact", head: true }),
    supabase.from("match_result").select("id", { count: "exact", head: true }),
    supabase.from("match_guests").select("id", { count: "exact", head: true })
  ]);

  if (organizationsError) throw new Error(organizationsError.message);
  if (playersError) throw new Error(playersError.message);
  if (matchesError) throw new Error(matchesError.message);
  if (orgAdminsError) throw new Error(orgAdminsError.message);
  if (pendingInvitesError) throw new Error(pendingInvitesError.message);
  if (adminsCountError) throw new Error(adminsCountError.message);
  if (resultsCountError) throw new Error(resultsCountError.message);
  if (guestsCountError) throw new Error(guestsCountError.message);

  const safeOrganizations = organizations ?? [];
  const safePlayers = players ?? [];
  const safeMatches = matches ?? [];
  const safeOrgAdmins = orgAdmins ?? [];
  const safePendingInvites = pendingInvites ?? [];

  const playersByOrg = new Map<string, OrgPlayersAggregate>();
  for (const player of safePlayers) {
    const current = playersByOrg.get(player.organization_id) ?? { total: 0, active: 0, inactive: 0 };
    current.total += 1;
    if (player.active) current.active += 1;
    else current.inactive += 1;
    playersByOrg.set(player.organization_id, current);
  }

  const matchesByOrg = new Map<string, OrgMatchesAggregate>();
  for (const match of safeMatches) {
    const current = matchesByOrg.get(match.organization_id) ?? {
      total: 0,
      draft: 0,
      confirmed: 0,
      finished: 0,
      cancelled: 0
    };

    current.total += 1;
    if (match.status === "draft") current.draft += 1;
    if (match.status === "confirmed") current.confirmed += 1;
    if (match.status === "finished") current.finished += 1;
    if (match.status === "cancelled") current.cancelled += 1;
    matchesByOrg.set(match.organization_id, current);
  }

  const adminsByOrg = new Map<string, number>();
  for (const relation of safeOrgAdmins) {
    adminsByOrg.set(relation.organization_id, (adminsByOrg.get(relation.organization_id) ?? 0) + 1);
  }

  const pendingInvitesByOrg = new Map<string, number>();
  for (const invite of safePendingInvites) {
    pendingInvitesByOrg.set(invite.organization_id, (pendingInvitesByOrg.get(invite.organization_id) ?? 0) + 1);
  }

  const totalOrganizations = safeOrganizations.length;
  const totalPlayers = safePlayers.length;
  const totalActivePlayers = safePlayers.filter((player) => player.active).length;
  const totalInactivePlayers = totalPlayers - totalActivePlayers;

  const totalMatches = safeMatches.length;
  const totalDraftMatches = safeMatches.filter((match) => match.status === "draft").length;
  const totalConfirmedMatches = safeMatches.filter((match) => match.status === "confirmed").length;
  const totalFinishedMatches = safeMatches.filter((match) => match.status === "finished").length;
  const totalCancelledMatches = safeMatches.filter((match) => match.status === "cancelled").length;

  const organizationsWithoutPlayers = safeOrganizations.filter((organization) => {
    const orgPlayers = playersByOrg.get(organization.id);
    return !orgPlayers || orgPlayers.total === 0;
  }).length;

  const organizationsWithoutAdmins = safeOrganizations.filter((organization) => {
    const orgAdminsCount = adminsByOrg.get(organization.id) ?? 0;
    return orgAdminsCount === 0;
  }).length;

  const organizationsBreakdown = safeOrganizations
    .map((organization) => {
      const orgPlayers = playersByOrg.get(organization.id) ?? { total: 0, active: 0, inactive: 0 };
      const orgMatches = matchesByOrg.get(organization.id) ?? {
        total: 0,
        draft: 0,
        confirmed: 0,
        finished: 0,
        cancelled: 0
      };

      return {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        players: orgPlayers.total,
        activePlayers: orgPlayers.active,
        matches: orgMatches.total,
        finishedMatches: orgMatches.finished,
        admins: adminsByOrg.get(organization.id) ?? 0,
        pendingInvites: pendingInvitesByOrg.get(organization.id) ?? 0,
        createdAt: organization.created_at
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  const topOrganizations = [...organizationsBreakdown]
    .sort((a, b) => b.players - a.players || b.matches - a.matches || a.name.localeCompare(b.name, "es"))
    .slice(0, 10);

  return {
    generatedAt,
    totals: {
      organizations: totalOrganizations,
      admins: adminsCount ?? 0,
      orgAdminMemberships: safeOrgAdmins.length,
      pendingInvites: safePendingInvites.length,
      players: totalPlayers,
      activePlayers: totalActivePlayers,
      inactivePlayers: totalInactivePlayers,
      matches: totalMatches,
      draftMatches: totalDraftMatches,
      confirmedMatches: totalConfirmedMatches,
      finishedMatches: totalFinishedMatches,
      cancelledMatches: totalCancelledMatches,
      matchResults: resultsCount ?? 0,
      matchGuests: guestsCount ?? 0
    },
    derived: {
      avgPlayersPerOrganization: totalOrganizations ? formatMetricNumber(totalPlayers / totalOrganizations) : 0,
      avgMatchesPerOrganization: totalOrganizations ? formatMetricNumber(totalMatches / totalOrganizations) : 0,
      completionRatePercent: totalMatches ? formatMetricNumber((totalFinishedMatches / totalMatches) * 100) : 0,
      organizationsWithoutPlayers,
      organizationsWithoutAdmins
    },
    last30Days: {
      organizationsCreated: safeOrganizations.filter((organization) => isRecentDate(organization.created_at, sinceDate))
        .length,
      playersCreated: safePlayers.filter((player) => isRecentDate(player.created_at, sinceDate)).length,
      matchesCreated: safeMatches.filter((match) => isRecentDate(match.created_at, sinceDate)).length,
      matchesFinished: safeMatches.filter((match) => isRecentDate(match.finished_at, sinceDate)).length
    },
    organizationsBreakdown,
    topOrganizations
  };
}
