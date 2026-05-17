import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const supabaseDir = path.join(root, "supabase");
const policiesSqlPath = path.join(supabaseDir, "policies.sql");
const hasSupabaseSql = existsSync(policiesSqlPath);
const policiesSql = hasSupabaseSql ? readFileSync(policiesSqlPath, "utf8") : "";

function listSqlFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];

  return readdirSync(directory).flatMap((entry) => {
    const absolutePath = path.join(directory, entry);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) return listSqlFiles(absolutePath);
    return entry.endsWith(".sql") ? [absolutePath] : [];
  });
}

describe("super admin SQL", () => {
  it("resuelve super admins desde una tabla operativa, no desde un email hardcodeado", () => {
    expect(hasSupabaseSql).toBe(true);
    expect(policiesSql).toContain("create table if not exists public.super_admin_emails");
    expect(policiesSql).toContain("create or replace function public.is_super_admin()");
    expect(policiesSql).toContain("from public.super_admin_emails sae");
    expect(policiesSql).toContain("where sae.email = public.current_user_email()");
    expect(policiesSql).not.toMatch(/current_user_email\(\)\s*=/);
  });

  it("no deja emails personales hardcodeados en SQL", () => {
    const offenders = listSqlFiles(supabaseDir).filter((filePath) => {
      const sql = readFileSync(filePath, "utf8");
      return /current_user_email\(\)\s*=\s*'[^']+@[^']+'/.test(sql);
    });

    expect(offenders).toEqual([]);
  });
});
