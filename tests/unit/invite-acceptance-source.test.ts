import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function readSource(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

const inviteFlows = [
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
});
