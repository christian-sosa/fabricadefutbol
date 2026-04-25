import { slugifyOrganizationName } from "@/lib/org";

type TableName =
  | "admins"
  | "organizations"
  | "organization_admins"
  | "organization_invites"
  | "organization_billing_payments"
  | "organization_billing_subscriptions"
  | "leagues"
  | "league_admins"
  | "league_admin_invites"
  | "league_billing_subscriptions"
  | "league_billing_payments"
  | "league_teams"
  | "competitions"
  | "competition_teams"
  | "competition_team_captains"
  | "competition_captain_invites"
  | "competition_team_players"
  | "player_photo_upload_events"
  | "competition_rounds"
  | "competition_byes"
  | "competition_matches"
  | "competition_match_results"
  | "competition_match_player_stats"
  | "players"
  | "matches"
  | "match_players"
  | "match_guests"
  | "team_options"
  | "team_option_players"
  | "team_option_guests"
  | "match_result"
  | "rating_history"
  | "match_player_stats"
  | "organization_public_snapshots";

type Row = Record<string, unknown>;
type QueryError = { message: string };
type QueryResult<T> = Promise<{
  data: T;
  error: QueryError | null;
  count?: number | null;
}>;
type QueryFailureConfig = Partial<Record<QueryMode, string>>;

type FakeDatabase = Record<TableName, Row[]>;
type QueryMode = "select" | "insert" | "update" | "upsert" | "delete";
type Cardinality = "many" | "single" | "maybeSingle";
type Filter = (row: Row) => boolean;

type SeedInput = Partial<{
  [Key in TableName]: Row[];
}> & {
  authUser?: {
    id: string;
    email?: string | null;
  } | null;
  queryFailures?: Partial<Record<TableName, QueryFailureConfig>>;
};

function cloneRow<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createEmptyDatabase(): FakeDatabase {
  return {
    admins: [],
    organizations: [],
    organization_admins: [],
    organization_invites: [],
    organization_billing_payments: [],
    organization_billing_subscriptions: [],
    leagues: [],
    league_admins: [],
    league_admin_invites: [],
    league_billing_subscriptions: [],
    league_billing_payments: [],
    league_teams: [],
    competitions: [],
    competition_teams: [],
    competition_team_captains: [],
    competition_captain_invites: [],
    competition_team_players: [],
    player_photo_upload_events: [],
    competition_rounds: [],
    competition_byes: [],
    competition_matches: [],
    competition_match_results: [],
    competition_match_player_stats: [],
    players: [],
    matches: [],
    match_players: [],
    match_guests: [],
    team_options: [],
    team_option_players: [],
    team_option_guests: [],
    match_result: [],
    rating_history: [],
    match_player_stats: [],
    organization_public_snapshots: []
  };
}

function createUuid(counter: number) {
  return `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`;
}

