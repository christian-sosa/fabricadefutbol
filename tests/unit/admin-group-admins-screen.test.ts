import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const adminSummaryPagePath = path.join(root, "src", "app", "admin", "(panel)", "page.tsx");
const adminTeamPagePath = path.join(root, "src", "app", "admin", "(panel)", "admins", "page.tsx");
const adminMatchesPagePath = path.join(root, "src", "app", "admin", "(panel)", "matches", "page.tsx");
const actionsPath = path.join(root, "src", "app", "admin", "(panel)", "actions.ts");

describe("admin group admins screen", () => {
  it("mantiene el equipo administrador fuera del resumen del grupo", () => {
    const summarySource = readFileSync(adminSummaryPagePath, "utf8");

    expect(summarySource).not.toContain("Equipo administrador");
    expect(summarySource).not.toContain("getOrganizationAdminData");
    expect(summarySource).not.toContain("inviteOrganizationAdminAction");
  });

  it("expone el equipo administrador en una pantalla dedicada", () => {
    expect(existsSync(adminTeamPagePath)).toBe(true);

    const teamPageSource = readFileSync(adminTeamPagePath, "utf8");

    expect(teamPageSource).toContain("Equipo administrador");
    expect(teamPageSource).toContain("requireAdminOrganization");
    expect(teamPageSource).toContain("getOrganizationAdminData");
  });

  it("vuelve a la pantalla de admins despues de cambios en el equipo", () => {
    const actionsSource = readFileSync(actionsPath, "utf8");

    expect(actionsSource).toContain("buildAdminAdminsPath");
    expect(actionsSource).toContain('redirect(buildAdminAdminsPath(organizationQueryKey))');
  });

  it("mueve el desglose de estados de partidos fuera del resumen", () => {
    const summarySource = readFileSync(adminSummaryPagePath, "utf8");
    const matchesSource = readFileSync(adminMatchesPagePath, "utf8");

    expect(summarySource).not.toContain("Partidos en borrador");
    expect(summarySource).not.toContain("Partidos confirmados");
    expect(summarySource).not.toContain("Partidos finalizados");
    expect(matchesSource).toContain("Borradores");
    expect(matchesSource).toContain("Confirmados");
    expect(matchesSource).toContain("Finalizados");
    expect(matchesSource).toContain("Cancelados");
  });
});
