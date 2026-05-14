import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function readSource(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

const inviteFlows = [
  {
    action: "src/app/invite/[token]/actions.ts",
    actionName: "acceptInviteAction",
    forbiddenMutationTables: ["admins", "organization_admins", "organization_invites"],
    page: "src/app/invite/[token]/page.tsx"
  },
  {
    action: "src/app/admin/tournaments/invite/[token]/actions.ts",
    actionName: "acceptTournamentAdminInviteAction",
    forbiddenMutationTables: ["admins", "league_admins", "league_admin_invites"],
    page: "src/app/admin/tournaments/invite/[token]/page.tsx"
  },
  {
    action: "src/app/admin/clubs/invite/[token]/actions.ts",
    actionName: "acceptClubAdminInviteAction",
    forbiddenMutationTables: ["admins", "club_admins", "club_admin_invites"],
    page: "src/app/admin/clubs/invite/[token]/page.tsx"
  },
  {
    action: "src/app/captain/invite/[token]/actions.ts",
    actionName: "acceptCaptainInviteAction",
    forbiddenMutationTables: ["admins", "competition_team_captains", "competition_captain_invites"],
    page: "src/app/captain/invite/[token]/page.tsx"
  }
];

describe("invite acceptance flow source", () => {
  it("mantiene las paginas de invitacion sin mutaciones en GET", () => {
    for (const flow of inviteFlows) {
      const source = readSource(flow.page);

      expect(source).toContain(`import { ${flow.actionName} }`);
      expect(source).toContain(`action={${flow.actionName}}`);
      for (const table of flow.forbiddenMutationTables) {
        expect(source).not.toMatch(
          new RegExp(`\\.from\\("${table}"\\)[\\s\\S]{0,400}\\.(insert|upsert|update|delete)\\(`)
        );
      }
    }
  });

  it("mueve cada aceptacion a una Server Action dedicada", () => {
    for (const flow of inviteFlows) {
      const actionPath = path.join(root, flow.action);

      expect(existsSync(actionPath)).toBe(true);
      expect(readSource(flow.action)).toContain(`export async function ${flow.actionName}`);
    }
  });

  it("aplica rate limit antes de resolver y consumir tokens", () => {
    for (const flow of inviteFlows) {
      const source = readSource(flow.action);

      expect(source).toContain("checkActionRateLimit");
      expect(source).toContain("formatActionRateLimitMessage");
    }
  });

  it("valida el maximo de admins activos antes de consumir invitaciones privilegiadas", () => {
    const tournamentSource = readSource("src/app/admin/tournaments/invite/[token]/actions.ts");
    const clubSource = readSource("src/app/admin/clubs/invite/[token]/actions.ts");

    expect(tournamentSource).toContain('.from("league_admins")');
    expect(tournamentSource).toContain('select("id", { count: "exact", head: true })');
    expect(tournamentSource).toContain("(adminsCount ?? 0) >= 4");
    expect(tournamentSource).toContain("Esta liga ya alcanzo el maximo de 4 administradores.");

    expect(clubSource).toContain('.from("club_admins")');
    expect(clubSource).toContain('select("id", { count: "exact", head: true })');
    expect(clubSource).toContain("(adminsCount ?? 0) >= 4");
  });

  it("conserva el rastro de invitaciones admin aceptadas en torneos y clubs", () => {
    const tournamentSource = readSource("src/app/admin/tournaments/invite/[token]/actions.ts");
    const clubSource = readSource("src/app/admin/clubs/invite/[token]/actions.ts");

    for (const source of [tournamentSource, clubSource]) {
      expect(source).toContain('status: "accepted"');
      expect(source).toContain("accepted_by: user.id");
      expect(source).toContain("accepted_at: new Date().toISOString()");
      expect(source).not.toMatch(/\.from\("(league_admin_invites|club_admin_invites)"\)[\s\S]{0,400}\.delete\(/);
    }
  });

  it("revoca invitaciones admin de torneos y clubs sin borrar evidencia", () => {
    const leaguePanelSource = readSource("src/app/admin/(panel)/tournaments/[id]/actions.ts");
    const clubPanelSource = readSource("src/app/admin/(panel)/clubs/[clubId]/actions.ts");

    expect(leaguePanelSource).toContain('.from("league_admin_invites")');
    expect(leaguePanelSource).toContain('update({ status: "revoked" })');
    expect(clubPanelSource).toContain('.from("club_admin_invites")');
    expect(clubPanelSource).toContain('update({ status: "revoked" })');
  });
});
