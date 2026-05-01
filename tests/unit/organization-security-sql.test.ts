import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const schemaSqlPath = path.join(root, "supabase", "schema.sql");
const policiesSqlPath = path.join(root, "supabase", "policies.sql");
const hasSupabaseSql = existsSync(schemaSqlPath) && existsSync(policiesSqlPath);
const schemaSql = hasSupabaseSql ? readFileSync(schemaSqlPath, "utf8") : "";
const policiesSql = hasSupabaseSql ? readFileSync(policiesSqlPath, "utf8") : "";
const describeSupabaseSql = hasSupabaseSql ? describe : describe.skip;

describeSupabaseSql("organization security sql", () => {
  it("centraliza escrituras de grupos en la ventana comercial activa", () => {
    expect(policiesSql).toContain("create or replace function public.can_write_org");
    expect(policiesSql).toContain("o.created_at + interval '30 days' >= timezone('utc', now())");
    expect(policiesSql).toContain("lower(s.status) = 'active'");
    expect(policiesSql).toContain("using (public.can_write_org(organization_id))");
    expect(policiesSql).toContain("and public.can_write_org(m.organization_id)");
    expect(policiesSql).toContain("%1$I.can_write_org(p.organization_id)");
    expect(policiesSql).toContain("%1$I.can_write_org(o.id)");
  });

  it("bloquea altas duplicadas y aceptaciones de invitaciones vencidas", () => {
    expect(policiesSql).toContain("create or replace function public.can_create_organization");
    expect(policiesSql).toContain("from public.organization_admins oa");
    expect(policiesSql).toContain("and public.org_has_admin_slot(organization_id)");
    expect(policiesSql).toContain("and i.expires_at > timezone('utc', now())");
    expect(policiesSql).toContain("and oi.expires_at > timezone('utc', now())");
  });

  it("mantiene aplicacion de pagos atomica e inmutable la fecha de alta", () => {
    expect(schemaSql).toContain("create or replace function public.apply_organization_billing_payment_period");
    expect(schemaSql).toContain("for update;");
    expect(schemaSql).toContain("create or replace function public.prevent_organization_security_column_changes");
    expect(schemaSql).toContain("before update of created_at, created_by on public.organizations");
    expect(policiesSql).toContain("grant execute on function public.apply_organization_billing_payment_period");
  });
});
