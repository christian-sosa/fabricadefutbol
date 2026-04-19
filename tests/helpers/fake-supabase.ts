import { slugifyOrganizationName } from "@/lib/org";

type TableName =
  | "admins"
  | "organizations"
  | "organization_admins"
  | "organization_billing_payments"
  | "organization_billing_subscriptions"
  | "players"
  | "matches"
  | "match_players"
  | "match_guests"
  | "team_options"
  | "team_option_players"
  | "team_option_guests"
  | "match_result"
  | "rating_history"
  | "match_player_stats";

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
    organization_billing_payments: [],
    organization_billing_subscriptions: [],
    players: [],
    matches: [],
    match_players: [],
    match_guests: [],
    team_options: [],
    team_option_players: [],
    team_option_guests: [],
    match_result: [],
    rating_history: [],
    match_player_stats: []
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
    case "players":
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
  private orderBy: { column: string; ascending: boolean } | null = null;
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
    void columns;
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

  gt(column: string, value: unknown) {
    this.filters.push((row) => compareValues(row[column], value) > 0);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = {
      column,
      ascending: options?.ascending !== false
    };
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

    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      rows.sort((left, right) => {
        const result = compareValues(left[column], right[column]);
        return ascending ? result : -result;
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
        return Promise.resolve(this.formatResult(this.getFilteredRows(), cardinality, this.getBaseRows().length));
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
