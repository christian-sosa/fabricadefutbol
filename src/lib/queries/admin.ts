import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getOrganizationTrialEndsAt,
  hasActiveOrganizationSubscription,
  isIsoDateExpired
} from "@/lib/domain/billing";
import { cleanupStalePendingOrganizationBillingPayments } from "@/lib/domain/billing-workflow";
import { calculateGuestDisplayRating } from "@/lib/domain/skill-level";
import {
  countPendingInvitesByOrganization,
  fetchPendingInvitesForOrganization
} from "@/lib/queries/invites";
import { unstable_noStore as noStore } from "next/cache";

function notNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

const BUSINESS_METRICS_TIME_ZONE = "America/Buenos_Aires";

type OrganizationCommercialStatus = "paid_active" | "free_trial" | "expired_without_plan";

function normalizeBillingPaymentStatus(status: string | null | undefined) {
  return (status ?? "unknown").toLowerCase();
}

function getYearMonthKeyInTimeZone(isoDate: string, timeZone = BUSINESS_METRICS_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit"
  }).formatToParts(new Date(isoDate));

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return year && month ? `${year}-${month}` : null;
}

function formatMonthLabel(date: Date, timeZone = BUSINESS_METRICS_TIME_ZONE) {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone,
    month: "long",
    year: "numeric"
  }).format(date);
}

function getOrganizationCommercialStatus(params: {
  organizationCreatedAt: string;
  subscription: { status: string | null; current_period_end: string | null } | null | undefined;
}): OrganizationCommercialStatus {
  const { organizationCreatedAt, subscription } = params;
  if (hasActiveOrganizationSubscription(subscription)) {
    return "paid_active";
  }

  const trialEndsAt = getOrganizationTrialEndsAt(organizationCreatedAt);
  if (!isIsoDateExpired(trialEndsAt)) {
    return "free_trial";
  }

  return "expired_without_plan";
}

function isGuestSchemaMissing(error: { message: string } | null) {
  if (!error) return false;
  return /match_guests|team_option_guests/i.test(error.message);
}

function isBillingSchemaMissing(error: { message: string } | null) {
  if (!error) return false;
  return /organization_billing_subscriptions|organization_billing_payments|requested_organization_name|requested_organization_slug|created_organization_id|purpose/i.test(
    error.message
  );
}