function applyDefaults(table: TableName, row: Row, nextId: () => string): Row {
  const now = new Date().toISOString();
  const normalized: Row = {
    ...row
  };

  if (!normalized.id) {
    normalized.id = nextId();
  }
  if (!normalized.created_at) {
    normalized.created_at = now;
  }

  switch (table) {
    case "organizations":
      if (!("image_path" in normalized)) normalized.image_path = null;
      if (!("player_photos_purge_at" in normalized)) normalized.player_photos_purge_at = null;
      if (!("player_photos_purged_at" in normalized)) normalized.player_photos_purged_at = null;
      if (!("is_public" in normalized)) normalized.is_public = true;
      if (!normalized.updated_at) normalized.updated_at = now;
      break;
    case "organization_billing_subscriptions":
      if (!normalized.status) normalized.status = "active";
      if (!normalized.updated_at) normalized.updated_at = now;
      break;
    case "organization_billing_payments":
      if (!normalized.status) normalized.status = "pending";
      if (!normalized.purpose) normalized.purpose = "organization_subscription";
      if (!normalized.updated_at) normalized.updated_at = now;
      if (!("subscription_applied_at" in normalized)) normalized.subscription_applied_at = null;
      break;
    case "leagues":
      if (!("description" in normalized)) normalized.description = null;
      if (!("logo_path" in normalized)) normalized.logo_path = null;
      if (!("photo_path" in normalized)) normalized.photo_path = null;
      if (!("venue_name" in normalized)) normalized.venue_name = null;
      if (!("location_notes" in normalized)) normalized.location_notes = null;
      if (!("is_public" in normalized)) normalized.is_public = true;
      if (!normalized.status) normalized.status = "draft";
      if (!normalized.updated_at) normalized.updated_at = now;
      break;
    case "league_admins":
      if (!normalized.role) normalized.role = "editor";
      if (!("created_by" in normalized)) normalized.created_by = null;
      break;
    case "league_admin_invites":
      if (!normalized.invite_token) normalized.invite_token = nextId();
      if (!normalized.status) normalized.status = "pending";
      if (!("accepted_by" in normalized)) normalized.accepted_by = null;
      if (!("accepted_at" in normalized)) normalized.accepted_at = null;
      if (!normalized.expires_at) {
        normalized.expires_at = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
      }
      break;
    case "league_billing_subscriptions":
      if (!normalized.status) normalized.status = "active";
      if (!("current_period_start" in normalized)) normalized.current_period_start = null;
      if (!("current_period_end" in normalized)) normalized.current_period_end = null;
      if (!("last_payment_at" in normalized)) normalized.last_payment_at = null;
      if (!normalized.updated_at) normalized.updated_at = now;
      break;
    case "league_billing_payments":
      if (!normalized.status) normalized.status = "pending";
      if (!normalized.purpose) normalized.purpose = "league_creation";
      if (!("approved_at" in normalized)) normalized.approved_at = null;
      if (!("period_start" in normalized)) normalized.period_start = null;
      if (!("period_end" in normalized)) normalized.period_end = null;
      if (!("subscription_applied_at" in normalized)) normalized.subscription_applied_at = null;
      if (!("created_league_id" in normalized)) normalized.created_league_id = null;
      if (!normalized.updated_at) normalized.updated_at = now;
      break;
    case "league_teams":
      if (!("short_name" in normalized)) normalized.short_name = null;
      if (!("logo_path" in normalized)) normalized.logo_path = null;
      if (!("notes" in normalized)) normalized.notes = null;
      if (!normalized.updated_at) normalized.updated_at = now;
      break;
    case "competitions":
      if (!("description" in normalized)) normalized.description = null;
      if (!("venue_override" in normalized)) normalized.venue_override = null;
      if (!("type" in normalized)) normalized.type = "league";
      if (!("coverage_mode" in normalized)) normalized.coverage_mode = "full_stats";
      if (!("playoff_size" in normalized)) normalized.playoff_size = null;
      if (!("is_public" in normalized)) normalized.is_public = true;
      if (!normalized.status) normalized.status = "draft";
      if (!normalized.updated_at) normalized.updated_at = now;
      break;
    case "competition_teams":
      if (!("short_name" in normalized)) normalized.short_name = null;
      if (!("logo_path" in normalized)) normalized.logo_path = null;
      if (!("notes" in normalized)) normalized.notes = null;
      break;
    case "competition_team_captains":
      if (!("created_by" in normalized)) normalized.created_by = null;
      break;
    case "competition_captain_invites":
      if (!normalized.invite_token) normalized.invite_token = nextId();
      if (!normalized.expires_at) {
        normalized.expires_at = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
      }
      break;
    case "competition_team_players":
      if (!("shirt_number" in normalized)) normalized.shirt_number = null;
      if (!("position" in normalized)) normalized.position = null;
      if (!("active" in normalized)) normalized.active = true;
      if (!normalized.updated_at) normalized.updated_at = now;
      break;
    case "player_photo_upload_events":
      break;
    case "competition_rounds":
      if (!("phase" in normalized)) normalized.phase = "league";
      if (!("stage_label" in normalized)) normalized.stage_label = normalized.name ?? null;
      if (!("starts_at" in normalized)) normalized.starts_at = null;
      if (!("ends_at" in normalized)) normalized.ends_at = null;
      if (!normalized.updated_at) normalized.updated_at = now;
      break;
    case "competition_byes":
      if (!("phase" in normalized)) normalized.phase = "league";
      if (!("kind" in normalized)) normalized.kind = "free_round";
      if (!("note" in normalized)) normalized.note = null;
      break;
    case "competition_matches":
      if (!("round_id" in normalized)) normalized.round_id = null;
      if (!("phase" in normalized)) normalized.phase = "league";
      if (!("stage_label" in normalized)) normalized.stage_label = null;
      if (!("scheduled_at" in normalized)) normalized.scheduled_at = null;
      if (!("venue" in normalized)) normalized.venue = null;
      if (!normalized.status) normalized.status = "draft";
      if (!normalized.updated_at) normalized.updated_at = now;
      break;
    case "competition_match_results":
      if (!("penalty_home_score" in normalized)) normalized.penalty_home_score = null;
      if (!("penalty_away_score" in normalized)) normalized.penalty_away_score = null;
      if (!("winner_team_id" in normalized)) normalized.winner_team_id = null;
      if (!("mvp_player_id" in normalized)) normalized.mvp_player_id = null;
      if (!("mvp_player_name" in normalized)) normalized.mvp_player_name = null;
      if (!("notes" in normalized)) normalized.notes = null;
      if (!normalized.updated_at) normalized.updated_at = now;
      break;
    case "competition_match_player_stats":
      if (!("player_id" in normalized)) normalized.player_id = null;
      if (!("goals" in normalized)) normalized.goals = 0;
      if (!("yellow_cards" in normalized)) normalized.yellow_cards = 0;
      if (!("red_cards" in normalized)) normalized.red_cards = 0;
      if (!("is_mvp" in normalized)) normalized.is_mvp = false;
      if (!normalized.updated_at) normalized.updated_at = now;
      break;
    case "players":
      if (!("skill_level" in normalized)) normalized.skill_level = 3;
      if (!("display_order" in normalized)) normalized.display_order = normalized.initial_rank ?? 1;
      if (!("current_rating" in normalized)) normalized.current_rating = 1000;
      if (!("active" in normalized)) normalized.active = true;
      if (!normalized.updated_at) normalized.updated_at = now;
      break;
    case "matches":
      if (!normalized.status) normalized.status = "draft";
      if (!("confirmed_option_id" in normalized)) normalized.confirmed_option_id = null;
      if (!("finished_at" in normalized)) normalized.finished_at = null;
      if (!normalized.updated_at) normalized.updated_at = now;
      break;
    case "team_options":
      if (!("is_confirmed" in normalized)) normalized.is_confirmed = false;
      break;
    case "match_result":
      if (!normalized.updated_at) normalized.updated_at = now;
      break;
    case "organization_public_snapshots":
      if (!("summary" in normalized)) normalized.summary = {};
      if (!("standings" in normalized)) normalized.standings = [];
      if (!("match_history" in normalized)) normalized.match_history = [];
      if (!("match_history_total_count" in normalized)) normalized.match_history_total_count = 0;
      if (!normalized.refreshed_at) normalized.refreshed_at = now;
      if (!normalized.updated_at) normalized.updated_at = now;
      break;
    default:
      break;
  }

  return normalized;
}

