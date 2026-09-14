type TableName =
  | "admins"
  | "analytics_events"
  | "organizations"
  | "organization_admins"
  | "organization_invites"
  | "organization_audit_events"
  | "organization_seasons"
  | "organization_season_player_ratings"
  | "player_photo_upload_events"
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
    analytics_events: [],
    organizations: [],
    organization_admins: [],
    organization_invites: [],
    organization_audit_events: [],
    organization_seasons: [],
    organization_season_player_ratings: [],
    player_photo_upload_events: [],
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
    case "analytics_events":
      if (!normalized.source) normalized.source = "server";
      if (!("admin_id" in normalized)) normalized.admin_id = null;
      if (!("organization_id" in normalized)) normalized.organization_id = null;
      if (!("entity_type" in normalized)) normalized.entity_type = null;
      if (!("entity_id" in normalized)) normalized.entity_id = null;
      if (!("path" in normalized)) normalized.path = null;
      if (!("properties" in normalized)) normalized.properties = {};
      break;
    case "organization_audit_events":
      if (!("details" in normalized)) normalized.details = {};
      if (!("actor_admin_id" in normalized)) normalized.actor_admin_id = null;
      if (!("actor_email" in normalized)) normalized.actor_email = null;
      if (!("target_admin_id" in normalized)) normalized.target_admin_id = null;
      if (!("target_email" in normalized)) normalized.target_email = null;
      if (!("entity_type" in normalized)) normalized.entity_type = null;
      if (!("entity_id" in normalized)) normalized.entity_id = null;
      break;
    case "organization_seasons":
      if (!("duration_months" in normalized)) normalized.duration_months = 12;
      if (!("status" in normalized)) normalized.status = "active";
      if (!("created_by" in normalized)) normalized.created_by = null;
      if (!("closed_at" in normalized)) normalized.closed_at = null;
      if (!normalized.updated_at) normalized.updated_at = now;
      break;
    case "organization_season_player_ratings":
      if (!("current_rating" in normalized)) normalized.current_rating = 1000;
      if (!normalized.updated_at) normalized.updated_at = now;
      break;
    case "player_photo_upload_events":
      break;
    case "players":
      if (!("skill_level" in normalized)) normalized.skill_level = 5;
      if (!("display_order" in normalized)) normalized.display_order = normalized.initial_rank ?? 1;
      if (!("current_rating" in normalized)) normalized.current_rating = 1000;
      if (!("active" in normalized)) normalized.active = true;
      if (!normalized.updated_at) normalized.updated_at = now;
      break;
    case "matches":
      if (!normalized.status) normalized.status = "draft";
      if (!("confirmed_option_id" in normalized)) normalized.confirmed_option_id = null;
      if (!("finished_at" in normalized)) normalized.finished_at = null;
      if (!("season_id" in normalized)) normalized.season_id = null;
      if (!("team_a_label" in normalized)) normalized.team_a_label = null;
      if (!("team_b_label" in normalized)) normalized.team_b_label = null;
      if (!normalized.updated_at) normalized.updated_at = now;
      break;
    case "team_options":
      if (!("is_confirmed" in normalized)) normalized.is_confirmed = false;
      break;
    case "match_result":
      if (!("mvp_player_id" in normalized)) normalized.mvp_player_id = null;
      if (!("mvp_guest_id" in normalized)) normalized.mvp_guest_id = null;
      if (!("mvp_display_name" in normalized)) normalized.mvp_display_name = null;
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

    const normalized = applyDefaults(table, cloneRow(row), () => this.nextId());
    this.db[table].push(normalized);

    return normalized;
  }

  cascadeDelete(table: TableName, deletedRows: Row[]) {
    if (!deletedRows.length) return;

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
    if (name === "is_super_admin") return { data: false, error: null };
    if (name === "replace_group_match_options") {
      const match = this.db.matches.find((row) => row.id === args.p_match_id && row.organization_id === args.p_organization_id);
      if (!match || match.status !== "draft") return { data: null, error: { message: "Solo se pueden regenerar opciones en borrador." } };
      const removed = this.db.team_options.filter((row) => row.match_id === args.p_match_id);
      this.cascadeDelete("team_options", removed);
      this.db.team_options = this.db.team_options.filter((row) => row.match_id !== args.p_match_id);
      const options = args.p_options as Array<{ teamA: Array<{ id: string }>; teamB: Array<{ id: string }>; ratingSumA: number; ratingSumB: number; ratingDiff: number }>;
      options.forEach((value, index) => {
        const option = this.insertRow("team_options", { match_id: args.p_match_id, option_number: index + 1, rating_sum_a: value.ratingSumA, rating_sum_b: value.ratingSumB, rating_diff: value.ratingDiff });
        for (const team of ["A", "B"] as const) for (const member of value[team === "A" ? "teamA" : "teamB"]) {
          const [source, id] = member.id.split(":");
          this.insertRow(source === "player" ? "team_option_players" : "team_option_guests", { team_option_id: option.id, [source === "player" ? "player_id" : "guest_id"]: id, team });
        }
      });
      match.result_version = Number(match.result_version ?? 0) + 1;
      return { data: { result_version: match.result_version }, error: null };
    }
    if (name === "confirm_group_match_option") {
      const match = this.db.matches.find((row) => row.id === args.p_match_id && row.organization_id === args.p_organization_id);
      const option = this.db.team_options.find((row) => row.id === args.p_option_id && row.match_id === args.p_match_id);
      if (!match || !option || match.status !== "draft") return { data: null, error: { message: "Solo puedes confirmar una opcion del partido en borrador." } };
      this.db.team_options.filter((row) => row.match_id === args.p_match_id).forEach((row) => { row.is_confirmed = row.id === args.p_option_id; });
      Object.assign(match, { status: "confirmed", confirmed_option_id: args.p_option_id, team_a_label: args.p_team_a_label, team_b_label: args.p_team_b_label,
        result_version: Number(match.result_version ?? 0) + 1 });
      return { data: { result_version: match.result_version }, error: null };
    }
    return {
      data: args,
      error: { message: `RPC no soportada en fake: ${name}` }
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
      const clearsPhotoOnly = this.table === "players" && updates.photo_path === null && Object.keys(updates).length === 1;
      if ("updated_at" in row && !clearsPhotoOnly) {
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
