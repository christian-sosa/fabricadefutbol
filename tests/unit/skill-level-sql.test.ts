import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const schemaSqlPath = path.join(root, "supabase", "schema.sql");
const hasSchemaSql = existsSync(schemaSqlPath);
const schemaSql = hasSchemaSql ? readFileSync(schemaSqlPath, "utf8") : "";
const describeSchemaSql = hasSchemaSql ? describe : describe.skip;

describeSchemaSql("players skill level SQL migration", () => {
  it("agrega columnas nuevas sin eliminar initial_rank ni current_rating", () => {
    expect(schemaSql).toContain("initial_rank integer not null check (initial_rank > 0)");
    expect(schemaSql).toContain("skill_level integer not null default 3 check (skill_level between 1 and 5)");
    expect(schemaSql).toContain("display_order integer not null default 1 check (display_order > 0)");
    expect(schemaSql).toContain("current_rating numeric(8,2) not null default 1000.00 check (current_rating > 0)");
  });

  it("backfillea con ntile por grupo antes de setear not null", () => {
    expect(schemaSql).toContain("alter table public.players add column if not exists skill_level integer;");
    expect(schemaSql).toContain("alter table public.players add column if not exists display_order integer;");
    expect(schemaSql).toContain("ntile(5) over");
    expect(schemaSql).toContain("partition by organization_id");
    expect(schemaSql).toContain("set display_order = initial_rank");
    expect(schemaSql).toContain("alter table public.players alter column skill_level set not null;");
    expect(schemaSql).toContain("alter table public.players alter column display_order set not null;");
  });

  it("mantiene initial_rank legacy unico y agrega indice de nivel", () => {
    expect(schemaSql).toContain(
      "create unique index if not exists idx_players_org_initial_rank on public.players (organization_id, initial_rank);"
    );
    expect(schemaSql).toContain(
      "create index if not exists idx_players_org_skill_level_display on public.players(organization_id, skill_level, display_order);"
    );
  });
});