function compareValues(left: unknown, right: unknown) {
  if (left === right) return 0;
  if (left === undefined || left === null) return -1;
  if (right === undefined || right === null) return 1;
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  return String(left).localeCompare(String(right));
}

class FakeSupabaseState {
  readonly db: FakeDatabase;
  private idCounter = 1;
  private authUser: SeedInput["authUser"] = null;
  private queryFailures: SeedInput["queryFailures"] = {};

  constructor(seed: SeedInput = {}) {
    this.db = createEmptyDatabase();
    this.authUser = seed.authUser ?? null;
    this.queryFailures = seed.queryFailures ?? {};

    for (const tableName of Object.keys(this.db) as TableName[]) {
      const rows = seed[tableName] ?? [];
      rows.forEach((row) => {
        this.insertRow(tableName, row);
      });
    }
  }

  nextId() {
    return createUuid(this.idCounter++);
  }

  getAuthUser() {
    return this.authUser;
  }

  getTable(table: TableName) {
    return this.db[table];
  }

  getQueryFailure(table: TableName, mode: QueryMode) {
    return this.queryFailures?.[table]?.[mode] ?? null;
  }

  insertRow(table: TableName, row: Row) {
    if (table === "league_admins") {
      const leagueId = String(row.league_id ?? "");
      const adminId = String(row.admin_id ?? "");
      const existing = this.db.league_admins.find(
        (candidate) => String(candidate.league_id) === leagueId && String(candidate.admin_id) === adminId
      );

      if (existing) {
        Object.assign(existing, cloneRow(row));
        return existing;
      }
    }

    if (table === "competition_team_captains") {
      const competitionTeamId = String(row.competition_team_id ?? "");
      const competitionId = String(row.competition_id ?? "");
      const captainId = String(row.captain_id ?? "");
      const existing = this.db.competition_team_captains.find(
        (candidate) =>
          String(candidate.competition_team_id) === competitionTeamId ||
          (String(candidate.competition_id) === competitionId && String(candidate.captain_id) === captainId)
      );

      if (existing) {
        Object.assign(existing, cloneRow(row));
        return existing;
      }
    }

    if (table === "league_admin_invites") {
      const leagueId = String(row.league_id ?? "");
      const email = String(row.email ?? "").toLowerCase();
      const status = String(row.status ?? "pending").toLowerCase();
      const existing = this.db.league_admin_invites.find(
        (candidate) =>
          String(candidate.league_id) === leagueId &&
          String(candidate.email ?? "").toLowerCase() === email &&
          String(candidate.status ?? "pending").toLowerCase() === status
      );

      if (existing) {
        Object.assign(existing, cloneRow(row));
        return existing;
      }
    }

    if (table === "competition_captain_invites") {
      const competitionTeamId = String(row.competition_team_id ?? "");
      const existing = this.db.competition_captain_invites.find(
        (candidate) => String(candidate.competition_team_id) === competitionTeamId
      );

      if (existing) {
        Object.assign(existing, cloneRow(row));
        return existing;
      }
    }

    if (table === "competition_teams") {
      const competitionId = String(row.competition_id ?? "");
      const leagueTeamId = String(row.league_team_id ?? "");
      const existing = this.db.competition_teams.find(
        (candidate) =>
          String(candidate.competition_id) === competitionId &&
          String(candidate.league_team_id) === leagueTeamId
      );

      if (existing) {
        Object.assign(existing, cloneRow(row));
        return existing;
      }
    }

    const normalized = applyDefaults(table, cloneRow(row), () => this.nextId());
    this.db[table].push(normalized);

    if (table === "leagues" && normalized.created_by) {
      const ownerLinkExists = this.db.league_admins.some(
        (candidate) =>
          String(candidate.league_id) === String(normalized.id) &&
          String(candidate.admin_id) === String(normalized.created_by)
      );

      if (!ownerLinkExists) {
        this.insertRow("league_admins", {
          league_id: normalized.id,
          admin_id: normalized.created_by,
          role: "owner",
          created_by: normalized.created_by
        });
      }
    }

    return normalized;
  }

