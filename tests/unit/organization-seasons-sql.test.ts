import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const schemaSqlPath = path.join(root, "supabase", "schema.sql");
const hasSupabaseSql = existsSync(schemaSqlPath);
const schemaSql = hasSupabaseSql ? readFileSync(schemaSqlPath, "utf8") : "";
const describeSupabaseSql = hasSupabaseSql ? describe : describe.skip;

describeSupabaseSql("organization seasons sql", () => {
  it("mantiene temporadas anuales y permite cierre inclusivo el 31 de diciembre", () => {
    expect(schemaSql).toContain("organization_seasons_duration_months_positive_check");
    expect(schemaSql).toContain("organization_seasons_date_range_check");
    expect(schemaSql).toContain("check (ends_at >= starts_at)");
    expect(schemaSql).toContain("make_date(greatest(extract(year from starts_at)::int, 2026), 12, 31)");
    expect(schemaSql).not.toContain("duration_months in (6, 12)");
  });
});
