import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const schemaSql = readFileSync(path.join(root, "supabase", "schema.sql"), "utf8");
const policiesSql = readFileSync(path.join(root, "supabase", "policies.sql"), "utf8");

describe("organization public snapshot SQL", () => {
  it("define una tabla de snapshot por grupo", () => {
    expect(schemaSql).toContain("create table if not exists public.organization_public_snapshots");
    expect(schemaSql).toContain("organization_id uuid primary key references public.organizations(id) on delete cascade");
    expect(schemaSql).toContain("summary jsonb not null default '{}'::jsonb");
    expect(schemaSql).toContain("standings jsonb not null default '[]'::jsonb");
    expect(schemaSql).toContain("match_history jsonb not null default '[]'::jsonb");
  });

  it("protege la lectura con la visibilidad publica del grupo", () => {
    expect(policiesSql).toContain("alter table public.organization_public_snapshots enable row level security;");
    expect(policiesSql).toContain("organization_public_snapshots_public_read");
    expect(policiesSql).toContain("using (public.can_read_org(organization_id));");
  });

  it("limita la escritura a admins del grupo", () => {
    expect(policiesSql).toContain("organization_public_snapshots_admin_write");
    expect(policiesSql).toContain("with check (public.is_org_admin(organization_id));");
  });
});