  cascadeDelete(table: TableName, deletedRows: Row[]) {
    if (!deletedRows.length) return;

    if (table === "leagues") {
      const deletedLeagueIds = new Set(deletedRows.map((row) => String(row.id)));
      const deletedCompetitionIds = new Set(
        this.db.competitions
          .filter((row) => deletedLeagueIds.has(String(row.league_id)))
          .map((row) => String(row.id))
      );
      const deletedCompetitionTeamIds = new Set(
        this.db.competition_teams
          .filter((row) => deletedCompetitionIds.has(String(row.competition_id)))
          .map((row) => String(row.id))
      );
      const deletedMatchIds = new Set(
        this.db.competition_matches
          .filter((row) => deletedCompetitionIds.has(String(row.competition_id)))
          .map((row) => String(row.id))
      );

      this.db.league_admins = this.db.league_admins.filter(
        (row) => !deletedLeagueIds.has(String(row.league_id))
      );
      this.db.league_admin_invites = this.db.league_admin_invites.filter(
        (row) => !deletedLeagueIds.has(String(row.league_id))
      );
      this.db.league_billing_subscriptions = this.db.league_billing_subscriptions.filter(
        (row) => !deletedLeagueIds.has(String(row.league_id))
      );
      this.db.league_teams = this.db.league_teams.filter(
        (row) => !deletedLeagueIds.has(String(row.league_id))
      );
      this.db.competition_team_captains = this.db.competition_team_captains.filter(
        (row) => !deletedCompetitionIds.has(String(row.competition_id))
      );
      this.db.competition_captain_invites = this.db.competition_captain_invites.filter(
        (row) => !deletedCompetitionIds.has(String(row.competition_id))
      );
      this.db.competition_team_players = this.db.competition_team_players.filter(
        (row) => !deletedCompetitionTeamIds.has(String(row.competition_team_id))
      );
      this.db.competition_byes = this.db.competition_byes.filter(
        (row) => !deletedCompetitionIds.has(String(row.competition_id))
      );
      this.db.competition_rounds = this.db.competition_rounds.filter(
        (row) => !deletedCompetitionIds.has(String(row.competition_id))
      );
      this.db.competition_match_results = this.db.competition_match_results.filter(
        (row) => !deletedMatchIds.has(String(row.match_id))
      );
      this.db.competition_match_player_stats = this.db.competition_match_player_stats.filter(
        (row) =>
          !deletedMatchIds.has(String(row.match_id)) &&
          !deletedCompetitionTeamIds.has(String(row.team_id))
      );
      this.db.competition_matches = this.db.competition_matches.filter(
        (row) => !deletedCompetitionIds.has(String(row.competition_id))
      );
      this.db.competition_teams = this.db.competition_teams.filter(
        (row) => !deletedCompetitionIds.has(String(row.competition_id))
      );
      this.db.competitions = this.db.competitions.filter(
        (row) => !deletedLeagueIds.has(String(row.league_id))
      );
      this.db.league_billing_payments = this.db.league_billing_payments.map((row) =>
        deletedLeagueIds.has(String(row.created_league_id))
          ? { ...row, created_league_id: null, updated_at: new Date().toISOString() }
          : row
      );
    }

    if (table === "competitions") {
      const deletedCompetitionIds = new Set(deletedRows.map((row) => String(row.id)));
      const deletedCompetitionTeamIds = new Set(
        this.db.competition_teams
          .filter((row) => deletedCompetitionIds.has(String(row.competition_id)))
          .map((row) => String(row.id))
      );
      const deletedMatchIds = new Set(
        this.db.competition_matches
          .filter((row) => deletedCompetitionIds.has(String(row.competition_id)))
          .map((row) => String(row.id))
      );

      this.db.competition_team_captains = this.db.competition_team_captains.filter(
        (row) => !deletedCompetitionIds.has(String(row.competition_id))
      );
      this.db.competition_captain_invites = this.db.competition_captain_invites.filter(
        (row) => !deletedCompetitionIds.has(String(row.competition_id))
      );
      this.db.competition_team_players = this.db.competition_team_players.filter(
        (row) => !deletedCompetitionTeamIds.has(String(row.competition_team_id))
      );
      this.db.competition_byes = this.db.competition_byes.filter(
        (row) => !deletedCompetitionIds.has(String(row.competition_id))
      );
      this.db.competition_rounds = this.db.competition_rounds.filter(
        (row) => !deletedCompetitionIds.has(String(row.competition_id))
      );
      this.db.competition_match_results = this.db.competition_match_results.filter(
        (row) => !deletedMatchIds.has(String(row.match_id))
      );
      this.db.competition_match_player_stats = this.db.competition_match_player_stats.filter(
        (row) =>
          !deletedMatchIds.has(String(row.match_id)) &&
          !deletedCompetitionTeamIds.has(String(row.team_id))
      );
      this.db.competition_matches = this.db.competition_matches.filter(
        (row) => !deletedCompetitionIds.has(String(row.competition_id))
      );
      this.db.competition_teams = this.db.competition_teams.filter(
        (row) => !deletedCompetitionIds.has(String(row.competition_id))
      );
    }

    if (table === "competition_matches") {
      const deletedMatchIds = new Set(deletedRows.map((row) => String(row.id)));
      this.db.competition_match_results = this.db.competition_match_results.filter(
        (row) => !deletedMatchIds.has(String(row.match_id))
      );
      this.db.competition_match_player_stats = this.db.competition_match_player_stats.filter(
        (row) => !deletedMatchIds.has(String(row.match_id))
      );
    }

    if (table === "competition_teams") {
      const deletedCompetitionTeamIds = new Set(deletedRows.map((row) => String(row.id)));
      this.db.competition_team_players = this.db.competition_team_players.filter(
        (row) => !deletedCompetitionTeamIds.has(String(row.competition_team_id))
      );
      this.db.competition_team_captains = this.db.competition_team_captains.filter(
        (row) => !deletedCompetitionTeamIds.has(String(row.competition_team_id))
      );
      this.db.competition_captain_invites = this.db.competition_captain_invites.filter(
        (row) => !deletedCompetitionTeamIds.has(String(row.competition_team_id))
      );
      this.db.competition_match_player_stats = this.db.competition_match_player_stats.filter(
        (row) => !deletedCompetitionTeamIds.has(String(row.team_id))
      );
      this.db.competition_byes = this.db.competition_byes.filter(
        (row) => !deletedCompetitionTeamIds.has(String(row.competition_team_id))
      );
    }

    if (table === "team_options") {
      const deletedOptionIds = new Set(deletedRows.map((row) => String(row.id)));
      this.db.team_option_players = this.db.team_option_players.filter(
        (row) => !deletedOptionIds.has(String(row.team_option_id))
      );
      this.db.team_option_guests = this.db.team_option_guests.filter(
        (row) => !deletedOptionIds.has(String(row.team_option_id))
      );
    }
  }

