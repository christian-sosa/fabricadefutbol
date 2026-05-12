import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const playersPagePath = path.join(root, "src", "app", "admin", "(panel)", "players", "page.tsx");
const panelShellPath = path.join(root, "src", "components", "admin", "admin-panel-shell.tsx");

describe("admin players UX source", () => {
  it("usa una pantalla base con botones para alta y edicion de planilla", () => {
    const source = readFileSync(playersPagePath, "utf8");

    expect(source).toContain('resolvedSearchParams.view === "new"');
    expect(source).toContain('resolvedSearchParams.view === "edit"');
    expect(source).toContain('withOrgQuery("/admin/players?view=new"');
    expect(source).toContain('withOrgQuery("/admin/players?view=edit"');
    expect(source).toContain("Gestion de jugadores");
  });

  it("no muestra rendimiento automatico en la planilla editable", () => {
    const source = readFileSync(playersPagePath, "utf8");

    expect(source).not.toContain("formatRendimiento");
    expect(source).not.toContain("Automatico");
    expect(source).not.toContain("<span>Rendimiento</span>");
  });

  it("usa una grilla estable para alinear nivel, foto y acciones en la planilla", () => {
    const source = readFileSync(playersPagePath, "utf8");

    expect(source).toContain("playersRosterGridColumns");
    expect(source).toContain("minmax(260px,1.6fr)_80px");
    expect(source).not.toContain("minmax(260px,1.6fr)_auto");
  });

  it("el shell admin oculta el encabezado global dentro de un grupo activo", () => {
    expect(existsSync(panelShellPath)).toBe(true);

    const source = readFileSync(panelShellPath, "utf8");

    expect(source).toContain("isGroupContext");
    expect(source).toContain("searchParams.get(\"org\")");
    expect(source).toContain("!isFocusedAdminContext");
  });
});