export async function getAdminDashboardData(organizationId: string) {
  const supabase = await createSupabaseServerClient();

  const [
    { count: draftsCount, error: draftsError },
    { count: confirmedCount, error: confirmedError },
    { count: finishedCount, error: finishedError },
    { count: playersCount, error: playersError },
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
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("active", true),
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
  if (playersError) throw new Error(playersError.message);
  if (latestMatchesError) throw new Error(latestMatchesError.message);

  return {
    draftsCount: draftsCount ?? 0,
    confirmedCount: confirmedCount ?? 0,
    finishedCount: finishedCount ?? 0,
    playersCount: playersCount ?? 0,
    latestMatches: latestMatches ?? []
  };
}

export async function getAdminMatches(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("matches")
    .select("id, scheduled_at, modality, status, location")
    .eq("organization_id", organizationId)
    .order("scheduled_at", { ascending: false });

  if (error) throw new Error(error.message);

  return data ?? [];
}

export async function getOrganizationAdminData(organizationId: string) {
  const supabase = await createSupabaseServerClient();

  const [{ data: adminsData, error: adminsError }, invitesData] = await Promise.all([
    supabase
      .from("organization_admins")
      .select("id, admin_id, created_at, admins!organization_admins_admin_id_fkey(id, display_name)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true }),
    fetchPendingInvitesForOrganization(supabase, organizationId)
  ]);

  if (adminsError) throw new Error(adminsError.message);

  const adminClient = createSupabaseAdminClient();
  const adminEmailsById = new Map<string, string>();
  if (adminClient) {
    const uniqueAdminIds = Array.from(
      new Set((adminsData ?? []).map((row) => row.admin_id).filter(Boolean))
    ) as string[];
    // Paralelizamos las llamadas a Auth API para evitar el patron N+1 serial.
    const resolved = await Promise.all(
      uniqueAdminIds.map(async (adminId) => {
        try {
          const { data } = await adminClient.auth.admin.getUserById(adminId);
          return [adminId, data?.user?.email?.toLowerCase() ?? null] as const;
        } catch {
          return [adminId, null] as const;
        }
      })
    );
    for (const [adminId, email] of resolved) {
      if (email) adminEmailsById.set(adminId, email);
    }
  }

  const admins = (adminsData ?? []).map((row) => {
    const relation = row.admins;
    const adminRow = Array.isArray(relation) ? relation[0] : relation;

    return {
      id: row.admin_id,
      displayName: adminRow?.display_name ?? "Admin",
      email: adminEmailsById.get(row.admin_id) ?? null,
      createdAt: row.created_at
    };
  });

  const pendingInvites = invitesData.map((row) => ({
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
  noStore();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("organization_id", organizationId)
    .order("skill_level", { ascending: true })
    .order("display_order", { ascending: true })
    .order("full_name", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSelectablePlayers(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("players")
    .select("id, full_name, current_rating, initial_rank, skill_level, display_order")
    .eq("organization_id", organizationId)
    .eq("active", true)
    .order("skill_level", { ascending: true })
    .order("display_order", { ascending: true })
    .order("full_name", { ascending: true });
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
  const playerIds = Array.from(new Set((optionPlayers ?? []).map((row) => row.player_id)));
  const guestIds = Array.from(new Set(safeOptionGuests.map((row) => row.guest_id)));

  const { data: players, error: playersError } = playerIds.length
    ? await supabase
        .from("players")
        .select("id, full_name, current_rating")
        .eq("organization_id", organizationId)
        .in("id", playerIds)
    : { data: [], error: null };
  if (playersError) throw new Error(playersError.message);

  const { data: guests, error: guestsError } = guestIds.length
    ? await supabase
        .from("match_guests")
        .select("id, guest_name, guest_rating")
        .in("id", guestIds)
    : { data: [], error: null };
  if (guestsError && !isGuestSchemaMissing(guestsError)) throw new Error(guestsError.message);
  const safeGuests = guestsError && isGuestSchemaMissing(guestsError) ? [] : guests ?? [];

  const playersById = new Map((players ?? []).map((player) => [player.id, player]));
  const guestsById = new Map(safeGuests.map((guest) => [guest.id, guest]));

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
          current_rating: calculateGuestDisplayRating(guest.guest_rating),
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
          current_rating: calculateGuestDisplayRating(guest.guest_rating),
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

  return {
    match,
    options: optionsWithPlayers,
    result
  };
}

export async function getOrganizationBillingData(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const supabaseAdmin = createSupabaseAdminClient();

  if (supabaseAdmin) {
    try {
      await cleanupStalePendingOrganizationBillingPayments({
        supabase: supabaseAdmin,
        organizationId
      });
    } catch (error) {
      console.error("[billing] no se pudieron limpiar pagos pendientes vencidos", {
        organizationId,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const [{ data: subscription, error: subscriptionError }, { data: payments, error: paymentsError }] =
    await Promise.all([
      supabase
        .from("organization_billing_subscriptions")
        .select(
          "id, organization_id, status, current_period_start, current_period_end, last_payment_at, created_at, updated_at"
        )
        .eq("organization_id", organizationId)
        .maybeSingle(),
      supabase
        .from("organization_billing_payments")
        .select(
          "id, purpose, status, amount, currency_id, mp_payment_id, mp_preference_id, mp_external_reference, approved_at, period_start, period_end, created_at, created_organization_id"
        )
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(20)
    ]);

  if (subscriptionError && !isBillingSchemaMissing(subscriptionError)) {
    throw new Error(subscriptionError.message);
  }
  if (paymentsError && !isBillingSchemaMissing(paymentsError)) {
    throw new Error(paymentsError.message);
  }

  return {
    subscription:
      subscriptionError && isBillingSchemaMissing(subscriptionError) ? null : subscription ?? null,
    payments: paymentsError && isBillingSchemaMissing(paymentsError) ? [] : payments ?? []
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
  currentMonth: {
    label: string;
    timezone: string;
    approvedRevenueArs: number;
    approvedPayments: number;
    organizationsWithApprovedPayments: number;
  };
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
  business: {
    activePaidOrganizations: number;
    freeTrialOrganizations: number;
    expiredWithoutPlanOrganizations: number;
    organizationsWithAnyApprovedPayment: number;
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
    commercialStatus: OrganizationCommercialStatus;
    trialEndsAt: string;
    subscriptionCurrentPeriodEnd: string | null;
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
    commercialStatus: OrganizationCommercialStatus;
    trialEndsAt: string;
    subscriptionCurrentPeriodEnd: string | null;
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
    { data: subscriptions, error: subscriptionsError },
    { data: billingPayments, error: billingPaymentsError },
    { data: orgAdmins, error: orgAdminsError },
    pendingInvites,
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
    supabase
      .from("organization_billing_subscriptions")
      .select("organization_id, status, current_period_end"),
    supabase
      .from("organization_billing_payments")
      .select("organization_id, status, amount, approved_at"),
    supabase.from("organization_admins").select("organization_id"),
    countPendingInvitesByOrganization(supabase),
    supabase.from("admins").select("id", { count: "exact", head: true }),
    supabase.from("match_result").select("id", { count: "exact", head: true }),
    supabase.from("match_guests").select("id", { count: "exact", head: true })
  ]);

  if (organizationsError) throw new Error(organizationsError.message);
  if (playersError) throw new Error(playersError.message);
  if (matchesError) throw new Error(matchesError.message);
  if (subscriptionsError && !isBillingSchemaMissing(subscriptionsError)) {
    throw new Error(subscriptionsError.message);
  }
  if (billingPaymentsError && !isBillingSchemaMissing(billingPaymentsError)) {
    throw new Error(billingPaymentsError.message);
  }
  if (orgAdminsError) throw new Error(orgAdminsError.message);
  if (adminsCountError) throw new Error(adminsCountError.message);
  if (resultsCountError) throw new Error(resultsCountError.message);
  if (guestsCountError) throw new Error(guestsCountError.message);

  const safeOrganizations = organizations ?? [];
  const safePlayers = players ?? [];
  const safeMatches = matches ?? [];
  const safeSubscriptions =
    subscriptionsError && isBillingSchemaMissing(subscriptionsError) ? [] : subscriptions ?? [];
  const safeBillingPayments =
    billingPaymentsError && isBillingSchemaMissing(billingPaymentsError) ? [] : billingPayments ?? [];
  const safeOrgAdmins = orgAdmins ?? [];
  const safePendingInvites = pendingInvites;

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

  const subscriptionsByOrg = new Map(
    safeSubscriptions.map((subscription) => [subscription.organization_id, subscription])
  );

  const currentMonthLabel = formatMonthLabel(new Date());
  const currentMonthKey = getYearMonthKeyInTimeZone(generatedAt);
  const approvedPayments = safeBillingPayments.filter(
    (payment) =>
      normalizeBillingPaymentStatus(payment.status) === "approved" &&
      typeof payment.approved_at === "string" &&
      payment.approved_at.length > 0
  );
  const approvedPaymentsThisMonth = approvedPayments.filter(
    (payment) => payment.approved_at && getYearMonthKeyInTimeZone(payment.approved_at) === currentMonthKey
  );
  const organizationsWithAnyApprovedPayment = new Set(
    approvedPayments.map((payment) => payment.organization_id).filter(Boolean)
  ).size;
  const organizationsWithApprovedPaymentsThisMonth = new Set(
    approvedPaymentsThisMonth.map((payment) => payment.organization_id).filter(Boolean)
  ).size;
  const approvedRevenueThisMonth = approvedPaymentsThisMonth.reduce(
    (sum, payment) => sum + Number(payment.amount ?? 0),
    0
  );

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

  let activePaidOrganizations = 0;
  let freeTrialOrganizations = 0;
  let expiredWithoutPlanOrganizations = 0;

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
      const subscription = subscriptionsByOrg.get(organization.id) ?? null;
      const commercialStatus = getOrganizationCommercialStatus({
        organizationCreatedAt: organization.created_at,
        subscription
      });
      const trialEndsAt = getOrganizationTrialEndsAt(organization.created_at);

      if (commercialStatus === "paid_active") activePaidOrganizations += 1;
      if (commercialStatus === "free_trial") freeTrialOrganizations += 1;
      if (commercialStatus === "expired_without_plan") expiredWithoutPlanOrganizations += 1;

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
        commercialStatus,
        trialEndsAt,
        subscriptionCurrentPeriodEnd: subscription?.current_period_end ?? null,
        createdAt: organization.created_at
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  const topOrganizations = [...organizationsBreakdown]
    .sort((a, b) => b.players - a.players || b.matches - a.matches || a.name.localeCompare(b.name, "es"))
    .slice(0, 10);

  return {
    generatedAt,
    currentMonth: {
      label: currentMonthLabel,
      timezone: BUSINESS_METRICS_TIME_ZONE,
      approvedRevenueArs: formatMetricNumber(approvedRevenueThisMonth),
      approvedPayments: approvedPaymentsThisMonth.length,
      organizationsWithApprovedPayments: organizationsWithApprovedPaymentsThisMonth
    },
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
    business: {
      activePaidOrganizations,
      freeTrialOrganizations,
      expiredWithoutPlanOrganizations,
      organizationsWithAnyApprovedPayment
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