  async runRpc(name: string, args: Record<string, unknown>) {
    if (name !== "finalize_organization_creation_payment") {
      return {
        data: null,
        error: { message: `RPC no soportada en fake: ${name}` }
      };
    }

    const paymentId = String(args.payment_row_id ?? "");
    const paymentRow =
      this.db.organization_billing_payments.find((row) => String(row.id) === paymentId) ?? null;

    if (!paymentRow) {
      return {
        data: null,
        error: { message: "No se encontro el pago local para crear la organizacion." }
      };
    }

    if (paymentRow.created_organization_id) {
      return {
        data: String(paymentRow.created_organization_id),
        error: null
      };
    }

    const purpose = String(paymentRow.purpose ?? "organization_subscription").toLowerCase();
    if (purpose !== "organization_creation") {
      return {
        data: null,
        error: null
      };
    }

    const requestedName = String(paymentRow.requested_organization_name ?? "").trim();
    const requestedByAdminId = String(paymentRow.requested_by_admin_id ?? "").trim();
    if (!requestedName || !requestedByAdminId) {
      return {
        data: null,
        error: null
      };
    }

    const baseSlug =
      slugifyOrganizationName(String(paymentRow.requested_organization_slug ?? "")) ||
      slugifyOrganizationName(requestedName) ||
      "e2e-org";
    const existingSlugs = new Set(
      this.db.organizations.map((row) => String(row.slug ?? "").toLowerCase()).filter(Boolean)
    );

    let slug = baseSlug;
    let suffix = 2;
    while (existingSlugs.has(slug.toLowerCase())) {
      slug = `${baseSlug.slice(0, Math.max(1, 50 - String(suffix).length - 1))}-${suffix}`;
      suffix += 1;
    }

    const organization = this.insertRow("organizations", {
      name: requestedName,
      slug,
      created_by: requestedByAdminId,
      is_public: true
    });

    const adminLinkExists = this.db.organization_admins.some(
      (row) =>
        String(row.organization_id) === String(organization.id) &&
        String(row.admin_id) === requestedByAdminId
    );
    if (!adminLinkExists) {
      this.insertRow("organization_admins", {
        organization_id: organization.id,
        admin_id: requestedByAdminId,
        created_by: requestedByAdminId
      });
    }

    paymentRow.created_organization_id = organization.id;
    paymentRow.updated_at = new Date().toISOString();

    return {
      data: String(organization.id),
      error: null
    };
  }
}

