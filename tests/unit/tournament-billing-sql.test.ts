import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const schemaSqlPath = path.join(root, "supabase", "schema.sql");
const policiesSqlPath = path.join(root, "supabase", "policies.sql");
const hasSupabaseSql = existsSync(schemaSqlPath) && existsSync(policiesSqlPath);
const policiesSql = hasSupabaseSql ? readFileSync(policiesSqlPath, "utf8") : "";
const describeSupabaseSql = hasSupabaseSql ? describe : describe.skip;

describeSupabaseSql("tournament billing sql", () => {
  it("permite leer y aplicar suscripciones de liga con permisos correctos", () => {
    expect(policiesSql).toContain("public.league_billing_subscriptions");
    expect(policiesSql).toMatch(
      /grant select on table[^;]*public\.league_billing_subscriptions[^;]*to authenticated;/
    );
    expect(policiesSql).toMatch(
      /grant select, insert, update, delete on table[^;]*public\.league_billing_subscriptions[^;]*to service_role;/
    );
    expect(policiesSql).toContain(
      "alter table public.league_billing_subscriptions enable row level security;"
    );
    expect(policiesSql).toContain("create policy league_billing_subscriptions_select");
    expect(policiesSql).toContain("using (public.is_league_admin(league_id));");
  });
});
