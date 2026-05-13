import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

const adminLandingPath = path.join(root, "src", "app", "admin", "(panel)", "page.tsx");
const clubDetailPath = path.join(root, "src", "app", "admin", "(panel)", "clubs", "[clubId]", "page.tsx");
const clubsListPath = path.join(root, "src", "app", "admin", "(panel)", "clubs", "page.tsx");
const groupCardPath = path.join(root, "src", "components", "admin", "admin-current-group-card.tsx");
const leagueDetailPath = path.join(root, "src", "app", "admin", "(panel)", "tournaments", "[id]", "page.tsx");
const panelShellPath = path.join(root, "src", "components", "admin", "admin-panel-shell.tsx");
const tournamentsListPath = path.join(root, "src", "app", "admin", "(panel)", "tournaments", "page.tsx");

describe("admin context navigation source", () => {
  it("no muestra facturacion como parte de Grupos", () => {
    const groupCardSource = readFileSync(groupCardPath, "utf8");
    const adminLandingSource = readFileSync(adminLandingPath, "utf8");

    expect(groupCardSource).toContain("configuracion se guardan aca");
    expect(adminLandingSource).toContain("rendimiento y configuracion quedan");
    expect(groupCardSource).not.toContain("facturacion");
    expect(adminLandingSource).not.toContain("facturacion");
  });

  it("trata grupos, clubs y ligas como contextos admin enfocados", () => {
    const source = readFileSync(panelShellPath, "utf8");

    expect(source).toContain("isGroupContext");
    expect(source).toContain("isClubDetailContext");
    expect(source).toContain("isTournamentStandalonePage");
    expect(source).toContain("isLeagueDetailContext");
    expect(source).toContain("isLeagueRootContext");
    expect(source).toContain("isFocusedAdminContext");
    expect(source).toContain("!isFocusedAdminContext");
    expect(source).toContain("!isLeagueRootContext");
  });

  it("mantiene /admin como hub general si no hay grupo explicito", () => {
    const adminLandingSource = readFileSync(adminLandingPath, "utf8");

    expect(adminLandingSource).toContain("resolvedSearchParams.org");
    expect(adminLandingSource).toContain("const selectedOrganization = resolvedSearchParams.org");
    expect(adminLandingSource).not.toContain(
      "const selectedOrganization = findOrganizationByKey(organizations, resolvedSearchParams.org);"
    );
  });

  it("usa acciones de contexto compartidas en admin Clubs", () => {
    const clubDetailSource = readFileSync(clubDetailPath, "utf8");
    const clubsListSource = readFileSync(clubsListPath, "utf8");

    expect(clubDetailSource).toContain("const { admin } = await requireAdminClub(clubId);");
    expect(clubDetailSource).toContain("Modo administrador / {admin.displayName}");
    expect(clubDetailSource).toContain("Cambiar espacio");
    expect(clubDetailSource).toContain("Vista del club");
    expect(clubDetailSource).toContain("SignOutButton");
    expect(clubDetailSource).toContain("adminContextActionLinkClass");
    expect(clubDetailSource).toContain("adminContextPrimaryActionLinkClass");
    expect(clubDetailSource).not.toContain("Menu admin");
    expect(clubsListSource).toContain("adminContextActionLinkClass");
    expect(clubsListSource).toContain("adminContextPrimaryActionLinkClass");
    expect(clubsListSource).toContain("Cambiar espacio");
    expect(clubsListSource).not.toContain("Menu admin");
  });

  it("usa acciones de contexto compartidas en admin Ligas", () => {
    const leagueDetailSource = readFileSync(leagueDetailPath, "utf8");
    const tournamentsListSource = readFileSync(tournamentsListPath, "utf8");

    expect(leagueDetailSource).toContain("const { admin } = await requireAdminLeague(id);");
    expect(leagueDetailSource).toContain("Modo administrador / {admin.displayName}");
    expect(leagueDetailSource).toContain("Cambiar espacio");
    expect(leagueDetailSource).toContain("Ver publica");
    expect(leagueDetailSource).toContain("<AdminSubnav scope=\"tournaments\" />");
    expect(leagueDetailSource).toContain("SignOutButton");
    expect(leagueDetailSource).toContain("adminContextActionLinkClass");
    expect(leagueDetailSource).toContain("adminContextPrimaryActionLinkClass");
    expect(leagueDetailSource).not.toContain("Menu admin");
    expect(leagueDetailSource).not.toContain("Volver a ligas");
    expect(leagueDetailSource).not.toContain("deleteLeagueAction");
    expect(leagueDetailSource).not.toContain("Seguro que quieres borrar ${details.league.name}");
    expect(leagueDetailSource).not.toContain('htmlFor="status"');
    expect(leagueDetailSource).not.toContain('name="status"');
    expect(tournamentsListSource).toContain('redirect("/admin")');
    expect(tournamentsListSource).not.toContain("Mis ligas");
    expect(tournamentsListSource).not.toContain("Gestionar");
  });
});