class FakeQuery {
  private filters: Filter[] = [];
  private orderBy: Array<{ column: string; ascending: boolean }> = [];
  private limitedTo: number | null = null;
  private slicedRange: [number, number] | null = null;
  private mode: QueryMode = "select";
  private payload: Row | Row[] | null = null;
  private returning = false;
  private head = false;
  private onConflict: string | null = null;
  private selectedColumns = "*";

  constructor(
    private readonly state: FakeSupabaseState,
    private readonly table: TableName
  ) {}

  select(columns = "*", options?: { head?: boolean }) {
    if (this.mode === "select") {
      this.selectedColumns = columns;
      this.head = Boolean(options?.head);
      return this;
    }

    this.returning = true;
    return this;
  }

  insert(values: Row | Row[]) {
    this.mode = "insert";
    this.payload = values;
    return this;
  }

  update(values: Row) {
    this.mode = "update";
    this.payload = values;
    return this;
  }

  upsert(values: Row | Row[], options?: { onConflict?: string }) {
    this.mode = "upsert";
    this.payload = values;
    this.onConflict = options?.onConflict ?? null;
    return this;
  }

  delete() {
    this.mode = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  in(column: string, values: unknown[]) {
    const allowed = new Set(values);
    this.filters.push((row) => allowed.has(row[column]));
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push((row) => (value === null ? row[column] == null : row[column] === value));
    return this;
  }

  ilike(column: string, pattern: string) {
    const normalizedPattern = pattern
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/%/g, ".*")
      .replace(/_/g, ".");
    const regex = new RegExp(`^${normalizedPattern}$`, "i");
    this.filters.push((row) => regex.test(String(row[column] ?? "")));
    return this;
  }

  gt(column: string, value: unknown) {
    this.filters.push((row) => compareValues(row[column], value) > 0);
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push((row) => compareValues(row[column], value) >= 0);
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push((row) => compareValues(row[column], value) <= 0);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy.push({
      column,
      ascending: options?.ascending !== false
    });
    return this;
  }

  limit(value: number) {
    this.limitedTo = value;
    return this;
  }

  range(from: number, to: number) {
    this.slicedRange = [from, to];
    return this;
  }

  single() {
    return this.execute("single");
  }

  maybeSingle() {
    return this.execute("maybeSingle");
  }

  then<TResult1 = Awaited<ReturnType<FakeQuery["execute"]>>, TResult2 = never>(
    onfulfilled?: ((value: Awaited<ReturnType<FakeQuery["execute"]>>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.execute("many").then(onfulfilled, onrejected);
  }

  private getBaseRows() {
    let rows = [...this.state.getTable(this.table)];
    for (const filter of this.filters) {
      rows = rows.filter((row) => filter(row));
    }

    if (this.orderBy.length) {
      rows.sort((left, right) => {
        for (const { column, ascending } of this.orderBy) {
          const result = compareValues(left[column], right[column]);
          if (result !== 0) return ascending ? result : -result;
        }
        return 0;
      });
    }

    return rows;
  }

  private getFilteredRows() {
    let rows = this.getBaseRows();

    if (this.slicedRange) {
      rows = rows.slice(this.slicedRange[0], this.slicedRange[1] + 1);
    }

    if (typeof this.limitedTo === "number") {
      rows = rows.slice(0, this.limitedTo);
    }

    return rows;
  }

  private formatResult(rows: Row[], cardinality: Cardinality, totalCount = rows.length) {
    const normalizedRows = rows.map((row) => this.projectRow(row));

    if (cardinality === "single") {
      if (normalizedRows.length !== 1) {
        return {
          data: null,
          error: { message: "Expected a single row." }
        };
      }

      return {
        data: normalizedRows[0],
        error: null
      };
    }

    if (cardinality === "maybeSingle") {
      if (normalizedRows.length > 1) {
        return {
          data: null,
          error: { message: "Expected zero or one row." }
        };
      }

      return {
        data: normalizedRows[0] ?? null,
        error: null
      };
    }

    if (this.head) {
      return {
        data: null,
        error: null,
        count: totalCount
      };
    }

    return {
      data: normalizedRows,
      error: null,
      count: totalCount
    };
  }

  private projectRow(row: Row) {
    const normalizedRow = cloneRow(row);

    if (this.table === "organization_admins" && this.selectedColumns.includes("organizations(")) {
      const organization =
        this.state
          .getTable("organizations")
          .find((candidate) => String(candidate.id) === String(row.organization_id)) ?? null;
      normalizedRow.organizations = organization ? cloneRow(organization) : null;
    }

    return normalizedRow;
  }

  private executeInsert(cardinality: Cardinality) {
    const rows = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
    const inserted = rows.map((row) => this.state.insertRow(this.table, row));
    return this.returning
      ? this.formatResult(inserted, cardinality)
      : {
          data: null,
          error: null
        };
  }

  private executeUpdate(cardinality: Cardinality) {
    const updates = cloneRow((this.payload ?? {}) as Row);
    const rows = this.getFilteredRows();
    const now = new Date().toISOString();

    rows.forEach((row) => {
      Object.assign(row, updates);
      if ("updated_at" in row) {
        row.updated_at = now;
      }
    });

    return this.returning
      ? this.formatResult(rows, cardinality)
      : {
          data: null,
          error: null
        };
  }

  private executeUpsert(cardinality: Cardinality) {
    const rows = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
    const conflictColumns = (this.onConflict ?? "id")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const touched: Row[] = [];

    for (const row of rows) {
      const existing = this.state.getTable(this.table).find((candidate) =>
        conflictColumns.every((column) => candidate[column] === row[column])
      );

      if (existing) {
        Object.assign(existing, cloneRow(row));
        if ("updated_at" in existing) {
          existing.updated_at = new Date().toISOString();
        }
        touched.push(existing);
      } else {
        touched.push(this.state.insertRow(this.table, row));
      }
    }

    return this.returning
      ? this.formatResult(touched, cardinality)
      : {
          data: null,
          error: null
        };
  }

  private executeDelete(cardinality: Cardinality) {
    const rows = this.getFilteredRows();
    const deletedIds = new Set(rows.map((row) => row.id));
    this.state.db[this.table] = this.state
      .getTable(this.table)
      .filter((row) => !deletedIds.has(row.id));
    this.state.cascadeDelete(this.table, rows);

    return this.returning
      ? this.formatResult(rows, cardinality)
      : {
          data: null,
          error: null
        };
  }

  private execute(cardinality: Cardinality): QueryResult<unknown> {
    const forcedMessage = this.state.getQueryFailure(this.table, this.mode);
    if (forcedMessage) {
      return Promise.resolve({
        data: null,
        error: { message: forcedMessage },
        count: null
      });
    }

    switch (this.mode) {
      case "insert":
        return Promise.resolve(this.executeInsert(cardinality));
      case "update":
        return Promise.resolve(this.executeUpdate(cardinality));
      case "upsert":
        return Promise.resolve(this.executeUpsert(cardinality));
      case "delete":
        return Promise.resolve(this.executeDelete(cardinality));
      case "select":
      default:
        return Promise.resolve(
          this.formatResult(this.getFilteredRows(), cardinality, this.getBaseRows().length)
        );
    }
  }
}

export function createFakeSupabase(seed: SeedInput = {}) {
  const state = new FakeSupabaseState(seed);

  return {
    client: {
      from(table: TableName) {
        return new FakeQuery(state, table);
      },
      rpc(name: string, args: Record<string, unknown>) {
        return state.runRpc(name, args);
      },
      auth: {
        getUser: async () => ({
          data: {
            user: state.getAuthUser()
          },
          error: null
        })
      }
    },
    table(name: TableName) {
      return state.getTable(name).map((row) => cloneRow(row));
    },
    find(table: TableName, predicate: (row: Row) => boolean) {
      const row = state.getTable(table).find((item) => predicate(item)) ?? null;
      return row ? cloneRow(row) : null;
    }
  };
}
